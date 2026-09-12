/**
 * Properties: CBOR round trip preserves digest and bytes;
 * equivalence is an equivalence relation; elide then unelide restores the
 * original; encrypt/decrypt and compress/decompress round-trip; adding then
 * removing an assertion restores the digest.
 */
import { describe, it } from "vitest";
import fc from "fast-check";
import { SymmetricKey } from "@blockchaincommons/components";
import { Envelope } from "../src/index.js";
import "../src/all.js";

const leaf = fc.oneof(
  fc.string({ maxLength: 12 }).map((s) => Envelope.from(s)),
  fc.integer().map((n) => Envelope.from(n)),
  fc.uint8Array({ maxLength: 8 }).map((b) => Envelope.from(b)),
  fc.boolean().map((b) => Envelope.from(b)),
  fc.nat(700).map((v) => Envelope.knownValue(v)),
);
const withAssertions = (inner: fc.Arbitrary<Envelope>): fc.Arbitrary<Envelope> =>
  fc
    .tuple(inner, fc.array(fc.tuple(leaf, inner), { maxLength: 3 }))
    .map(([subject, assertions]) => {
      let e = subject;
      for (const [p, o] of assertions) e = e.addAssertion(p, o);
      return e;
    });
const depth1 = fc.oneof(
  leaf,
  withAssertions(leaf),
  leaf.map((e) => e.wrap()),
);
const depth2 = fc.oneof(
  depth1,
  withAssertions(depth1),
  depth1.map((e) => e.wrap()),
);
const tree: fc.Arbitrary<Envelope> = fc.oneof(depth2, withAssertions(depth2));

const key = SymmetricKey.from(Uint8Array.from({ length: 32 }, (_, i) => i));

const hexOf = (b: Uint8Array): string => Buffer.from(b).toString("hex");

describe("envelope properties", () => {
  it("CBOR round trip preserves bytes and digest", () => {
    fc.assert(
      fc.property(tree, (e) => {
        const bytes = e.toCbor().toData();
        const back = Envelope.fromBytes(bytes);
        return (
          back.isIdenticalTo(e) && Buffer.from(back.toCbor().toData()).equals(Buffer.from(bytes))
        );
      }),
      { numRuns: 80 },
    );
  });
  it("isEquivalentTo is reflexive and agrees with digests", () => {
    fc.assert(
      fc.property(
        tree,
        tree,
        (a, b) => a.isEquivalentTo(a) && a.isEquivalentTo(b) === a.digest().equals(b.digest()),
      ),
      { numRuns: 60 },
    );
  });
  it("elide then unelide restores identity", () => {
    fc.assert(
      fc.property(tree, (e) => {
        const targets = new Set([...e.deepDigests()].filter((_, i) => i % 2 === 1));
        const elided = e.elide({ removing: targets });
        return elided.isEquivalentTo(e) && elided.unelide(e).isIdenticalTo(e);
      }),
      { numRuns: 40 },
    );
  });
  it("encrypt/decrypt and compress/decompress round-trip", () => {
    fc.assert(
      fc.property(tree, (e) => {
        const enc = e.encryptSubject(key);
        const comp = e.compressSubject();
        return (
          enc.isEquivalentTo(e) &&
          enc.decryptSubject(key).isIdenticalTo(e) &&
          comp.isEquivalentTo(e) &&
          comp.decompressSubject().isIdenticalTo(e)
        );
      }),
      { numRuns: 40 },
    );
  });
  it("adding then removing an assertion restores the digest", () => {
    fc.assert(
      fc.property(tree, leaf, leaf, (e, p, o) => {
        const assertion = Envelope.assertion(p, o);
        if (e.isAssertion()) return true;
        const added = e.addAssertionEnvelope(assertion);
        return added.removeAssertion(assertion).digest().equals(e.digest());
      }),
      { numRuns: 40 },
    );
  });
});

describe("immutability properties", () => {
  it.todo(
    "fromBytes(toCbor(e)) is identical to e for every envelope the corpus can produce (would have caught B3/B6)",
  );
  it.todo("addAssertion is idempotent: adding the same assertion twice equals adding it once (B2)");
  it("no public accessor returns a value whose mutation changes toCbor() (B5)", () => {
    fc.assert(
      fc.property(tree, fc.uint8Array({ minLength: 1, maxLength: 8 }), (e, raw) => {
        const before = hexOf(e.toCbor().toData());
        const digest = e.digest().toHex();
        // the assertions list is frozen
        const list = e.assertions() as unknown as { push(x: unknown): number };
        let pushThrew = false;
        try {
          list.push(Envelope.assertion("x", "y"));
        } catch {
          pushThrew = true;
        }
        if (e.isNode() && !pushThrew) return false;
        // leaf views are copies
        const bytes = Envelope.from(raw);
        const view = bytes.asBytes();
        if (view !== undefined) view[0] ^= 0xff;
        if (hexOf(bytes.toCbor().toData()) !== hexOf(Envelope.from(raw).toCbor().toData()))
          return false;
        const arr = Envelope.leaf([1, 2]).asArray() as unknown as { push(x: unknown): number };
        arr.push(3);
        if (Envelope.leaf([1, 2]).asArray()?.length !== 2) return false;
        return hexOf(e.toCbor().toData()) === before && e.digest().toHex() === digest;
      }),
      { numRuns: 40 },
    );
  });
  it.todo(
    "every error thrown by the package is an EnvelopeError (B1's leaked ComponentsError, §3's RangeError/TypeError)",
  );
});
