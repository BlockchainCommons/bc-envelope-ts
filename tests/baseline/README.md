# Frozen baseline build

`envelope-baseline.mjs` is the self-contained ESM bundle of `@blockchaincommons/envelope` built from
commit `b7d92c8ae0fb7966fb05788309c10bf1fe7bd15f`, the pre-redesign wire-format reference. Sibling
`@blockchaincommons/*` packages are INLINED from their own frozen baseline
bundles (@blockchaincommons/crypto, @blockchaincommons/rand, @blockchaincommons/sskr, @blockchaincommons/tags, @blockchaincommons/known-values, @blockchaincommons/components, @blockchaincommons/uniform-resources, @blockchaincommons/shamir), so this bundle keeps the
pre-redesign behaviour of its dependencies after they change.
`envelope-baseline.d.mts` is the public surface at that commit (Phase 0.5).

`tests/differential.test.ts` runs every corpus recipe through this bundle and
the working tree and asserts identical outcomes; it pins the sha256 below so
an accidental rebuild cannot turn the differential into a self-comparison.

Baseline commit: b7d92c8ae0fb7966fb05788309c10bf1fe7bd15f
Baseline sha256: 26ea50fb38fe94016bec0deaf0ab0e2fb647061bf3930c6e7f99e3495905e676
