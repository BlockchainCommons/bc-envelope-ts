# Divergences from the Rust reference implementation

This library is a TypeScript port of
[`BlockchainCommons/bc-envelope-rust`](https://github.com/BlockchainCommons/bc-envelope-rust),
tracked at version **0.43.0**
([`bae6880`](https://github.com/BlockchainCommons/bc-envelope-rust/commit/bae6880035bcd14c0d149d4eb42082b0069edb83)).

The tracked version and commit are recorded in
[`.github/versions.yml`](./.github/versions.yml), and the `upstream.yml`
workflow opens a tracking issue whenever the reference implementation moves
ahead of it.

This document is the deliberate record of every place the TypeScript behaviour
differs from the Rust reference. It has three kinds of entry:

1. **True behavioral divergences** - the same input produces a different outcome.
2. **JS-only input domain** - inputs that have no Rust analog, so there is nothing to diverge from.
3. **Mapping equivalences** - JS-specific inputs that are validated through the bytes they produce.

Every entry below is checked by `tests/rust-validation`, a Rust program that
pins `bc-envelope = 0.43.0` and replays `tests/vectors/vectors.json` through
the reference, building each recipe with the reference's own API. The
current run: **150 vectors — 137 match, 13 expected divergences, 0
mismatches.**

## 1. True behavioral divergences

### D1. Compressed bytes (2 vectors)

Compression goes through components' `Compressed`, whose pako stream differs
from the reference's miniz_oxide stream (components D3). The digest tree,
`format`, `formatFlat`, `treeFormat`, `mermaidFormat` and `summary` match;
`cbor`, `ur`, `diagnostic` and annotated `hex` differ in the compressed
payload bytes. Both sides decompress each other's output.

### D2. Registry names in format strings (1 vector)

The TypeScript known-values registry names codepoints the reference's format
context does not (the bundled JSON registries): `'Self'` for 706 where the
reference prints `'706'`. Every codepoint both know prints identically.

### D3. Summary truncation counts characters (1 vector)

Leaf summaries (`summary`, `mermaidFormat` labels) and the diagnostic
line-breaking threshold count **characters** in TypeScript and **bytes** in
the reference, so a non-ASCII text leaf can be truncated or wrapped
differently: `"unicode ✓ ☺ 日本"` is cut to `"unicode ✓ ☺ 日本…"` by the
reference and shown whole here. ASCII text is identical.

### Resolved in Phase 3 W7

- **P1, annotated hex without tag names (125 vectors).** `hex()` printed
  `# tag(200)` where the reference prints `# tag(200) envelope`: the tags
  package registered the BC tags in *its own* copy of dcbor's global store
  when a consumer's install resolved two copies. The global format context
  now registers into the dcbor store it hands to the annotator
  (`registerTags(getGlobalTagsStore())`). Differential tombstone T2.
- **P2, tag-1 dates not summarised (1 vector).** The same registration
  installs dcbor's standard-tag summarisers, so a `date` assertion prints
  `2022-07-11T04:00:00Z` as the reference does. Tombstone T3.
- **P3, well-known expression names.** The format context now carries the
  functions and parameters stores, so a request for known function 1 with
  known parameters 2 and 3 prints `«add» [ ❰lhs❱: 2 ❰rhs❱: 3 ]` as the
  reference does (it printed the ids). Pinned by the `request:1` vector;
  tombstone T4.

## 2. JS-only input domain

_None. The recipe language only exercises what both sides implement._

## 3. Mapping equivalences

- **Error taxonomy (`E1`, 9 vectors).** Both sides reject malformed CBOR,
  UR strings with bad checksums or the wrong type; the reference reports
  dcbor/bc-ur errors, TypeScript a `CborError` or a `URError` code. The
  harness requires both to reject.
- **Randomised outputs.** Nonces (encryption), ephemeral keys (recipients),
  KDF salts (locking) and Schnorr aux randomness make bytes or digests vary
  per run; those recipes pin only the stable outputs (`digest` and the
  format strings, or the format strings alone), on both sides.

## Maintenance

When the upstream reference moves:

1. Review the diff via the link in the `upstream.yml` tracking issue.
2. Port the relevant changes.
3. Update `.github/versions.yml` with the new version and commit.
4. Update the tracked version at the top of this file.
5. Add, amend, or remove divergence entries as the port requires.
