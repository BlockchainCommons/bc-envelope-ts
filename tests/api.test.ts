/**
 * The core surface: constructors and constants, the case
 * getter, the expect* grammar, elide options, salt options, codable
 * members, error codes and the `pipe` bridge.
 */
import { describe, it, expect } from "vitest";
import { decodeCbor, expectNumber, expectText, Tag } from "@blockchaincommons/dcbor";
import { SymmetricKey, Digest } from "@blockchaincommons/components";
import { SeededRng } from "@blockchaincommons/rand";
import { UR, decodeURWith } from "@blockchaincommons/uniform-resources";
import { IS_A, NOTE, SALT, UNIT, KnownValue } from "@blockchaincommons/known-values";
import {
  Envelope,
  EnvelopeError,
  EnvelopeErrorCode,
  ObscureType,
  FormatContext,
  isToEnvelope,
  type ToEnvelope,
  attachments,
  expectAttachment,
} from "../src/all.js";

const alice = Envelope.from("Alice").addAssertion("knows", "Bob").addAssertion("knows", "Carol");

describe("constructors and constants", () => {
  it("from accepts every EnvelopeInput", () => {
    expect(Envelope.from("x").expectString()).toBe("x");
    expect(Envelope.from(42).expectNumber()).toBe(42);
    expect(Envelope.from(true).expectBoolean()).toBe(true);
    expect(Envelope.from(null).isNull()).toBe(true);
    expect(Envelope.from(new Uint8Array([1, 2])).expectBytes()).toEqual(new Uint8Array([1, 2]));
    expect(Envelope.from(IS_A).expectKnownValue().value).toBe(IS_A.value);
    expect(Envelope.from(alice)).toBe(alice);
    const custom: ToEnvelope = { toEnvelope: () => Envelope.from("custom") };
    expect(isToEnvelope(custom)).toBe(true);
    expect(isToEnvelope({})).toBe(false);
    expect(Envelope.from(custom).expectString()).toBe("custom");
  });

  it("the constants are lazy singletons with the reference digests", () => {
    expect(Envelope.NULL).toBe(Envelope.NULL);
    expect(Envelope.TRUE.expectBoolean()).toBe(true);
    expect(Envelope.FALSE.expectBoolean()).toBe(false);
    expect(Envelope.UNIT.expectKnownValue().value).toBe(UNIT.value);
    expect(Envelope.NULL.format()).toBe("null");
    expect(Envelope.UNIT.format()).toBe("''");
  });

  it("fromOptional, leaf, wrap, assertion, node, knownValue, elided", () => {
    expect(Envelope.fromOptional(undefined)).toBeUndefined();
    expect(Envelope.fromOptional("x")?.expectString()).toBe("x");
    expect(Envelope.leaf(decodeCbor(new Uint8Array([0x01]))).expectNumber()).toBe(1);
    expect(Envelope.wrap("x").unwrap().expectString()).toBe("x");
    const a = Envelope.assertion("knows", "Bob");
    expect(a.expectPredicate().expectString()).toBe("knows");
    expect(a.expectObject().expectString()).toBe("Bob");
    const n = Envelope.node(Envelope.from("Alice"), [a]);
    expect(n.format()).toBe('"Alice" [\n    "knows": "Bob"\n]');
    expect(() =>
      Envelope.node(Envelope.from("Alice"), [Envelope.from("not an assertion")]),
    ).toThrow(EnvelopeError);
    const salted = a.addSalt({ rng: SeededRng.forTesting() });
    expect(
      Envelope.node(Envelope.from("Alice"), [salted], { unchecked: true }).assertions().length,
    ).toBe(1);
    expect(Envelope.knownValue(NOTE).expectKnownValue().value).toBe(NOTE.value);
    expect(Envelope.elided(alice.digest()).isElided()).toBe(true);
  });

  it("case is a getter that narrows on type", () => {
    const c = alice.case;
    expect(c.type).toBe("node");
    if (c.type === "node") expect(c.assertions.length).toBe(2);
    expect(Envelope.from("x").case.type).toBe("leaf");
    expect(Envelope.wrap("x").case.type).toBe("wrapped");
  });
});

