# Migrating to `@blockchaincommons/envelope`

## 0. Wire and error parity with the reference

`@blockchaincommons/envelope` is the successor to `@bcts/envelope`.

The first validation against `bc-envelope-rust` 0.43.0 (1.0.0-beta.2)
changed what the port *produces and accepts*, not only its names. If you are
coming from the layout of the sections below, this is the checklist:

- **Recipient envelopes** now seal the content key's tagged CBOR (37 bytes)
  as the reference does. Envelopes produced by 1.0.0-beta.1's `addRecipient`
  / `encryptToRecipients` / `seal` cannot be opened by this version or by a
  Rust peer, and vice versa; re-encrypt anything you persisted. (No
  released consumer had persisted one; there is no read-side shim.)
- **`addAssertion` / `addAssertionEnvelope` deduplicate** by digest, so a
  repeated `addAssertion("knows", "Bob")` yields one assertion and the
  reference's digest. `{ salt: true }` checks the assertion first.
- **`Envelope.from(new Date(…))` is a tag-1 date** (it encoded an empty
  map); `Envelope.from(undefined)` throws `InvalidParameter` (it encoded
  `null`). `EnvelopeInput` gained `Date` and lost `undefined`.
- **Error codes.** Every operation throws the reference's variant where it
  threw `General`: `AlreadyEncrypted`, `AlreadyElided`, `NotEncrypted`,
  `NotCompressed`, `MissingDigest`, `InvalidDigest`, `UnknownRecipient`,
  `InvalidAttachment`, `NonexistentAttachment`, `AmbiguousAttachment`,
  `InvalidInnerSignatureType`, `NotLeaf`, `InvalidResponse`, `Cbor`
  (function mismatch, tagged ids, every decode failure), `Components`
  (a wrong key, a KDF or signing failure — with the original as `cause`).
  New `InvalidParameter` for JavaScript-only inputs (fractional
  positions, `NaN` lengths, an unknown KDF method, an invalid `Date`,
  `undefined`, out-of-range known values, empty assertion lists);
  `details` names the parameter. `EnvelopeError` has a private
  constructor, `details`, `is(code)`, `EnvelopeError.isEnvelopeError(e)`;
  `EnvelopeError.msg()` and the `Error` alias are gone. Decode failures
  are one `Cbor` carrying the reference's message (`fromBytes(…)` no
  longer nests three levels).
- **Acceptance.** `hasSignaturesFrom(e, [])` is `false` and
  `verifySignaturesFrom(e, [])` throws; `expectSubject(decoder)` on a
  wrapped envelope throws `InvalidFormat` (call `unwrap()` first);
  `Request.fromEnvelope` / `Event.fromEnvelope` reject a non-text `'note'`
  or a non-date `'date'` (the ISO-string shim is gone) and take the body
  through `objectForPredicate`; `Response.fromEnvelope` rejects a
  known-value id other than `Unknown`; `attachments()` validates every
  `attachment` assertion; `sskrJoin` and `unlock` propagate decode errors;
  `recipients()` skips obscured objects; `attachmentVendor()` accepts `""`;
  `addSalt({ salt })` takes any instance; `encryptSubjectToRecipients([])`
  is accepted; `Expression.fromEnvelope` keeps the envelope it read.
- **Format.** Known values print their codepoint under `context: "none"`
  or a context whose store does not register them (`'4'`, not `'note'`);
  ids 5–15 of the well-known functions print as numbers (`«5»`), the
  global store seeding `ADD SUB MUL DIV`; the global format context clones
  the expression stores at creation. `treeFormat` and `mermaidFormat` take
  `context?: FormatContextOpt` and `highlightingTarget?: Iterable<Digest |
  DigestProvider>` (`highlightDigests: Set<string>` is gone).
- **Determinism options.** `encryptSubject(key, { nonce | rng })`,
  `encrypt(key, …)`, `addRecipient(e, recipient, key, { nonce, rng })`
  (the positional `testNonce` is gone), `{ rng }` on
  `encryptSubjectToRecipient[s]`, `encryptToRecipient[s]`, `lock`,
  `lockSubject`; `sskrSplit(…, { rng })` is rand's `RngOptions`.
