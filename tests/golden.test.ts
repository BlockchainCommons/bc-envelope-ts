/* eslint-disable @typescript-eslint/no-non-null-assertion -- fixtures are indexed by position; a miss fails the test */
/**
 * Golden snapshots: the notation, tree and mermaid strings of every
 * hand-built corpus envelope, plus the decode rejection table. The
 * vectors file pins the same outputs byte for byte; this snapshot is the
 * human-readable view of them.
 */
import { describe, it, expect } from "vitest";
import * as src from "../src/all.js";
import { HAND, WIRE, REJECT, DOMAIN_CASES, isReproducible } from "./corpus/corpus";
import {
  type E,
  materialize,
  workingTreeAdapterFor,
  recipeName,
  randomnessOf,
  type Out,
} from "./vectors/recipes";
import { currentDeps } from "./vectors/deps";
import "../src/all.js";

const api = workingTreeAdapterFor(src, await currentDeps());

describe("golden: hand corpus", () => {
  for (const e of HAND) {
    if (e.k === "decode" || e.k === "ur" || !isReproducible(e)) continue;
    // Digests (tree, mermaid) are stable only where no fresh randomness enters.
    const level = randomnessOf(e);
    const out: Out[] =
      level === "digest"
        ? ["format"]
        : level === "bytes"
          ? ["format", "tree"]
          : ["format", "tree", "mermaid"];
    it(recipeName({ e }), () => {
      expect(materialize(api, { e, out })).toMatchSnapshot();
    });
  }
  for (const [name, list] of [
    ["wire", WIRE.filter(isReproducible)],
    ["reject", REJECT],
    ["domain", DOMAIN_CASES.map(([c, cls]): E => ({ k: "domain", case: c, cls }))],
  ] as const) {
    it(`category ${name}`, () => {
      const rows = list.map(
        (e) =>
          `${recipeName({ e })}: ${materialize(api, {
            e,
            out: name === "wire" ? ["format"] : ["format"],
          })
            .split("\n")
            .join(" ")}`,
      );
      expect(rows).toMatchSnapshot();
    });
  }
  it("decode rejections", () => {
    const rows = HAND.filter((e) => e.k === "decode" || e.k === "ur").map(
      (e) =>
        `${recipeName({ e })}: ${materialize(api, { e, out: ["format"] })
          .split("\n")
          .join(" ")}`,
    );
    expect(rows).toMatchSnapshot();
  });
});

/**
 * Behaviour snapshots: what the port does today at every boundary the
 * review corrected (content keys, deduplication, obscured subjects, dates,
 * mutability, error codes, format strings, acceptance, the JavaScript input
 * domain), recorded verbatim so later changes are a visible diff. Outcomes are `ok:<value>` or
 * `throw:<class>[:<code>]:<message>` with the `cause` chain.
 */
import { EnvelopeError } from "../src/index.js";
import * as fmt from "../src/format/index.js";
import * as xp from "../src/expression.js";
import { PrivateKeyBase, SymmetricKey, Salt, ARID } from "@blockchaincommons/components";
import { cbor, taggedValue, expectText } from "@blockchaincommons/dcbor";
import { SIGNED, NOTE } from "@blockchaincommons/known-values";