describe("expect* grammar", () => {
  it("throws EnvelopeError with a typed code", () => {
    const check = (f: () => unknown, code: EnvelopeErrorCode): void => {
      try {
        f();
      } catch (e) {
        expect(e).toBeInstanceOf(EnvelopeError);
        expect((e as EnvelopeError).code).toBe(code);
        return;
      }
      throw new Error("expected a throw");
    };
    check(() => alice.expectLeaf(), "NotLeaf");
    check(() => alice.expectAssertion(), "NotAssertion");
    check(() => alice.expectPredicate(), "NotAssertion");
    check(() => alice.expectObject(), "NotAssertion");
    check(() => alice.expectKnownValue(), "NotKnownValue");
    check(() => alice.unwrap(), "NotWrapped");
    check(() => alice.objectForPredicate("knows"), "AmbiguousPredicate");
    check(() => alice.objectForPredicate("nope"), "NonexistentPredicate");
    check(() => Envelope.from("x").expectNumber(), "Cbor");
    check(() => Envelope.from(1).expectString(), "Cbor");
    check(() => Envelope.from(1).expectBoolean(), "Cbor");
    check(() => Envelope.from(1).expectBytes(), "Cbor");
    check(() => Envelope.from(1).expectNull(), "Cbor");
    expect(alice.expectSubject((c) => expectText(c))).toBe("Alice");
    expect(Envelope.wrap("x").isWrapped()).toBe(true);
  });

  it("predicate queries with and without decoders", () => {
    const e = Envelope.from("Alice").addAssertion("age", 30).addAssertion("name", "Alice");
    expect(e.objectForPredicate("age").expectNumber()).toBe(30);
    expect(e.optionalObjectForPredicate("nope")).toBeUndefined();
    expect(e.objectsForPredicate("age").length).toBe(1);
    expect(e.expectObjectForPredicate("age", (c) => Number(expectNumber(c)))).toBe(30);
    expect(e.optionalObjectForPredicateAs("nope", (c) => Number(expectNumber(c)))).toBeUndefined();
    expect(e.optionalObjectForPredicateAs("age", (c) => Number(expectNumber(c)))).toBe(30);
    expect(e.objectForPredicateOr("nope", (c) => Number(expectNumber(c)), 7)).toBe(7);
    expect(e.objectForPredicateOr("age", (c) => Number(expectNumber(c)), 7)).toBe(30);
    expect(e.expectObjectsForPredicate("age", (c) => Number(expectNumber(c)))).toEqual([30]);
    expect(e.expectObjectsForPredicate("nope", (c) => Number(expectNumber(c)))).toEqual([]);
    expect(() => e.expectObjectsForPredicate("name", (c) => Number(expectNumber(c)))).toThrow(
      EnvelopeError,
    );
  });

  it("every error factory carries its code", () => {
    const factories: [string, EnvelopeErrorCode][] = [
      ["alreadyElided", "AlreadyElided"],
      ["ambiguousPredicate", "AmbiguousPredicate"],
      ["invalidDigest", "InvalidDigest"],
      ["invalidFormat", "InvalidFormat"],
      ["missingDigest", "MissingDigest"],
      ["nonexistentPredicate", "NonexistentPredicate"],
      ["notWrapped", "NotWrapped"],
      ["notLeaf", "NotLeaf"],
      ["notAssertion", "NotAssertion"],
      ["invalidAssertion", "InvalidAssertion"],
      ["invalidAttachment", "InvalidAttachment"],
      ["nonexistentAttachment", "NonexistentAttachment"],
      ["ambiguousAttachment", "AmbiguousAttachment"],
      ["edgeMissingIsA", "EdgeMissingIsA"],
      ["edgeMissingSource", "EdgeMissingSource"],
      ["edgeMissingTarget", "EdgeMissingTarget"],
      ["edgeDuplicateIsA", "EdgeDuplicateIsA"],
      ["edgeDuplicateSource", "EdgeDuplicateSource"],
      ["edgeDuplicateTarget", "EdgeDuplicateTarget"],
      ["edgeUnexpectedAssertion", "EdgeUnexpectedAssertion"],
      ["nonexistentEdge", "NonexistentEdge"],
      ["ambiguousEdge", "AmbiguousEdge"],
      ["alreadyCompressed", "AlreadyCompressed"],
      ["notCompressed", "NotCompressed"],
      ["alreadyEncrypted", "AlreadyEncrypted"],
      ["notEncrypted", "NotEncrypted"],
      ["notKnownValue", "NotKnownValue"],
      ["unknownRecipient", "UnknownRecipient"],
      ["unknownSecret", "UnknownSecret"],
      ["unverifiedSignature", "UnverifiedSignature"],
      ["invalidOuterSignatureType", "InvalidOuterSignatureType"],
      ["invalidInnerSignatureType", "InvalidInnerSignatureType"],
      ["unverifiedInnerSignature", "UnverifiedInnerSignature"],
      ["invalidSignatureType", "InvalidSignatureType"],
      ["invalidShares", "InvalidShares"],
      ["invalidType", "InvalidType"],
      ["ambiguousType", "AmbiguousType"],
      ["subjectNotUnit", "SubjectNotUnit"],
      ["unexpectedResponseId", "UnexpectedResponseId"],
      ["invalidResponse", "InvalidResponse"],
    ];
    const statics = EnvelopeError as unknown as Record<string, () => EnvelopeError>;
    for (const [name, code] of factories) {
      const err = statics[name]();
      expect(err.code, name).toBe(code);
      expect(EnvelopeErrorCode[code]).toBe(code);
      expect(err.message.length).toBeGreaterThan(0);
    }
    const cause = new Error("inner");
    expect(EnvelopeError.cbor("bad", cause).cause).toBe(cause);
    expect(EnvelopeError.components("bad").code).toBe("Components");
    expect(EnvelopeError.sskr("bad").code).toBe("Sskr");
    expect(EnvelopeError.general("bad").code).toBe("General");
    expect(EnvelopeError.general("bad").is("General")).toBe(true);
    expect(EnvelopeError.isEnvelopeError(EnvelopeError.general("bad"))).toBe(true);
    expect(EnvelopeError.isEnvelopeError(new Error("bad"))).toBe(false);
    const p = EnvelopeError.invalidParameter("position", "a non-negative integer", 1.5);
    expect(p.details).toEqual({
      code: "InvalidParameter",
      parameter: "position",
      expected: "a non-negative integer",
      value: 1.5,
    });
  });
});