- **Names.** `Attachments` / `Edges`: `size` and `[Symbol.iterator]`
  replace `len()`, `iter()`, `isEmpty()`; `recipients()` returns
  components' `SealedMessage` (the wrapper class with `inner()` / `data()`
  / `fromData()` is gone; decrypt with
  `sealed.decrypt(recipient.encapsulationPrivateKey())`);
  `edgesMatching(e, { isA, source, target, subject })`;
  `globalFunctions()` / `globalParameters()` replace `GLOBAL_FUNCTIONS.get()`
  / `GLOBAL_PARAMETERS.get()` and `LazyStore`; `Response.extractResult` /
  `extractError` take `CborDecoder<T>`; `expectBytes` / `asBytes` return
  `Uint8Array<ArrayBuffer>`; `Envelope.codec.decode` requires tag 200.
- **Removed.** `ADD_VALUE` … `NOT_VALUE`, `BLANK_VALUE`, `LHS_VALUE`,
  `RHS_VALUE` (use `FUNCTION_IDS` / `PARAMETER_IDS`), `CBOR_TAG_FUNCTION`
  / `PARAMETER` / `PLACEHOLDER` / `REPLACEMENT` (use `@blockchaincommons/tags`),
  `Function.hashCode`, `Parameter.hashCode`, `Assertion.clone`, the
  `RequestBehavior` / `ResponseBehavior` / `EventBehavior` / `Edgeable` /
  `EnvelopeSummary` interfaces, and the re-exports of sibling values:
  import `SIGNED`, `NOTE`, `ATTACHMENT`, `VENDOR`, `CONFORMS_TO`,
  `HAS_RECIPIENT` from `@blockchaincommons/known-values`, `Signature`,
  `SigningPrivateKey`, `SigningPublicKey`, `Signer`, `Verifier`,
  `SigningOptions` from `@blockchaincommons/components`, `Spec`,
  `GroupSpec`, `Secret` from `@blockchaincommons/sskr` and `SskrShare`
  from `@blockchaincommons/components/sskr`.
- **Immutability.** `assertions()` and `case.assertions` are frozen
  arrays; `asBytes()` / `expectBytes()` / `asArray()` / `asMap()` return
  copies; `Request` / `Response` / `Event` / `Expression` builders return
  new instances (`with*` no longer mutates the receiver).

## 1. Layout: a core class, subpaths of functions, and `/all`

The root entry exports the `Envelope` class with the base specification as
real members: construction, subject and assertions, digests and equivalence,
CBOR and UR, queries and leaf accessors, elision, encryption, compression,
salt, wrap, walk. Everything else is an extension living on a subpath as
plain functions that take the envelope first:

| Subpath | Functions |
|---|---|
| `/signature` | `sign`, `verify`, `addSignature`, `addSignatures`, `verifySignatureFrom`, `hasSignatureFrom`, `signatures`, `SignatureMetadata`, … |
| `/recipient` | `encryptToRecipients`, `addRecipient`, `decryptToRecipient`, `recipients`, … |
| `/secret` | `lock`, `unlock`, `lockSubject`, `unlockSubject`, `addSecret`, … |
| `/sskr` | `sskrSplit`, `sskrJoin` |
| `/proof` | `proofContainsSet`, `proofContainsTarget`, `confirmContainsSet`, `confirmContainsTarget` |
| `/attachment` | `attachment`, `addAttachment`, `attachments`, `expectAttachment`, `attachmentPayload`, … |
| `/edge` | `addEdgeEnvelope`, `edges`, `edgeSource`, `edgesMatching`, … |
| `/types` | `addType`, `types`, `hasType`, `expectType`, … |
| `/expression` | `Function`, `Parameter`, `Expression`, `Request`, `Response`, `Event`, `add`, … |
| `/seal` | `seal`, `unseal`, `encryptToRecipient` |
| `/format` | `format`, `formatFlat`, `treeFormat`, `mermaidFormat`, `hex`, `diagnostic`, `summary`, `shortId`, `FormatContext`, `getGlobalFormatContext` |
| `/all` | everything above, **installed as `Envelope` methods** |

No entry other than `/all` (and `/format`, which registers its tag names on
import) has side effects, so a consumer of the root plus `/signature`
bundles the signing code and nothing else.

Two ways to keep code that chains methods:

