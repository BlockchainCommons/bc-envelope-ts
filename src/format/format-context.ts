// Format context for Gordian Envelopes with annotations.
//
// The FormatContext provides information about CBOR tags, known values,
// functions, and parameters that are used to annotate the output of envelope
// formatting functions. This context enables human-readable output when
// converting envelopes to string representations like diagnostic notation.

import {
  type TagsStore,
  type ReadonlyTagsStore,
  type Tag,
  type CborNumber,
  type CborSummarizer,
  TagsStore as TagsStoreClass,
  getGlobalTagsStore,
  expectNumber,
  expectText,
  isNumber,
  isText,
  CborError,
} from "@blockchaincommons/dcbor";
import {
  Function,
  FunctionsStore,
  globalFunctions,
  globalParameters,
  Parameter,
  ParametersStore,
} from "../extension/expression";
import {
  type KnownValuesStore,
  KnownValuesStore as KnownValuesStoreClass,
  KnownValue,
  getGlobalKnownValuesStore,
} from "@blockchaincommons/known-values";
import {
  TAG_KNOWN_VALUE,
  registerTags as registerBcTags,
  TAG_FUNCTION,
  TAG_PARAMETER,
  TAG_REQUEST,
  TAG_RESPONSE,
  TAG_EVENT,
} from "@blockchaincommons/tags";
import { registerComponentSummarizers } from "@blockchaincommons/components/tags";
import { diagnostic } from "@blockchaincommons/dcbor/diagnostic";

// ============================================================================
// FormatContextOpt - Option type for format context
// ============================================================================

/**
 * Which format context a formatter uses: a specific one, the global one
 * (`"global"`, the default), or none (`"none"`: no tag names, no known-value
 * names).
 */
export type FormatContextOpt = FormatContext | "global" | "none";

/** The tags store a `FormatContextOpt` denotes; an empty store for `"none"`. */
export function tagsStoreFor(opt: FormatContextOpt = "global"): TagsStore {
  return resolveFormatContext(opt)?.tags ?? (EMPTY_TAGS ??= new TagsStoreClass());
}
let EMPTY_TAGS: TagsStore | undefined;

/** The context a `FormatContextOpt` denotes; `undefined` for `"none"`. */
export function resolveFormatContext(opt: FormatContextOpt = "global"): FormatContext | undefined {
  if (opt === "none") return undefined;
  if (opt === "global") return getGlobalFormatContext();
  return opt;
}

// ============================================================================
// FormatContext - Main formatting context class
// ============================================================================

/**
 * Context object for formatting Gordian Envelopes with annotations.
 *
 * The FormatContext provides information about CBOR tags, known values,
 * functions, and parameters that are used to annotate the output of envelope
 * formatting functions.
 */
export class FormatContext implements ReadonlyTagsStore {
  private readonly _tags: TagsStore;
  private readonly _knownValues: KnownValuesStore;
  private readonly _functions: FunctionsStore;
  private readonly _parameters: ParametersStore;

  constructor({
    tags = new TagsStoreClass(),
    knownValues = new KnownValuesStoreClass(),
    functions = new FunctionsStore(),
    parameters = new ParametersStore(),
  }: {
    tags?: TagsStore;
    knownValues?: KnownValuesStore;
    functions?: FunctionsStore;
    parameters?: ParametersStore;
  } = {}) {
    this._tags = tags;
    this._knownValues = knownValues;
    this._functions = functions;
    this._parameters = parameters;
  }

  /** Names for well-known expression functions (`«add»`). */
  get functions(): FunctionsStore {
    return this._functions;
  }

  /** Names for well-known expression parameters (`❰lhs❱`). */
  get parameters(): ParametersStore {
    return this._parameters;
  }

  /** The CBOR tags registry (names and summarisers). */
  get tags(): TagsStore {
    return this._tags;
  }

  /** The known values registry. */
  get knownValues(): KnownValuesStore {
    return this._knownValues;
  }

  // Implement ReadonlyTagsStore by delegating to internal tags store
  assignedNameForTag(tag: Tag): string | undefined {
    return this._tags.assignedNameForTag(tag);
  }

  nameForTag(tag: Tag): string {
    return this._tags.nameForTag(tag);
  }

  tagForValue(value: CborNumber): Tag | undefined {
    return this._tags.tagForValue(value);
  }

  tagForName(name: string): Tag | undefined {
    return this._tags.tagForName(name);
  }

  nameForValue(value: CborNumber): string {
    return this._tags.nameForValue(value);
  }

  summarizer(tag: CborNumber): CborSummarizer | undefined {
    return this._tags.summarizer(tag);
  }

  /** Create a clone of this context */
  clone(): FormatContext {
    // Note: This creates a shallow copy - tags and knownValues are shared
    // For a full deep copy, we would need to clone the stores
    return new FormatContext({
      tags: this._tags,
      knownValues: this._knownValues,
      functions: this._functions,
      parameters: this._parameters,
    });
  }
}

// ============================================================================
// Global Format Context
// ============================================================================

/** Global singleton instance of FormatContext for application-wide use. */
let _globalFormatContextInstance: FormatContext | undefined;
let isInitialized = false;

