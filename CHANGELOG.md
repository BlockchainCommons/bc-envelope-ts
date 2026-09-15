# Changelog

## 1.0.0-beta.3 - 2026-09-15

### Changed (breaking)

- **Format context registration.** The global format context is created on
  first use with a snapshot of the tag store (bc-tags names and the
  components summarisers), the known-values registry and the expression
  stores, as the reference's `LazyFormatContext::get` does; the envelope
  summarisers (known values, functions, parameters, requests, responses,
  events) are installed only by the new `registerTags()` (or
  `registerTagsIn(context)` for a custom context), as the reference's
  `bc_envelope::register_tags()`. Until then a request prints
  `40004(ARID(…))` and a function leaf `40006(1)`. A tag or known value
  registered after the context exists is not seen by it (`hex()` still
  names it through dcbor's live store).
- **Known-value notation.** A known value prints its own name when the
  context does not name it (`'custom'` for an in-memory
  `KnownValue(9999, "custom")`, `'25'` after a round trip), and `''name''`
  under `context: "none"`, exactly as the reference does. The tag-40000
  summariser reports a decode failure as `<error: …>` and a negative
  content as the wrapped codepoint (`'18446744073709551615'`).
- **Byte-order sorts.** Node assertions sort by digest bytes (no
  `localeCompare`: the node `"s" [ "k": 337, "k": 1 ]` has the reference's
  digest under every host locale), and format items sort by code point
  (`"｡"` before `"😀"`).
- **Decode errors mirror `dcbor::Error`.** `Envelope.fromBytes`, `fromCbor`,
  `fromUntaggedCbor`, `codec.decode` and `Expression.fromEnvelope` throw
  `Cbor` whose message is the reference's dcbor message with no prefix
  (`early end of CBOR data`, `expected CBOR tag envelope, but got 201`,
  `unknown envelope tag: 40000`, `node must have at least two elements`,
  `invalid envelope`) and whose `cause` is the `CborError` with the
  reference's variant; the new `EnvelopeError.cborDecode(cause)` builds it.
  Sites where the reference converts into its own `Error::Cbor`
  (`decryptSubject`, `decompress`, the sealed content key,
  `Request`/`Event`/`Response.fromEnvelope`, subject extraction) read
  `dcbor error: <message>`. The texts `invalid envelope` (for a dcbor
  failure), `failed to decode subject`, `envelope does not contain a …`,
  `invalid content key`, `AEAD error`, `decompression failed`, `could not
  lock the content key` and `signing failed` are gone; components failures
  carry the components message (`components error: cryptographic operation
  failed: …`).
- **Subject extraction follows the reference's type rule.**
  `expectSubject(decoder)` on a wrapped, known-value, elided, encrypted or
  compressed subject returns that subject's own `Envelope`, `KnownValue`
  (name preserved), `Digest`, `EncryptedMessage` or `Compressed` when the
  decoder returns an instance of that class, else `InvalidFormat`; an
  assertion subject is always `InvalidFormat`. `isTrue`, `isFalse`,
  `isBool` and `isNull` extract the subject (a node whose subject is `true`
  is true). `expectString`, `expectNumber`, `expectBoolean`, `expectBytes`
  and `expectNull` stay leaf-only (`NotLeaf`), and `expectNumber` is the
  reference's exact `f64`: `2^53 + 1` throws `Cbor` (`OutOfRange`) instead
  of rounding. `Request`/`Event` notes and attachment vendors are read by
  subject extraction (a node object works; a wrapped one is
  `InvalidFormat`).
- **`u64` ids and positions.** `Function.known`, `Parameter.known`,
  `Parameter.from` and `setPosition` accept `number | bigint` up to
  `2^64 − 1`; `value` and `position()` return a `number` up to `2^53 − 1`
  and a `bigint` above; `valueBigInt` is exact. `FunctionID` and
  `ParameterID` are `number | bigint | string`. A negative, fractional or
  unsafe number is `InvalidParameter` (`… must be an integer in [0,
  9007199254740991] or a bigint in [0, 18446744073709551615], got …`).
  `position()` wraps negative content as the reference's `usize` does.
- **Expressions.** Parameter lookups (`parameter`, `objectsForParameter`,
  `hasParameter`, the new `objectForParameter`) query the expression's
  envelope; a numeric id no longer matches a string one; an undecodable
  function content is `Cbor` `dcbor error: invalid function`, a non-leaf
  body `dcbor error: invalid format`, and a function mismatch prints the
  reference's `Debug` (`Expected function Known(1, Some(Static("add"))),
  but found Named(Dynamic("f"))`).
- **Request and Event dates keep their precision.** Both store a
  `CborDate`: `withDate(Date | CborDate)`, `date` stays a millisecond
  `Date` view, the new `cborDate` getter is exact, and a decoded request
  or event re-encodes with the reference's date bytes and digest.
  `Request.equals` and `Event.equals` compare the exact date and the body.
- **Error texts.** `abiguous attachment` (the reference's spelling),
  `invalid attachment` (no detail), `the subject of the envelope is not the
  unit value`, `general error: Expected an ID`; attachment validation runs
  in the reference's order.
- **Salt lengths** below 8 and inverted ranges are `Components` (the
  reference's components error) instead of `InvalidParameter`; the
  non-integer checks stay.
- **The `Encrypt` elision action** encrypts an encrypted or elided target,
  as the reference does; `Compress` on one still throws.
- **`sskrSplit`** wraps an sskr failure as `Sskr` (`sskr error: SSKR Shamir
  error: invalid threshold`).
- **Verifier exceptions propagate**: a `Verifier` whose `verify` throws no
  longer becomes `InvalidSignatureType`.
- **Removed:** `Envelope.elideSetWithAction` (use `elide({ revealing,
  action })`) and the exported `encryptWholeEnvelope`.
- Dependency floors: every `@blockchaincommons/*` dependency at
  `^1.0.0-beta.3`.

### Added

- `registerTags()` on `/format` and `/all`.
- SSH-agent locking: `lockWith`, `lockSubjectWith`, `unlockWith`,
  `unlockSubjectWith(envelope, agent, id, …)` (async, `SshAgent` from
  components: `MemorySshAgent` in tests, the Node transport in
  `@blockchaincommons/components/ssh-agent-node`), the reference's
  `KeyDerivationMethod::SSHAgent` lock and unlock with the agent injected.
  The synchronous `lock`/`addSecret` with `SSHAgent` keep throwing
  `Components`.
- `seal(envelope, sender, recipient, { signing, metadata, nonce, rng })` and
  `encryptToRecipient(envelope, recipient, { nonce, rng })`.
- `Function`/`Parameter`: `fromCbor`, `fromUntaggedCbor`, `codec`,
  `toCbor`, `valueBigInt`; `Expression.objectForParameter`.
- `EnvelopeError.cborDecode(cause)`.
- A `KnownValue` from another copy of the known-values package (CommonJS
  and ESM in one process) builds the known-value case
  (`KnownValue.isKnownValue`).

## 1.0.0-beta.2 - 2026-09-12

The review against `bc-envelope-rust` 0.43.0 corrected text summaries and
debug renderings without changing the envelope wire format.

### Changed

- **Text summaries truncate as the reference does.** `summary`, tree lines
  and mermaid labels decide whether to truncate by the text's **UTF-8 byte
  length** and cut by **whole characters** (`envelope_summary.rs`:
  `string.len() > max_length`, then `chars().take(max_length)`), where the
  port counted UTF-16 units for both. A non-ASCII text can therefore gain
  an `…` without losing a character, exactly as the reference prints it;
  ASCII text is unchanged.
- **Debug renderings print the reference's `Display`.**
  `Function.toString()` / `Parameter.toString()` give the assigned name or
  the number (`add`, `99`) and the name in quotes for a named one
  (`"greet"`), not `«1»` / `❰2❱` — those forms belong to the format
  strings, where the format context still prints them on both sides.
  `Expression.toString()` is the quoted format string (the reference's
  `{:?}` of `format()`). `Response.summary()` writes `id: X error: E`
  (no comma) on the failure branches, as the reference does; the success
  branch is unchanged. `bc-gstp-ts`, which embeds `summary()`, prints what
  `gstp-rust` prints.
- The `Expression.fromEnvelope` mismatch message reads
  `expected function add, but found sub` (it used the `«…»` form).

## 1.0.0-beta.1 - 2026-09-09

Initial beta implementation.