```typescript
// 1. Import the facade once, anywhere; every extension becomes a method
//    with the same name and (envelope-less) parameters as the function.
import "@blockchaincommons/envelope/all";
envelope.sign(key).encryptToRecipients([bob]).format();

// 2. Or pipe functions through the core class without the facade.
import { sign } from "@blockchaincommons/envelope/signature";
envelope.pipe(sign, key).pipe(encryptToRecipients, [bob]);
```

`/all` also re-exports every subpath, so `import { Envelope, sign, format }
from "@blockchaincommons/envelope/all"` is the one-stop import. The
`registerXxxExtension()` no-ops and `VERSION` are gone.

## 2. The core `Envelope` (root)

### Construction

| Before | After |
|---|---|
| `Envelope.new(x)` | `Envelope.from(x)` |
| `Envelope.newOrNull(x)` | `Envelope.from(x ?? null)` |
| `Envelope.newOrNone(x)` | `Envelope.fromOptional(x)` (`undefined` stays `undefined`) |
| `Envelope.newLeaf(cbor)` | `Envelope.leaf(cbor)` |
| `Envelope.newWrapped(e)` | `Envelope.wrap(x)` (any input) |
| `Envelope.newAssertion(p, o)` | `Envelope.assertion(p, o)` |
| `Envelope.newWithAssertions(s, a)` | `Envelope.node(s, a)` |
| `Envelope.newWithUncheckedAssertions(s, a)` | `Envelope.node(s, a, { unchecked: true })` |
| `Envelope.newWithAssertion(a)` | `Envelope.fromAssertion(a)` |
| `Envelope.newWithKnownValue(kv)` | `Envelope.knownValue(kv)` |
| `Envelope.newWithEncrypted(m)` / `newWithCompressed(c)` / `newElided(d)` | `Envelope.encrypted(m)` / `compressed(c)` / `elided(d)` |
| `Envelope.null()` / `true()` / `false()` / `unit()` | `Envelope.NULL` / `TRUE` / `FALSE` / `UNIT` (shared instances) |
| `envelope.case()` | `envelope.case` (getter; narrow on `.type`) |
| `envelope.clone()` | gone — envelopes are immutable values |

`digest()` and `subject()` stay methods: `digest()` is the `DigestProvider`
contract shared with components, and `subject()` pairs with `assertions()`.

### Accessors: the `expect` prefix

Every accessor that throws is spelled `expect…`; the `as…` ones return
`undefined`; `is…` ones return a boolean.

| Before | After |
|---|---|
| `tryLeaf()` (and its alias `expectLeaf()`) | `expectLeaf()` |
| `tryAssertion()` / `tryPredicate()` / `tryObject()` / `tryKnownValue()` | `expectAssertion()` / `expectPredicate()` / `expectObject()` / `expectKnownValue()` |
| `tryByteString()` / `extractBytes()` | `expectBytes()` |
| `extractString()` / `extractNumber()` / `extractBoolean()` / `extractNull()` | `expectString()` / `expectNumber()` / `expectBoolean()` / `expectNull()` |
| `tryUnwrap()` / `unwrap()` | `unwrap()` |
| `extractSubject(decoder)` | `expectSubject(decoder)` |
| `tryObjectForPredicate(p, decoder)` | `expectObjectForPredicate(p, decoder)` |
| `tryOptionalObjectForPredicate(p, decoder)` | `optionalObjectForPredicateAs(p, decoder)` |
| `extractObjectForPredicateWithDefault(p, decoder, d)` | `objectForPredicateOr(p, decoder, d)` |
| `extractObjectsForPredicate(p, decoder)` / `tryObjectsForPredicate(p, decoder)` | `expectObjectsForPredicate(p, decoder)` (an absent predicate is `[]`) |

The free functions `extractString(envelope)` etc. and the `EnvelopeDecoder`
class are no longer exported; use the members.

### Elision

The twelve `elideRemoving*` / `elideRevealing*` variants are one method:

```typescript
envelope.elide();                                        // the whole envelope
envelope.elide({ removing: [a, b] });                    // any Iterable of digests or providers
envelope.elide({ revealing: new Set([root, subject]) });
envelope.elide({ removing: [a], action: "compress" });
envelope.elide({ removing: [a], action: { encrypt: key } });
```

`ObscureAction` is `"elide" | "compress" | { encrypt: SymmetricKey }`;
`elideAction()` is gone. `ObscureType`, `EdgeType`, `DigestDisplayFormat`,
`MermaidOrientation` and `MermaidTheme` are `as const` objects with string
values, so `ObscureType.Elided === "elided"` and either spelling type-checks.
Targets are matched by digest value, as before.