describe("elide options", () => {
  const bob = alice.assertionsWithPredicate("knows")[0];
  it("removing and revealing by digest or provider", () => {
    expect(alice.elide().isElided()).toBe(true);
    const removed = alice.elide({ removing: [bob] });
    expect(removed.assertions().filter((a) => a.isElided()).length).toBe(1);
    const removedByDigest = alice.elide({ removing: new Set([bob.digest()]) });
    expect(removedByDigest.isEquivalentTo(removed)).toBe(true);
    const revealed = alice.elide({ revealing: [alice, alice.subject(), bob] });
    expect(revealed.subject().isElided()).toBe(false);
    expect(revealed.assertions().filter((a) => a.isElided()).length).toBe(1);
    expect(revealed.isEquivalentTo(alice)).toBe(true);
    // an equal Digest from other bytes is found by value, not identity
    const copy = Digest.from(bob.digest().bytes);
    expect(alice.elide({ removing: [copy] }).isEquivalentTo(removed)).toBe(true);
  });

  it("compress and encrypt actions", () => {
    const compressed = alice.elide({ removing: [bob], action: "compress" });
    expect(compressed.assertions().filter((a) => a.isCompressed()).length).toBe(1);
    expect(compressed.isEquivalentTo(alice)).toBe(true);
    const key = SymmetricKey.random({ rng: SeededRng.forTesting() });
    const encrypted = alice.elide({ removing: [bob], action: { encrypt: key } });
    expect(encrypted.assertions().filter((a) => a.isEncrypted()).length).toBe(1);
    expect(encrypted.isEquivalentTo(alice)).toBe(true);
    expect(ObscureType.Encrypted).toBe("encrypted");
    expect(alice.nodesMatching(undefined, [ObscureType.Elided]).size).toBe(0);
    expect(encrypted.nodesMatching(undefined, [ObscureType.Encrypted]).size).toBe(1);
  });
});

describe("salt", () => {
  const rng = SeededRng.forTesting();
  it("addSalt options", () => {
    const e = Envelope.from("x");
    expect(e.addSalt({ rng }).assertionsWithPredicate(SALT).length).toBe(1);
    expect(e.addSalt({ length: 16, rng }).objectForPredicate(SALT).format()).toContain("Salt");
    const fixed = new Uint8Array(12).fill(7);
    expect(
      e
        .addSalt({ salt: fixed })
        .digest()
        .equals(e.addSalt({ salt: fixed }).digest()),
    ).toBe(true);
    expect(e.addSalt({ range: { min: 8, max: 9 }, rng }).assertionsWithPredicate(SALT).length).toBe(
      1,
    );
    expect(() => e.addSalt({ length: 4 })).toThrow(EnvelopeError);
    // A caller-supplied salt is taken as is (the reference's `add_salt_instance`).
    expect(e.addSalt({ salt: new Uint8Array(2) }).assertionsWithPredicate(SALT).length).toBe(1);
    expect(() => e.addSalt({ range: { min: 2, max: 9 } })).toThrow(EnvelopeError);
    expect(() => e.addSalt({ range: { min: 10, max: 9 } })).toThrow(EnvelopeError);
  });

  it("salted assertions", () => {
    const e = Envelope.from("Alice").addAssertion("knows", "Bob", { salt: true });
    const a = e.assertions()[0];
    expect(a.isSubjectAssertion()).toBe(true);
    expect(a.assertionsWithPredicate(SALT).length).toBe(1);
    const e2 = Envelope.from("Alice").addAssertionEnvelope(Envelope.assertion("knows", "Bob"), {
      salt: true,
    });
    expect(e2.digest().equals(e.digest())).toBe(false);
    expect(
      Envelope.from("Alice").addOptionalAssertion("knows", undefined, { salt: true }).isLeaf(),
    ).toBe(true);
    expect(
      Envelope.from("Alice")
        .addOptionalAssertionEnvelope(Envelope.assertion("knows", "Bob"), { salt: true })
        .assertions()[0]
        .assertionsWithPredicate(SALT).length,
    ).toBe(1);
  });
});

