/**
 * Properties (Phase 0.3): CBOR round trip preserves digest and bytes;
 * equivalence is an equivalence relation; elide then unelide restores the
 * original; encrypt/decrypt and compress/decompress round-trip; adding then
 * removing an assertion restores the digest.
 */
import { describe, it } from "vitest";
import fc from "fast-check";
import { SymmetricKey } from "@blockchaincommons/components";
import { Envelope, envelopeFromBytes, envelopeToBytes } from "../src/index.js";
import "../src/all.js";

const leaf = fc.oneof(
  fc.string({ maxLength: 12 }).map((s) => Envelope.new(s)),
  fc.integer().map((n) => Envelope.new(n)),
  fc.uint8Array({ maxLength: 8 }).map((b) => Envelope.new(b)),
  fc.boolean().map((b) => Envelope.new(b)),
  fc.nat(700).map((v) => Envelope.newWithKnownValue(v)),
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

describe("envelope properties", () => {
  it("CBOR round trip preserves bytes and digest", () => {
    fc.assert(
      fc.property(tree, (e) => {
        const bytes = envelopeToBytes(e);
        const back = envelopeFromBytes(bytes);
        return (
          back.isIdenticalTo(e) && Buffer.from(envelopeToBytes(back)).equals(Buffer.from(bytes))
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
        const elided = e.elideRemovingSet(targets);
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
        const assertion = Envelope.newAssertion(p, o);
        if (e.isAssertion()) return true;
        const added = e.addAssertionEnvelope(assertion);
        return added.removeAssertion(assertion).digest().equals(e.digest());
      }),
      { numRuns: 40 },
    );
  });
});