### Salt

The `/salt` subpath is gone; salt is part of the core:

| Before | After |
|---|---|
| `addSalt()` / `addSaltUsing(rng)` | `addSalt()` / `addSalt({ rng })` |
| `addSaltWithLen(n)` / `addSaltWithLength(n)` / `addSaltWithLenUsing(n, rng)` | `addSalt({ length: n, rng? })` |
| `addSaltInRange(min, max)` / `addSaltInRangeUsing(min, max, rng)` | `addSalt({ range: { min, max }, rng? })` |
| `addSaltBytes(bytes)` / `addSaltInstance(salt)` | `addSalt({ salt })` |
| `addAssertionSalted(p, o, true)` | `addAssertion(p, o, { salt: true })` |
| `addAssertionEnvelopeSalted(a, true)` / `addOptionalAssertionEnvelopeSalted(a, true)` | `addAssertionEnvelope(a, { salt: true })` / `addOptionalAssertionEnvelope(a, { salt: true })` |

The `SALT` known value comes from `@blockchaincommons/known-values`.

### CBOR and UR

`Envelope` implements dcbor's `ToCbor` and `CborTagged` and exposes the one
codable mechanism every package uses:

| Before | After |
|---|---|
| `envelope.taggedCbor()` | `envelope.toCbor()` |
| `envelope.cborBytes()` / `taggedCborData()` / `envelopeToBytes(e)` | `envelope.toCbor().toData()` |
| `envelope.ur()` / `envelope.urString()` | `envelope.toUR()` / `envelope.toUR().toString()` |
| `Envelope.fromTaggedCbor(c)` / `tryFromCbor(c)` / `envelopeFromCbor(c)` | `Envelope.fromCbor(c)` |
| `Envelope.tryFromCborData(b)` / `envelopeFromBytes(b)` | `Envelope.fromBytes(b)` |
| `Envelope.fromUR(ur)` / `fromURString(s)` | `decodeURWith(ur, Envelope.codec)` / `decodeURWith(UR.parse(s), Envelope.codec)` |
| `EnvelopeCBORTagged*` wrappers | `Envelope.codec` (a `CborCodec<Envelope>`; `decode` accepts tagged or untagged) |

`fromBytes` now wraps a CBOR decode failure in `EnvelopeError` with code
`Cbor` and the `CborError` as `cause` (it used to let the `CborError`
escape).

### Encodable protocol

| Before | After |
|---|---|
| `EnvelopeEncodable { intoEnvelope() }` | `ToEnvelope { toEnvelope() }` |
| `EnvelopeEncodableValue` | `EnvelopeInput` |
| `isEnvelopeEncodable(x)` | `isToEnvelope(x)` |

### Errors

`ErrorCode` (a SCREAMING_CASE enum) is `EnvelopeErrorCode`, an `as const`
object whose values are PascalCase strings, and `EnvelopeError.code` is the
union of them. Compare with a literal:

```typescript
} catch (e) {
  if (e instanceof EnvelopeError && e.code === "NonexistentPredicate") …
```

| Before | After |
|---|---|
| `ErrorCode.NONEXISTENT_PREDICATE` | `"NonexistentPredicate"` (or `EnvelopeErrorCode.NonexistentPredicate`) |
| `ErrorCode.CBOR` / `COMPONENTS` / `SSKR` / `GENERAL` | `"Cbor"` / `"Components"` / `"Sskr"` / `"General"` |
| `Result<T>` alias | gone |

The factories (`EnvelopeError.nonexistentPredicate()` …) and every message
are unchanged.

## 3. `/format`