describe("golden: behaviour snapshots", () => {
  const { Envelope } = src;
  const hexOf = (u: Uint8Array): string => Buffer.from(u).toString("hex");
  const bytes = (n: number, s = 0): Uint8Array =>
    Uint8Array.from({ length: n }, (_, i) => (s + i) & 0xff);
  const outcome = (f: () => unknown): string => {
    try {
      const v = f();
      if (typeof v === "string") return `ok:${v}`;
      if (v instanceof Envelope) return `ok:${v.format().replace(/\n\s*/g, " ")}`;
      return `ok:${JSON.stringify(v)}`;
    } catch (e) {
      const chain: string[] = [];
      let cur: unknown = e;
      while (cur instanceof Error) {
        const code = (cur as { code?: string }).code;
        chain.push(
          `${cur.constructor.name}${code === undefined ? "" : `:${code}`}:${cur.message.slice(0, 70)}`,
        );
        cur = cur.cause;
      }
      return `throw:${chain.join(" <- ")}`;
    }
  };
  const key = SymmetricKey.from(bytes(32, 7));
  const bob = PrivateKeyBase.from(bytes(32, 0x18));
  const carol = PrivateKeyBase.from(bytes(32, 0x40));
  const hello = Envelope.from("Hello.");
  const id = ARID.from(bytes(32, 0xc6));

  it("the sealed content key is the key's tagged CBOR", () => {
    const sealed = hello
      .encryptSubject(key)
      .addRecipient(bob.encapsulationPrivateKey().publicKey(), key);
    expect([
      `recipients()[0].decrypt(bob).length: ${outcome(() => sealed.recipients()[0]!.decrypt(bob.encapsulationPrivateKey()).length)}`,
      `decryptSubjectToRecipient(bob): ${outcome(() => sealed.decryptSubjectToRecipient(bob))}`,
    ]).toMatchSnapshot();
  });
  it("duplicate assertions are deduplicated by digest", () => {
    const a1 = Envelope.from("Alice").addAssertion("knows", "Bob");
    const a2 = a1.addAssertion("knows", "Bob");
    expect([
      `assertions: ${a2.assertions().length}, digest ${a2.digest().toHex().slice(0, 8)} (a1 ${a1.digest().toHex().slice(0, 8)})`,
      `addOptionalAssertionEnvelope(dup): ${a1.addOptionalAssertionEnvelope(Envelope.assertion("knows", "Bob")).assertions().length}`,
      `format: ${a2.format().replace(/\n\s*/g, " ")}`,
    ]).toMatchSnapshot();
  });
  it("a node whose subject is obscured", () => {
    const salted = Envelope.from("A").addAssertion("p", "o", { salt: true });
    const inner = salted.assertions()[0]!.subject();
    const elidedInner = salted.elide({ removing: [inner] });
    const a = elidedInner.assertions()[0]!;
    expect([
      `format: ${elidedInner.format().replace(/\n\s*/g, " ")}`,
      `isSubjectObscured ${a.isSubjectObscured()}, isSubjectElided ${a.isSubjectElided()}`,
      `fromBytes: ${outcome(() => Envelope.fromBytes(elidedInner.toCbor().toData()))}`,
      `node(): ${outcome(() => Envelope.node(elidedInner.subject(), elidedInner.assertions()))}`,
    ]).toMatchSnapshot();
  });
  it("Date and undefined inputs", () => {
    expect([
      `from(new Date(0)): ${outcome(() => hexOf(Envelope.leaf(new Date(0)).toCbor().toData()))}`,
      `from(undefined): ${outcome(() => Envelope.from(undefined as never).diagnostic())}`,
    ]).toMatchSnapshot();
  });
  it("mutability", () => {
    const m = Envelope.from("Alice").addAssertion("knows", "Bob");
    const before = { d: m.digest().toHex(), c: hexOf(m.toCbor().toData()) };
    const push = outcome(() =>
      (m.assertions() as unknown as { push(x: unknown): number }).push(
        Envelope.assertion("x", "y"),
      ),
    );
    const bytesEnv = Envelope.from(bytes(3, 1));
    bytesEnv.asBytes()![0] = 0xff;
    const d = Envelope.from("z");
    const dhex = d.digest().toHex();
    d.digest().bytes[0] ^= 0xff;
    expect([
      `assertions().push → ${push}; count ${m.assertions().length}, digest same ${m.digest().toHex() === before.d}, cbor same ${hexOf(m.toCbor().toData()) === before.c}`,
      `case frozen ${Object.isFrozen(m.case)}, case.assertions is assertions() ${m.case.type === "node" && m.case.assertions === m.assertions()}`,
      `asBytes()[0] = 0xff → toCbor ${hexOf(bytesEnv.toCbor().toData())}`,
      `digest().bytes[0] ^= 0xff → digest unchanged ${d.digest().toHex() === dhex} (components' Digest.bytes is already a copy)`,
    ]).toMatchSnapshot();
  });
  it("the assertion check runs before salting", () => {
    const b6 = () =>
      Envelope.from("A").addAssertionEnvelope(Envelope.from("not-an-assertion"), { salt: true });
    expect([
      `construct: ${outcome(b6)}`,
      `fromBytes: ${outcome(() => Envelope.fromBytes(b6().toCbor().toData()))}`,
    ]).toMatchSnapshot();
  });
  it("the reference's error variant at every operation", () => {
    const enc = hello.encryptSubject(key);
    const sealed = enc.addRecipient(bob.encapsulationPrivateKey().publicKey(), key);
    const req = xp.Request.from(new xp.Expression(xp.Function.named("f")), id).toEnvelope();
    expect([
      `encrypt twice: ${outcome(() => enc.encryptSubject(key))}`,
      `encrypt elided: ${outcome(() => hello.elide().encryptSubject(key))}`,
      `decrypt plain: ${outcome(() => hello.decryptSubject(key))}`,
      `wrong key: ${outcome(() => enc.decryptSubject(SymmetricKey.from(bytes(32, 9))))}`,
      `compress encrypted: ${outcome(() => enc.compress())}`,
      `decompress plain: ${outcome(() => hello.decompress())}`,
      `decryptSubjectToRecipient non-recipient: ${outcome(() => sealed.decryptSubjectToRecipient(carol))}`,
      `decryptSubjectToRecipient no recipients: ${outcome(() => enc.decryptSubjectToRecipient(bob))}`,
      `attachmentPayload on non-attachment: ${outcome(() => hello.attachmentPayload())}`,
      `expectAttachment none: ${outcome(() => hello.expectAttachment())}`,
      `Request.fromEnvelope mismatch: ${outcome(() => xp.Request.fromEnvelope(req, xp.Function.named("g")))}`,
    ]).toMatchSnapshot();
  });
  it("decode error identity", () => {
    expect([
      `fromCbor(200([1])): ${outcome(() => Envelope.fromCbor(taggedValue(200, cbor([1]))))}`,
      `fromBytes(ff00): ${outcome(() => Envelope.fromBytes(Uint8Array.from([0xff, 0x00])))}`,
      `fromCbor(201(42)): ${outcome(() => Envelope.fromCbor(taggedValue(201, cbor(42))))}`,
    ]).toMatchSnapshot();
  });
  it("an obscured recipient", () => {
    const two = hello
      .encryptSubject(key)
      .addRecipient(bob.encapsulationPrivateKey().publicKey(), key)
      .addRecipient(carol.encapsulationPrivateKey().publicKey(), key);
    // The recipient assertions sort by digest, which the random ephemeral key changes
    // per run: find Bob's by decrypting, so it is always his that gets elided.
    const bobIndex = two.recipients().findIndex((r) => {
      try {
        r.decrypt(bob.encapsulationPrivateKey());
        return true;
      } catch {
        return false;
      }
    });
    const bobElided = two.elide({ removing: [two.assertions()[bobIndex]!] });
    expect([
      `format: ${bobElided.format().replace(/\n\s*/g, " ")}`,
      `recipients(): ${outcome(() => bobElided.recipients().length)}`,
      `decryptSubjectToRecipient(carol): ${outcome(() => bobElided.decryptSubjectToRecipient(carol))}`,
    ]).toMatchSnapshot();
  });
  it("empty verifier lists", () => {
    const signed = hello.sign(PrivateKeyBase.from(bytes(32, 5)).schnorrSigningPrivateKey());
    expect([
      `hasSignaturesFrom([]): ${outcome(() => signed.hasSignaturesFrom([]))}`,
      `verifySignaturesFrom([]): ${outcome(() => signed.verifySignaturesFrom([]))}`,
    ]).toMatchSnapshot();
  });
  it("format strings", () => {
    expect([
      `Function.known(5): ${outcome(() => new xp.Expression(xp.Function.known(5)).toEnvelope())}`,
      `format(NOTE, { context: "none" }): ${outcome(() => fmt.format(Envelope.knownValue(NOTE), { context: "none" }))}`,
      `ADD.toString(): ${outcome(() => String(xp.ADD))}`,
      `Response.failure(id).withError("e").summary(): ${outcome(() => xp.Response.failure(id).withError("e").summary())}`,
    ]).toMatchSnapshot();
  });
  it("acceptance", () => {
    const req = xp.Request.from(new xp.Expression(xp.Function.named("f")).withParameter("a", 1), id)
      .toEnvelope()
      .addAssertion("note", "x");
    expect([
      `Request.fromEnvelope(e).toEnvelope() digest equals: ${outcome(() => xp.Request.fromEnvelope(req).toEnvelope().digest().equals(req.digest()))}`,
      `wrapped expectSubject(expectText): ${outcome(() => Envelope.from("x").wrap().expectSubject(expectText))}`,
      `attachments() with a bogus 'attachment': ${outcome(() => Envelope.from("A").addAssertion("attachment", "bogus").attachments().length)}`,
      `addSalt({ salt: 4 bytes }): ${outcome(() => hello.addSalt({ salt: Salt.from(bytes(4)) }))}`,
      `encryptSubjectToRecipients([]): ${outcome(() => hello.encryptSubjectToRecipients([]))}`,
      `'signed' wrapping a non-signature → verify(pub): ${outcome(() => hello.addAssertion(SIGNED, Envelope.from("x").wrap()).verify(PrivateKeyBase.from(bytes(32, 5)).schnorrSigningPrivateKey().publicKey()))}`,
    ]).toMatchSnapshot();
  });
  it("the JavaScript input domain", () => {
    expect([
      `node(s, []): ${outcome(() => Envelope.node(hello, []))}`,
      `knownValue(-1): ${outcome(() => Envelope.knownValue(-1))}`,
      `setPosition(1.5): ${outcome(() => hello.setPosition(1.5).formatFlat())}`,
      `digests(1.5).size: ${outcome(() => hello.digests(1.5).size)}`,
      `addSalt({ length: 1.5 }): ${outcome(() => hello.addSalt({ length: 1.5 }))}`,
      `addSalt({ length: NaN }): ${outcome(() => hello.addSalt({ length: NaN }))}`,
      `lock(e, 99, pw): ${outcome(() => hello.lock(99 as never, bytes(4)))}`,
      `EnvelopeError has a private constructor: ${typeof (EnvelopeError as unknown as { prototype: { constructor: unknown } }).prototype.constructor}`,
    ]).toMatchSnapshot();
  });
});
