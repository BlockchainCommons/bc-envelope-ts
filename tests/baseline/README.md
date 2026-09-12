# Frozen baseline build

`envelope-baseline.mjs` is the self-contained ESM bundle of `@blockchaincommons/envelope` built from
commit `b7d92c8ae0fb7966fb05788309c10bf1fe7bd15f`, the pre-redesign wire-format reference. Siblings
`@blockchaincommons/crypto`, `@blockchaincommons/rand`, `@blockchaincommons/uniform-resources`,
`@blockchaincommons/tags`, `@blockchaincommons/known-values` and `@blockchaincommons/components`
are INLINED from their own frozen baseline bundles, and the pre-redesign
`@blockchaincommons/dcbor-compat` is INLINED directly, so this bundle keeps the pre-redesign
behaviour of its dependencies after they change.
`envelope-baseline.d.mts` is the public surface at that commit.

`rand-baseline.mjs`, `sskr-baseline.mjs` and `components-baseline.mjs` are additionally vendored
here as standalone copies of those packages' own frozen baselines: `tests/vectors/deps.ts` calls
their exported API directly (to build keys, ids, specs and RNGs for the differential adapters),
which the envelope bundle does not re-export even where it inlines the same code internally.

`tests/differential.test.ts` runs every corpus recipe through this bundle and
the working tree and asserts identical outcomes; it pins the sha256 below so
an accidental rebuild cannot turn the differential into a self-comparison.

Baseline commit: b7d92c8ae0fb7966fb05788309c10bf1fe7bd15f
Baseline sha256: d5347de6e6cec9b04d3d6344f7d43b1767047bfe9e5ef9b3046a600d5958543a