| Before | After |
|---|---|
| `formatOpt(e, opts)`, `defaultFormatOpts()`, `flatFormatOpts()` | `format(e, { flat?, context? })`, `formatFlat(e, { context? })` |
| `mermaidFormatOpt(e, opts)`, `defaultMermaidOpts()` | `mermaidFormat(e, options?)` (`MermaidFormatOptions`) |
| `hex(e)` / `hexOpt(e, annotate, context)` / `cborBytes(e)` | `hex(e, { annotate?, context? })` (annotated by default) / `e.toCbor().toData()` |
| `diagnostic(e)` / `diagnosticAnnotated(e, context)` | `diagnostic(e, { annotate?, context? })` |
| `summary(e, maxLength)` / `summaryWithContext(e, maxLength, context)` | `summary(e, { maxLength?, context? })` |
| — | Since 1.0.0-beta.2 the truncation rule is the reference's: the text's UTF-8 byte length decides, the cut keeps `maxLength` whole characters (a non-ASCII text can gain an `…` without losing a character). `Function`/`Parameter.toString()` print the reference's `Display` (`add`, `99`, `"greet"`; the `«…»`/`❰…❱` forms stay in format strings), `Expression.toString()` is the quoted format string, and `Response.summary()` writes `id: X error: E` on failure, as the reference does. |
| `FormatContextOpt` `{ type: "none" \| "global" \| "custom", context }` and `formatContextNone()` / `formatContextGlobal()` / `formatContextCustom(c)` | `FormatContextOpt = FormatContext \| "global" \| "none"` |
| `new FormatContext(tags, knownValues)`; `tags()` / `knownValues()` methods; `registerTag(v, n)` | `new FormatContext({ tags?, knownValues?, functions?, parameters? })`; `tags` / `knownValues` / `functions` / `parameters` getters; `context.tags.register(Tag.from(v, n))` |
| `globalFormatContext()` / `GLOBAL_FORMAT_CONTEXT.get()` / `withFormatContextMut(fn)` | `getGlobalFormatContext()` / `withFormatContext(fn)` |
| `registerTags()` / `registerTagsIn(context)` | unchanged: the envelope summarisers are installed by `registerTags()` (the reference's `bc_envelope::register_tags()`), not on first use |

Three outputs changed, all to match the reference: annotated hex names its
tags (`# tag(200) envelope`), tag-1 dates are summarised
(`2022-07-11T04:00:00Z`), and well-known expression functions and parameters
print by name (`«add» [ ❰lhs❱: 2 ❰rhs❱: 3 ]`).

## 4. `/signature` and `/seal`

| Before | After |
|---|---|
| `sign(e, signer)` / `signOpt(e, signer, options)` / `signWithMetadata(e, signer, md)` | `sign(e, signer, { signing?, metadata? })` |
| `addSignature(e, signer)` / `addSignatureOpt(e, signer, options, md)` / `addSignatureWithMetadata(e, signer, md)` | `addSignature(e, signer, { signing?, metadata? })` |
| `addSignatures(e, signers)` / `addSignaturesOpt(e, [{ signer, options, metadata }])` / `addSignaturesWithMetadata(…)` | `addSignatures(e, [signer, { signer, signing?, metadata? }])` |
| `SignatureMetadata.new()`; `assertions()` | `SignatureMetadata.from([[predicate, object], …])`; `assertions` getter |
| `seal(e, sender, recipient)` / `sealOpt(e, sender, recipient, options)` | `seal(e, sender, recipient, { signing?, metadata? })` |

`signing` is components' `SigningOptions` (Schnorr `rng`, SSH namespace and
hash).

## 5. `/sskr`, `/attachment`, `/types`

| Before | After |
|---|---|
| `sskrSplit(e, spec, key)` / `sskrSplitUsing(e, spec, key, rng)` | `sskrSplit(e, spec, key, { rng? })` |
| `sskrSplitFlattened(e, spec, key)` | `sskrSplit(e, spec, key).flat()` |
| `Envelope.newAttachment(payload, vendor, conformsTo)` | `attachment(payload, vendor, conformsTo)` (`Envelope.attachment` with `/all`) |
| `attachments(e)` | `attachments(e, { vendor?, conformsTo? })` — returns the `attachment` **assertions** (read them with `attachmentPayload` / `attachmentVendor` / `attachmentConformsTo`) |
| `attachmentsWithVendorAndConformsTo(e, v, c)` | `attachments(e, { vendor: v, conformsTo: c })` |
| `attachmentWithVendorAndConformsTo(e, v, c)` | `expectAttachment(e, { vendor: v, conformsTo: c })` |
| `checkType(e, t)` / `checkTypeValue(e, kv)` | `expectType(e, t)` / `expectTypeValue(e, kv)` |

## 6. `/expression`

