# Migrating to the redesigned `@blockchaincommons/envelope`

The redesign keeps every wire byte and every format string. Envelopes, digests,
CBOR, URs, signatures, encrypted and compressed payloads produced before it
decode and verify after it, and vice versa; this was proven against a frozen
pre-redesign bundle (`tests/differential.test.ts`, four enumerated
tombstones, all of them fixes towards the Rust reference) and against
`bc-envelope-rust` 0.43.0 (`tests/rust-validation`, 137 of 150 vectors
byte-identical, the rest classified in `RUST_DIVERGENCES.md`).

What changed is the API. The sections below go subpath by subpath; the
first one, on the package layout, matters to everyone.

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
| `FormatContextOpt` `{ type: "none" \| "global" \| "custom", context }` and `formatContextNone()` / `formatContextGlobal()` / `formatContextCustom(c)` | `FormatContextOpt = FormatContext \| "global" \| "none"` |
| `new FormatContext(tags, knownValues)`; `tags()` / `knownValues()` methods; `registerTag(v, n)` | `new FormatContext({ tags?, knownValues?, functions?, parameters? })`; `tags` / `knownValues` / `functions` / `parameters` getters; `context.tags.register(Tag.from(v, n))` |
| `globalFormatContext()` / `GLOBAL_FORMAT_CONTEXT.get()` / `withFormatContextMut(fn)` / `registerTags()` | `getGlobalFormatContext()` / `withFormatContext(fn)`; the global context registers every tag on first use |
| `registerTagsIn(context)` | unchanged (for custom contexts) |

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
`@blockchaincommons/dcbor` is. Envelope's dependents see the redesigned
components (`Digest.from`, `.bytes`, `SymmetricKey.random`), known-values
(`getGlobalKnownValuesStore`, `KnownValue.codec`) and uniform-resources
(`UR`, `decodeURWith`) through its types; see those packages' MIGRATION
notes.

## Appendix: migrating from `@bcts/envelope`

`@blockchaincommons/envelope` is the canonical home of this library. It was extracted from the
[`paritytech/bcts`](https://github.com/paritytech/bcts) monorepo, where it was
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
monorepo, which is why it reached `1.0.0-beta.6`. Each extracted package now
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

### 5. Peer packages renamed too

Every sibling library moved from the `@bcts` scope to `@blockchaincommons`. If
you depend on more than one, rename them together so a single copy of each
shared type is resolved:

| Old | New |
|---|---|
| `@bcts/dcbor` | `@blockchaincommons/dcbor` |
| `@bcts/<name>` | `@blockchaincommons/<name>` |

### 6. What did not change

- The public API: every exported name, signature and type is identical.
- The wire format. Encodings produced by `@bcts/envelope` decode here, and the reverse.
- Parity with the Rust reference implementation. See [`RUST_DIVERGENCES.md`](./RUST_DIVERGENCES.md).
