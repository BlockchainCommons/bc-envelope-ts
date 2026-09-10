# Changelog

## 1.0.0-beta.1

### Changed

- **API redesign.** The root entry is the core `Envelope` class; every extension is a subpath of envelope-first functions (`/signature`, `/recipient`, `/secret`, `/sskr`, `/proof`, `/attachment`, `/edge`, `/types`, `/expression`, `/seal`, `/format`), and `/all` installs them as methods. Constructors are `Envelope.from`/`leaf`/`wrap`/`assertion`/`node`/`knownValue`/`encrypted`/`compressed`/`elided` and the `NULL`/`TRUE`/`FALSE`/`UNIT` constants; `case` is a getter; throwing accessors are `expect*`; `elide(options)` replaces twelve variants; salt is a core member (`addSalt(options)`, `addAssertion(p, o, { salt })`); `toCbor`/`toUR`/`fromCbor`/`fromBytes`/`codec` are the codable surface; `ToEnvelope`/`EnvelopeInput` replace `EnvelopeEncodable`; `EnvelopeErrorCode` is a PascalCase string union. Format, signing, sskr, attachment and expression functions take options objects. See [MIGRATION.md](./MIGRATION.md).
- The format context carries the functions and parameters stores and registers its tags in the store it hands to the formatters, so annotated hex names its tags, tag-1 dates are summarised and well-known expression functions print by name, all as the Rust reference does.
- `Envelope.fromBytes` wraps CBOR decode failures in `EnvelopeError` (`Cbor`) with the `CborError` as `cause`.
- Ported to the canonical `@blockchaincommons/dcbor` and the redesigned `components`, `known-values`, `rand`, `crypto`, `sskr` and `uniform-resources`; every wire byte and every format string unchanged, verified against a frozen baseline and against `bc-envelope-rust` 0.43.0 (`tests/rust-validation`, see `RUST_DIVERGENCES.md`).

### Removed

- The hidden `Digest.prototype.short()` and `String.prototype.flankedBy()` patches (the root entry now has no side effects at all; `shortId` uses components' `shortDescription()`); `pako` and `@blockchaincommons/dcbor-compat` dependencies; the `/salt` subpath (salt is in the core); `EnvelopeDecoder`, the `EnvelopeCBORTagged*` wrappers, `registerXxxExtension()`, `VERSION`, `Result<T>`.

Extracted from the [`paritytech/bcts`](https://github.com/paritytech/bcts) monorepo, where this library was published as `@bcts/envelope`; see the appendix of [MIGRATION.md](./MIGRATION.md).

---

## History as `@bcts/envelope`

## [1.0.0-beta.6] - 2026-07-29

### Changed

- Workspace version bump

## [1.0.0-beta.5] - 2026-07-01

### Changed

- Workspace version bump

## [1.0.0-beta.4] - 2026-06-28

### Changed

- Dependency sync

## [1.0.0-beta.3] - 2026-06-22

### Changed

- Dependencies bump

## [1.0.0-beta.2] - 2026-06-16

### Changed

- Dependencies bump

## [1.0.0-beta.1] - 2026-05-27

### Changed

- Synced edge validation with `bc-envelope` v0.43.0 (BCR-2026-003): `Envelope.validateEdge()` now strictly rejects any assertion on an edge subject other than `'isA'`, `'source'`, and `'target'`, throwing `EDGE_UNEXPECTED_ASSERTION`. Previously extra assertions on the edge subject were silently ignored. Validation was rewritten from count-based to a single pass with inline duplicate detection.

### Fixed

- Signature formatting now renders the scheme for non-default schemes (e.g. `Signature(Ed25519)`); only the default scheme (Schnorr) renders as bare `Signature`. Previously Ed25519 signatures also rendered as bare `Signature`, diverging from Rust.

## [1.0.0-beta.0] - 2026-04-27

### Changed

- `format/diagnostic.ts` and `format/format-context.ts` aligned with upstream `bc-envelope`; format tests updated.

## [1.0.0-alpha.23] - 2026-04-24

### Changed

- Removed redundant type assertions in `Envelope.fromCbor` known-value branch, `makeSignedAssertion`, and the diagnostic formatter.

## [1.0.0-alpha.22] - 2026-03-01

### Changed

- Workspace version bump

## [1.0.0-alpha.21] - 2026-02-27

### Changed

- Workspace version bump

## [1.0.0-alpha.20] - 2026-02-12

### Added

- `EDGE_UNEXPECTED_ASSERTION` error code for strict edge validation (BCR-2026-003)
- `EnvelopeError.edgeUnexpectedAssertion()` factory method

### Changed

- **Breaking**: `validateEdge()` now rejects edges with any assertions beyond `isA`, `source`, and `target` (BCR-2026-003). Additional claim detail must be placed on target/source objects, not on the edge subject.
- Rewrote `validateEdge()` from count-based to single-pass predicate iteration using raw known-value constants

## [1.0.0-alpha.19] - 2026-02-05

### Changed

- Workspace version bump

## [1.0.0-alpha.18] - 2025-01-31

### Added

- **Edge extension** (`extension/edge.ts`): Full implementation of the edge extension for creating and managing edge envelopes (BCR-2026-003), matching the Rust `bc-envelope-rust` implementation
- **Edge test suite** (`tests/edge.test.ts`): Comprehensive tests for edge creation, queries, and formatting
- **Edge error codes**: `EDGE_MISSING_IS_A`, `EDGE_MISSING_SOURCE`, `EDGE_MISSING_TARGET`, `EDGE_DUPLICATE_IS_A`, `EDGE_DUPLICATE_SOURCE`, `EDGE_DUPLICATE_TARGET`, `NONEXISTENT_EDGE`, `AMBIGUOUS_EDGE`
- **Format context**: Tag-aware summarizers for all `@bcts/components` tag types (Digest, ARID, URI, UUID, Nonce, Salt, Seed, Signature, SealedMessage, EncryptedKey, PrivateKeyBase, PublicKeyBase, CID, XID, PrivateKeys, PublicKeys, Agreement, Password, ProvenanceMark)
- **Signature metadata**: `SigningOptions` type re-exported from `@bcts/components`

### Changed

- **Signature predicates**: `SIGNED` and `NOTE` now use canonical `KnownValue` instances from `@bcts/known-values` instead of plain strings, matching the Rust implementation. Envelope format output now renders `'signed'` and `'note'` (single-quoted known values) instead of `"signed"` and `"note"` (double-quoted strings)
- **Attachment predicates**: `ATTACHMENT`, `VENDOR`, and `CONFORMS_TO` now use `KnownValue` instances from `@bcts/known-values`, rendering as `'attachment'`, `'vendor'`, and `'conformsTo'` in format output
- **Module augmentation**: Replaced `declare module` blocks in `seal.ts` and `extension/sskr.ts` with `declare` field statements in the `Envelope` class body, eliminating `rolldown-plugin-dts` warnings about relative module paths
- **Signature extension**: Widened `SignatureMetadata` predicate types to accept `EnvelopeEncodableValue` (including `KnownValue`), matching Rust's `impl EnvelopeEncodable`
- **Attachment validation**: `validateAttachment` now uses digest-based comparison instead of `asText()` for predicate matching, matching the Rust approach
- **Test timeouts**: Increased timeout for Argon2id-based crypto tests to 30 seconds