| Before | After |
|---|---|
| `Function.newKnown(v, name?)` / `newNamed(n)` / `fromNumeric(v)` / `fromString(n)` | `Function.known(v, name?)` / `named(n)` / `from(v \| n)` |
| `Parameter.newKnown` / `newNamed` / `withValue(id, envelope)` | `Parameter.known` / `named` / `from(id, value?)` |
| `f.value()` / `id()` / `name()` / `namedName()` / `assignedName()` / `p.paramValue()` | getters of the same names |
| `isNumeric()` / `isString()` / `envelope()` | `isKnown()` / `isNamed()` / `toEnvelope()` |
| `FunctionsStore` / `ParametersStore`: `insert`, `assignedName(f)`, `name(f)` | `register`, `assignedNameOf(f)`, `nameOf(f)` |
| `expression.function()` / `parameters()` / `getParameter(id)` / `envelope()` | `function` / `parameters` getters, `parameter(id)`, `toEnvelope()` |
| `Request.new(func, id)` / `newWithBody(expr, id)` | `Request.from(func \| expression, id)` |
| `req.body()` / `id()` / `note()` / `date()` / `function()` / `expressionEnvelope()` | getters |
| `Response.newSuccess(id)` / `newFailure(id)` / `newEarlyFailure()` / `Response.ok()` / `unknown()` | `Response.success(id)` / `failure(id)` / `earlyFailure()` / `Response.OK` / `UNKNOWN` |
| `res.id()` / `result()` / `error()` | getters |
| `Event.new(content, id)`; `content()` … getters; `Event.stringFromEnvelope(e)` | `Event.from(content, id)`; getters; `Event.fromEnvelope(e, (x) => x.expectString())` |

Response's "cannot set result on a failed response" and "expected an ID"
errors are `EnvelopeError`s (code `General`).

## 7. Dependency changes

`pako` and `@blockchaincommons/dcbor-compat` are no longer dependencies;
`@blockchaincommons/dcbor` is. Envelope's dependents see the
components (`Digest.from`, `.bytes`, `SymmetricKey.random`), known-values
(`getGlobalKnownValuesStore`, `KnownValue.codec`) and uniform-resources
(`UR`, `decodeURWith`) through its types; see those packages' MIGRATION
notes.

## Appendix: migrating from `@bcts/envelope`

