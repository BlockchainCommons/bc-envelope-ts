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
the reference, building each recipe with the reference's own API and
comparing the outputs — and, for rejections, the **error codes** (a thrown
reference variant is reported in SCREAMING_SNAKE_CASE, which is what the
port's `EnvelopeError.code` spells). The current run: **213 vectors — 186
match, 12 expected divergences (D1 2, D2 1, E1 9), 15 JS-only, 0
mismatches.**

## 1. True behavioral divergences

### D1. Compressed bytes (2 vectors)

Compression goes through components' `Compressed`, whose pako stream differs
from the reference's miniz_oxide stream (components D3). The digest tree,
`format`, `formatFlat`, `treeFormat`, `mermaidFormat` and `summary` match;
`cbor`, `ur`, `diagnostic` and annotated `hex` differ in the compressed
payload bytes. Both sides decompress each other's output.

### D2. Registry names in format strings (1 vector)

The reference's global known-values store registers 102 of its 104
constants — `VALUE` (25) and `SELF` (706) are missing from its list
(known-values D4, an upstream omission) — so `'Self'` prints for 706 here
and `'706'` there. Every codepoint both know prints identically; the
harness allows exactly these two names and nothing else.

### D4. Renderings the port keeps (not vectored)

- Error *messages* mirror the reference's wording except one typo:
  `AmbiguousAttachment` reads `ambiguous attachment` here and `abiguous
  attachment` there. Codes are what the harness compares.
- `Expression.fromEnvelope` reports a function mismatch as `expected
  function add, but found sub` where the reference formats the `Debug` of
  its enum (`Expected function Known(1, Some("add")), but found …`); the
  code is `Cbor` on both sides.

### Resolved

Validating against the reference closed these; the pinned vectors and the
frozen baseline (`tests/differential.test.ts`, tombstones T5–T10 and
T12–T14) record each flip:

- **Text summaries** (1.0.0-beta.2) truncate as the reference does: the
  UTF-8 byte length decides (`string.len() > max_length`), the cut keeps
  `max_length` whole characters (`chars().take`), so a non-ASCII text can
  gain an `…` without losing a character — executed: `summary(14)` of
  `"unicode ✓ ☺ 日本"` is `"unicode ✓ ☺ 日本…"` on both sides, and the
  mermaid label (`summary(20)`) matches. The port counted UTF-16 units for
  both steps.
- **Diagnostic line breaking** (D3; dcbor 1.0.0-beta.2): dcbor's
  diagnostic notation breaks a group over several lines when its strings
  exceed 20 **bytes** (`diag.rs`, `total_strings_len` sums `str::len()`);
  the port counted UTF-16 units, so `"unicode ✓ ☺ 日本"` (14 characters,
  22 bytes) printed `201("…")` on one line here and over three lines there.
  The envelope only passes the value through (`diagnostic` delegates to
  `@blockchaincommons/dcbor/diagnostic`); with dcbor 1.0.0-beta.2 the
  `leaf:text:unicode` vector matches and the harness rule is gone
  (tombstone T14). ASCII text was always identical.
- **Debug renderings** (1.0.0-beta.2): `Function.toString()` /
  `Parameter.toString()` print the reference's `Display` — the name or the
  number, the name in quotes for a named one (`add`, `99`, `"greet"`) — not
  `«1»` / `❰2❱`, which the format context prints inside format strings on
  both sides; `Expression.toString()` is the quoted format string (the
  reference's `{:?}` of `format()`); `Response.summary()` writes `id: X
  error: E` on its failure branches, as the reference does.

- **Sealed content key** (`recipient`): the port sealed the 32 raw key
  bytes; the reference seals the key's tagged CBOR (37 bytes). Recipient
  envelopes, `seal`/`unseal`, GSTP and XID transports now interoperate;
  the `recipientDecode` vector opens a reference-produced envelope.
- **Duplicate assertions** are deduplicated by digest (`addAssertion*`),
  as `add_optional_assertion_envelope_salted` does.
- **Obscured-subject nodes** decode: `isSubjectObscured` recurses like the
  reference's, so the non-correlation shape `ELIDED [ 'salt': Salt ]`
  inside a node round-trips.
- **`Date` leaves** are tag-1 dates (the port encoded `{}`); `undefined`
  is rejected.
- **`{ salt: true }`** checks the assertion before salting.
- **Well-known function ids 5–15** format as their numbers (`«5»`); the
  global store seeds `ADD SUB MUL DIV` like `functions.rs`.
- **Error codes**: every site that threw `General` throws the reference's
  variant; decode failures are one `Cbor` with the reference's message;
  a wrapped `'signed'` with a non-signature inside is
  `InvalidInnerSignatureType`.
- **Acceptance**: empty verifier lists are `false` / `UnverifiedSignature`;
  `Expression` keeps the envelope it was read from; `'note'` / `'date'`
  decode strictly; `expectSubject` on a wrapped envelope is
  `InvalidFormat`; `attachments()` validates; `sskrJoin` / `unlock`
  propagate decode errors; an empty vendor, a short salt instance and an
  empty recipient list are accepted.
- **`"none"` context** prints known-value codepoints; the global format
  context clones the expression stores.
- Earlier, in the redesign itself: annotated hex names tags, tag-1
  dates are summarised, well-known expression names print (tombstones
  T2–T4); `fromBytes` wraps CBOR decode failures (T1).

## 2. JS-only input domain

Inputs the reference's types make impossible, and what the port does with
them. Each is a `domain` vector (15, counted as JS-only by the harness) or a
golden entry; every rejection is an `EnvelopeError` except where the table
says otherwise (an unencodable value reaches dcbor first and is its
`CborError`).

| Input | Outcome |
|---|---|
| `Envelope.node(s, [])` | `InvalidParameter` (`assertions must be a non-empty array`) |
| `Envelope.knownValue(-1 \| 1.5 \| NaN \| 2n**64n)` | `InvalidParameter` (cause: known-values' `RangeError`) |
| `Envelope.from(new Date(NaN))` | `InvalidParameter`; a valid `Date` is a tag-1 date |
| `Envelope.from(undefined)` | `InvalidParameter`; `null` is the `null` leaf |
| `Envelope.from(Symbol()) / (() => 1)` | dcbor's `CborError` (an unencodable type; not wrapped) |
| `setPosition(-1 \| 1.5 \| NaN)` | `InvalidParameter`; `position()` of a non-integer is `Cbor` |
| `digests(1.5 \| -1)` | `InvalidParameter` |
| `expectNumber()` on `2^64-1` | `18446744073709552000` — a JavaScript number; use `expectSubject` with a bigint decoder for exact values (the reference's `extract_subject::<i32>` errors) |
| `addSalt({ length: 1.5 \| NaN })`, `{ range: { min: 8.5 } }` | `InvalidParameter` (integer of at least 8) |
| `addSalt({ salt: 2 bytes })` | accepted, as `add_salt_instance` takes any `Salt` |
| `addOptionalAssertion(p, null)` | adds nothing (`Option::None`); `addAssertion(p, null)` adds a `null` object |
| `Function.known(-1 \| 1.5)`, `Parameter.known(…)`, `Parameter.from(1.5, …)` | `InvalidParameter` (unsigned integer) |
| `Function.named("")`, `Parameter.named("")` | accepted (the reference's `String` is unconstrained) |
| `hasSignaturesFromThreshold(e, ks, 1.5 \| NaN \| -1)` | `InvalidParameter` |
| `lock(e, 99 as never, pw)` | `InvalidParameter` (`method must be a KeyDerivationMethod`) |
| `lock(e, KeyDerivationMethod.SSHAgent, pw)`, `addSignature(e, sshKey)` without `signing` options | `Components` with the `ComponentsError` as `cause` |
| a wrong symmetric key | `Components` (`AEAD error`) with the `CryptoError` as `cause`, as the reference's `Components(Crypto(…))` |
| `Envelope.codec.decode(201(42) \| 42)` | `Cbor` — tagged-only, like every codec in the stack (`decodeURWith` re-tags a UR body) |
| `Envelope.from(x)` for any `x` with a `toEnvelope()` method | accepted (the `ToEnvelope` protocol is structural) |

## 3. Mapping equivalences

- **Error taxonomy (`E1`, 9 vectors).** Malformed CBOR and UR strings with
  a bad checksum or the wrong type are rejected on both sides; the port
  reports dcbor's `CborError` or a `URError` (the rejection happens below
  the envelope), the reference its dcbor / bc-ur error. The harness
  requires both to reject; every rejection *inside* the envelope layer is
  compared by code.
- **Randomised outputs.** The ephemeral key of a sealed content key and
  the KDF salt of a lock come from the secure RNG on both sides, so
  `recipient` and `lock` recipes pin the digest and the format strings;
  Schnorr aux randomness pins the format strings alone. Encryption
  nonces can be fixed (`encryptSubject(key, { nonce })` ↔
  `encrypt_subject_opt(key, Some(nonce))`), and four vectors pin the AEAD
  bytes; without a nonce those outputs vary per run and are not compared.

## Maintenance

When the upstream reference moves:

1. Review the diff via the link in the `upstream.yml` tracking issue.
2. Port the relevant changes.
3. Update `.github/versions.yml` with the new version and commit.
4. Update the tracked version at the top of this file.
5. Add, amend, or remove divergence entries as the port requires.