/** Get the global format context instance, initializing it if necessary. */
export const getGlobalFormatContext = (): FormatContext => {
  if (!isInitialized) {
    // Register dcbor's standard tags and every BC tag in *this* dcbor's
    // global store (the explicit argument matters when a sibling package
    // resolves its own copy of dcbor: `registerTags()` with no argument
    // would fill that copy's store and leave ours nameless).
    const tags = getGlobalTagsStore();
    registerBcTags(tags);
    const knownValues = getGlobalKnownValuesStore();

    _globalFormatContextInstance = new FormatContext({
      tags,
      knownValues,
      // Copies, as the reference's `FormatContext::new` clones its stores: a
      // registration made later does not change what the global context prints.
      functions: globalFunctions().clone(),
      parameters: globalParameters().clone(),
    });
    isInitialized = true;

    // Set up known value summarizer
    setupKnownValueSummarizer(_globalFormatContextInstance);

    // Set up component tag summarizers
    setupComponentSummarizers(_globalFormatContextInstance);
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Safe: initialized in the if block above
  return _globalFormatContextInstance!;
};

/** Execute a function with access to the global format context. */
export const withFormatContext = <T>(action: (context: FormatContext) => T): T => {
  return action(getGlobalFormatContext());
};

// ============================================================================
// Tag Registration
// ============================================================================

/** Set up the known value summarizer in a format context */
const setupKnownValueSummarizer = (context: FormatContext): void => {
  const knownValues = context.knownValues;
  const tags = context.tags;

  // Known value summarizer - formats known values with single quotes
  const summarizer: CborSummarizer = (cbor, _flat) => {
    try {
      // Try to extract the known value from the CBOR
      const kv = KnownValue.fromCbor(cbor);
      const name = knownValues.nameOf(kv);
      return { ok: true, value: `'${name}'` };
    } catch {
      return { ok: true, value: "'<unknown>'" };
    }
  };

  tags.setSummarizer(BigInt(TAG_KNOWN_VALUE.value), summarizer);
};

/**
 * Registers dcbor's standard tags, every BC tag and the envelope
 * summarisers in `context` (a custom context; the global one is set up on
 * first use).
 */
export const registerTagsIn = (context: FormatContext): void => {
  registerBcTags(context.tags);

  // Set up known value summarizer
  setupKnownValueSummarizer(context);

  // Set up component tag summarizers
  setupComponentSummarizers(context);
};

// ============================================================================
// Component Tag Summarizers
// ============================================================================

/** Helper to create an error result for summarizers */
const summarizerError = (e: unknown): { ok: false; error: CborError } => {
  const message = e instanceof Error ? e.message : String(e);
  return { ok: false as const, error: CborError.custom(message) };
};

/** Summarisers for the components tags, matching the reference registry byte for byte. */
const setupComponentSummarizers = (context: FormatContext): void => {
  const tags = context.tags;

  // The components summarisers (Digest, ARID, XID, URI, UUID, Nonce, Salt,
  // Seed, JSON, Reference, Signature, SealedMessage, EncryptedKey,
  // PrivateKeyBase, Private/PublicKeys, Signing keys, SSKRShare, the SSH
  // text forms) come from components itself, the reference's
  // `tags_registry.rs`, so envelope no longer re-declares them.
  registerComponentSummarizers(tags);

  // Function: «name» for a known function the context names, «id» for
  // one it does not, «"name"» for a named function.
  tags.setSummarizer(TAG_FUNCTION.value, (cbor, _flat) => {
    try {
      if (isNumber(cbor)) {
        const name = context.functions.nameOf(Function.known(Number(expectNumber(cbor))));
        return { ok: true, value: `«${name}»` };
      }
      if (isText(cbor)) {
        return { ok: true, value: `«"${expectText(cbor)}"»` };
      }
      return { ok: true, value: `«${diagnostic(cbor)}»` };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // Parameter: ❰name❱ / ❰id❱ / ❰"name"❱, likewise.
  tags.setSummarizer(TAG_PARAMETER.value, (cbor, _flat) => {
    try {
      if (isNumber(cbor)) {
        const name = context.parameters.nameOf(Parameter.known(Number(expectNumber(cbor))));
        return { ok: true, value: `❰${name}❱` };
      }
      if (isText(cbor)) {
        return { ok: true, value: `❰"${expectText(cbor)}"❱` };
      }
      return { ok: true, value: `❰${diagnostic(cbor)}❱` };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // Request/Response/Event: render the inner envelope's format wrapped with
  // the keyword, as the reference's `format_context.rs` does
  // (`Envelope::new(untagged_cbor).format_opt(...)` flanked by `request(` … `)`).
  // The formatter lives in the notation module, which imports this one; a
  // value import back would be a cycle (the module graph forbids them), so
  // notation installs it through `setEnvelopeFormatHook` when it loads — the
  // one import-time side effect of `/format`, internal to the subpath.
  const wrapWithEnvelopeFormat =
    (keyword: string): CborSummarizer =>
    (cbor, flat) => {
      try {
        if (envelopeFormatHook === undefined) {
          return { ok: true, value: `${keyword}(${diagnostic(cbor)})` };
        }
        return { ok: true, value: `${keyword}(${envelopeFormatHook(cbor, flat)})` };
      } catch (e) {
        return summarizerError(e);
      }
    };
  tags.setSummarizer(TAG_REQUEST.value, wrapWithEnvelopeFormat("request"));
  tags.setSummarizer(TAG_RESPONSE.value, wrapWithEnvelopeFormat("response"));
  tags.setSummarizer(TAG_EVENT.value, wrapWithEnvelopeFormat("event"));
};

/**
 * The formatter the request/response/event summarisers call for the inner
 * envelope. Installed by the notation module when it loads; not part of the
 * public subpath (the module graph has no value-import cycles, so the
 * formatter cannot be imported here directly).
 */
export type EnvelopeFormatHook = (cbor: unknown, flat: boolean) => string;
let envelopeFormatHook: EnvelopeFormatHook | undefined;
/** @internal */
export const setEnvelopeFormatHook = (hook: EnvelopeFormatHook): void => {
  envelopeFormatHook = hook;
};