`@blockchaincommons/envelope` is the canonical home of this library. It was extracted from the
[`paritytech/bcts`](https://github.com/paritytech/bcts) repository, where it was
published as `@bcts/envelope`, into its own Blockchain Commons repository at
[`BlockchainCommons/bc-envelope-ts`](https://github.com/BlockchainCommons/bc-envelope-ts).

For the extraction release, **`1.0.0-beta.1`, the public API is unchanged.** The
migration is a rename. `@bcts/envelope` remains published for one beta cycle as a
thin re-export of this package, so nothing breaks the moment you update.

### TL;DR checklist

- [ ] Replace the `@bcts/envelope` dependency with `@blockchaincommons/envelope`.
- [ ] Rewrite import specifiers: `@bcts/envelope` becomes `@blockchaincommons/envelope`.
- [ ] Raise your Node floor to **22.12**.
- [ ] Ensure TypeScript **>= 5.7** to consume the published types.
- [ ] If you relied on the `browser` field or a global-script build, switch to the ESM or CJS entry point.

### 1. Package name and imports

```diff
- import { /* ... */ } from "@bcts/envelope";
+ import { /* ... */ } from "@blockchaincommons/envelope";
```

```diff
  "dependencies": {
-   "@bcts/envelope": "^1.0.0-beta.6"
+   "@blockchaincommons/envelope": "^1.0.0-beta.1"
  }
```

### 2. Version numbering restarts

`@bcts/envelope` versions moved in lockstep with every other package in the
repository, which is why it reached `1.0.0-beta.6`. Each extracted package now
versions independently and starts again at `1.0.0-beta.1`. A lower version
number here does **not** mean older code.

### 3. Node and TypeScript floors moved up

| | `@bcts/envelope` | `@blockchaincommons/envelope` |
|---|---|---|
| Node | `>= 18` | `>= 22.12` |
| TypeScript (consumers) | 6.x | `>= 5.7` |

### 4. The IIFE / global-script build is gone

`@bcts/envelope` shipped an additional IIFE bundle exposed through the `browser`
field. That build is dropped: IIFE entry points cannot share chunks, which forks
module-level singletons across entry points. Use the ESM entry (`import`) or the
CJS entry (`require`); both are declared in `exports` and validated in CI by
`publint` and `@arethetypeswrong/cli`.

## 1.0.0-beta.3

If you are coming from 1.0.0-beta.2:

- **Register the envelope tags.** Call `registerTags()` (exported from
  `/format` and `/all`) once before formatting, where the reference calls
  `bc_envelope::register_tags()`. The global context is created on first
  use with only the bc-tags names and the components summarisers, so until
  then a request prints `40004(ARID(…))`, a function `40006(1)` and a
  known-value leaf `40000(1)`. The context snapshots the tag and known-value
  stores when it is created; register your own tags and known values before
  the first format (`hex()` keeps naming through dcbor's live store).
- **Known-value names.** The registry is the reference's seed plus
  `~/.known-values` (see `@blockchaincommons/known-values` 1.0.0-beta.3);
  an in-memory `KnownValue(9999, "custom")` prints `'custom'`, a decoded
  9999 prints `'9999'`, and `context: "none"` prints `''name''`.
- **Decode errors.** `Envelope.fromBytes` / `fromCbor` / `fromUntaggedCbor`
  / `codec.decode` / `Expression.fromEnvelope` throw `Cbor` with the dcbor
  message verbatim (`early end of CBOR data`, `expected CBOR tag envelope,
  but got 201`, `the decoded CBOR value was not the expected type`,
  `unknown envelope tag: 40000`) and the `CborError` as `cause`; internal
  sites (`decryptSubject`, `decompress`, the sealed content key,
  `Request`/`Event`/`Response.fromEnvelope`, subject extraction) read
  `dcbor error: <message>`. Match on `code` and `cause.code`, not on the
  old texts.
- **Subject extraction.** `expectSubject(decoder)` returns a wrapped
  envelope, a known value (with its name), a digest, an encrypted message
  or a compressed value when the decoder returns an instance of that class
  (`Envelope.fromCbor`, `KnownValue.fromCbor`, `Digest.fromCbor`, …);
  `InvalidFormat` otherwise, and always for an assertion. `expectString` /
  `expectNumber` / `expectBoolean` / `expectBytes` / `expectNull` are
  leaf-only; `expectNumber` is exact (`2^53 + 1` throws `Cbor`). `isTrue` /
  `isFalse` / `isBool` / `isNull` look through a node's subject.
  `Request.note`, `Event.note` and `attachmentVendor` accept a node object.
- **Integers.** `Function.value`, `Parameter.value` and `position()` are
  `number | bigint` (a `number` up to `2^53 − 1`); `valueBigInt` is exact;
  `Function.known` / `Parameter.known` / `Parameter.from` / `setPosition`
  take `number | bigint`. `FunctionID` / `ParameterID` include `bigint`.
- **Dates.** `Request.date` / `Event.date` stay a `Date` view; `cborDate` is
  the exact stored `CborDate`; `withDate` takes `Date | CborDate`. A decoded
  request or event now re-encodes byte for byte.
- **Expressions.** Lookups go through the envelope: `parameter(7)` no
  longer matches `"7"`; `objectForParameter` throws `NonexistentPredicate`
  / `AmbiguousPredicate`; the function mismatch message prints the
  reference's `Debug`.
- **Codes and texts.** Salt lengths below 8 and inverted ranges:
  `Components`; sskr failures in `sskrSplit`: `Sskr`; `abiguous
  attachment`, `invalid attachment`, `the subject of the envelope is not the
  unit value`, `general error: Expected an ID`; a `Verifier` that throws
  propagates its own error.
- **Elision.** `elide({ action: { encrypt } })` encrypts an already
  encrypted or elided target (the reference's behaviour);
  `Envelope.elideSetWithAction` is gone (`elide({ revealing, action })`).
- **Seal options.** `seal(e, sender, recipient, { signing, metadata, nonce,
  rng })` and `encryptToRecipient(e, recipient, { nonce, rng })`.
- **New.** `lockWith` / `lockSubjectWith` / `unlockWith` /
  `unlockSubjectWith(envelope, agent, id, …)` lock and unlock through an
  SSH agent (`SshAgent` from components); `Function` / `Parameter`
  `fromCbor` / `fromUntaggedCbor` / `codec`; `EnvelopeError.cborDecode`.