describe("codable", () => {
  it("codec, toCbor, toUR, fromCbor, fromBytes", () => {
    const cbor = alice.toCbor();
    expect(Envelope.codec.tags?.map((t) => Number(t.value))).toEqual([200]);
    expect(Envelope.fromCbor(cbor).digest().equals(alice.digest())).toBe(true);
    expect(Envelope.codec.decode(cbor).digest().equals(alice.digest())).toBe(true);
    // Tagged-only, like every codec in the stack (open question 3): the untagged form is `Cbor`.
    expect(() => Envelope.codec.decode(alice.untaggedCbor())).toThrow(EnvelopeError);
    expect(Envelope.fromBytes(cbor.toData()).digest().equals(alice.digest())).toBe(true);
    expect(alice.cborTags().map((t) => Number(t.value))).toEqual([200]);
    const ur = alice.toUR();
    expect(ur.toString().startsWith("ur:envelope/")).toBe(true);
    expect(
      decodeURWith(UR.parse(ur.toString()), Envelope.codec).digest().equals(alice.digest()),
    ).toBe(true);
    expect(() => Envelope.fromBytes(new Uint8Array([0xff]))).toThrow(EnvelopeError);
    expect(() => Envelope.fromCbor(decodeCbor(new Uint8Array([0x01])))).toThrow(EnvelopeError);
  });
});

describe("pipe and format options", () => {
  it("pipe applies a subpath function", () => {
    const upper = (e: Envelope, suffix: string): string => e.expectString().toUpperCase() + suffix;
    expect(Envelope.from("x").pipe(upper, "!")).toBe("X!");
  });

  it("format, hex, diagnostic, summary options", () => {
    expect(alice.format({ flat: true })).toBe('"Alice" [ "knows": "Bob", "knows": "Carol" ]');
    expect(alice.formatFlat()).toBe(alice.format({ flat: true }));
    expect(alice.hex({ annotate: false })).toBe(alice.toCbor().toHex());
    expect(alice.hex()).toContain("# tag(200) envelope");
    expect(alice.hex({ context: "none" })).toContain("# tag(200)\n");
    expect(alice.diagnostic()).toContain("200(");
    expect(alice.diagnostic({ annotate: true })).toContain("envelope");
    expect(Envelope.from("a".repeat(50)).summary({ maxLength: 10 }).length).toBeLessThan(20);
    expect(Envelope.from(IS_A).summary()).toBe("'isA'");
    // A summary with no context prints the codepoint (the reference looks the
    // raw value up in an empty store); notation with no context flanks the
    // value's own name twice, as the reference's `FormatContextOpt::None` arm does.
    expect(Envelope.from(IS_A).summary({ context: "none" })).toBe("'1'");
    const ctx = new FormatContext();
    ctx.tags.register(Tag.from(200, "custom"));
    ctx.knownValues.register(new KnownValue(1, "alias"));
    expect(alice.hex({ context: ctx })).toContain("# tag(200) custom");
    expect(Envelope.from(IS_A).format({ context: ctx })).toBe("'alias'");
    expect(Envelope.from(IS_A).format({ context: "none" })).toBe("''isA''");
    // a clone copies every store
    expect(ctx.clone().tags).not.toBe(ctx.tags);
    expect(ctx.clone().tags.nameForValue(200)).toBe("custom");
  });
});

describe("attachments filter", () => {
  const e = Envelope.from("doc")
    .addAttachment("a", "com.example", "https://example.com/v1")
    .addAttachment("b", "com.example", "https://example.com/v2")
    .addAttachment("c", "com.other");
  it("filters by vendor and conformsTo", () => {
    expect(attachments(e).length).toBe(3);
    expect(e.attachments({ vendor: "com.example" }).length).toBe(2);
    expect(e.attachments({ conformsTo: "https://example.com/v2" }).length).toBe(1);
    expect(
      expectAttachment(e, { vendor: "com.example", conformsTo: "https://example.com/v1" })
        .attachmentPayload()
        .expectString(),
    ).toBe("a");
    expect(() => e.expectAttachment({ vendor: "com.example" })).toThrow(EnvelopeError);
    expect(() => e.expectAttachment({ vendor: "com.none" })).toThrow(EnvelopeError);
  });
});
