/**
 * Baseline vs working tree micro-benchmarks (Phase 2.3).
 *
 *   bun run build && bun bench/benchmark.mjs
 *
 * The baseline speaks the pre-redesign names; `api()` adapts the few calls
 * used here so both sides run the same work: a 1,000-assertion envelope,
 * its CBOR encode and decode, `format()`, eliding half the assertions, and
 * an ed25519 sign + verify.
 */
import * as baseline from "../tests/baseline/envelope-baseline.mjs";
import * as current from "../dist/all.mjs";
import * as components from "@blockchaincommons/components";
import * as baselineComponents from "../../bc-components-ts/tests/baseline/components-baseline.mjs";

const seed = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff);
const api = (m, redesigned) =>
  redesigned
    ? {
        from: (x) => m.Envelope.from(x),
        encode: (e) => e.toCbor().toData(),
        decode: (b) => m.Envelope.fromBytes(b),
        elide: (e, digests) => e.elide({ removing: digests }),
        key: () => components.PrivateKeyBase.from(seed).ed25519SigningPrivateKey(),
      }
    : {
        from: (x) => m.Envelope.new(x),
        encode: (e) => m.envelopeToBytes(e),
        decode: (b) => m.envelopeFromBytes(b),
        elide: (e, digests) => e.elideRemovingSet(new Set(digests)),
        key: () => baselineComponents.PrivateKeyBase.fromData(seed).ed25519SigningPrivateKey(),
      };

const time = (label, fn, iterations) => {
  fn();
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return [label, (performance.now() - t0) / iterations];
};

const run = (m, redesigned) => {
  const a = api(m, redesigned);
  const build = () => {
    let e = a.from("subject");
    for (let i = 0; i < 1000; i++) e = e.addAssertion(`predicate-${i}`, `object-${i}`);
    return e;
  };
  const big = build();
  const bytes = a.encode(big);
  const half = big.assertions().filter((_, i) => i % 2 === 0).map((x) => x.digest());
  const key = a.key();
  const pub = key.publicKey();
  const signed = big.sign(key);
  return [
    time("build 1,000 assertions", build, 5),
    time("encode", () => a.encode(big), 20),
    time("decode", () => a.decode(bytes), 20),
    time("format", () => big.format(), 20),
    time("elide half", () => a.elide(big, half), 5),
    time("sign + verify (ed25519)", () => big.sign(key).verifySignatureFrom(pub), 5),
  ].concat([["decode(encode) matches", a.decode(bytes).digest().equals(big.digest()) && signed.verifySignatureFrom(pub) !== undefined ? 1 : 0]]);
};

const before = run(baseline, false);
const after = run(current, true);
console.log(`${"operation".padEnd(28)} ${"baseline".padStart(10)} ${"current".padStart(10)} ${"ratio".padStart(7)}`);
for (let i = 0; i < before.length; i++) {
  const [label, b] = before[i];
  const c = after[i][1];
  console.log(`${label.padEnd(28)} ${b.toFixed(2).padStart(8)}ms ${c.toFixed(2).padStart(8)}ms ${(c / b).toFixed(2).padStart(6)}×`);
}
