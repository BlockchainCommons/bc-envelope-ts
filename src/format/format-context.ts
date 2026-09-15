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
  type Cbor,
  type CborNumber,
  type CborSummarizer,
  TagsStore as TagsStoreClass,
  getGlobalTagsStore,
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

/**
 * The tags store a `FormatContextOpt` denotes for notation, summaries and
 * annotated diagnostics: the context's own store (for `"global"`, the
 * snapshot the global context took when it was built), an empty store for
 * `"none"`.
 */
export function tagsStoreFor(opt: FormatContextOpt = "global"): TagsStore {
  return resolveFormatContext(opt)?.tags ?? (EMPTY_TAGS ??= new TagsStoreClass());
}
let EMPTY_TAGS: TagsStore | undefined;

/**
 * The tags store the annotated hex dump names tags through: for `"global"`
 * dcbor's live global store (the reference's `hex()` resolves
 * `FormatContextOpt::Global` to `TagsStoreOpt::Global`), so a tag registered
 * after the global context was built is named here and nowhere else.
 */
export function hexTagsStoreFor(opt: FormatContextOpt = "global"): TagsStore {
  if (opt === "global") return getGlobalTagsStore();
  return tagsStoreFor(opt);
}

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

  /**
   * A context over the given stores (empty ones by default). The stores are
   * taken as they are: pass clones when the context must not follow later
   * registrations, as the reference's `FormatContext::new` clones its
   * arguments.
   */
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

  /**
   * An independent copy: every store is cloned (the reference's derived
   * `Clone`), so a registration made in either context afterwards is not
   * seen by the other.
   */
  clone(): FormatContext {
    return new FormatContext({
      tags: this._tags.clone(),
      knownValues: this._knownValues.clone(),
      functions: this._functions.clone(),
      parameters: this._parameters.clone(),
    });
  }
}

// ============================================================================
// Global Format Context
// ============================================================================

/**
 * What the process-wide slot holds: the global context once built, and
 * whether `registerTags()` has run on it (the reference's
 * `GLOBAL_FORMAT_CONTEXT` static and the idempotence of `register_tags`).
 */
interface GlobalSlot {
  context?: FormatContext;
  registered?: boolean;
}

/**
 * The slot is keyed on `globalThis` by a registered symbol rather than held
 * in a module variable so that every copy of this module in a process, the
 * ESM and CommonJS builds or two bundled copies, resolves the SAME context,
 * as the reference's static is one per process. The `@1` names the slot's
 * major version; bump it on a breaking change of what the slot holds so
 * incompatible copies do not share.
 */
const GLOBAL_KEY = Symbol.for("@blockchaincommons/envelope/global-format-context@1");

interface GlobalHolder {
  [GLOBAL_KEY]?: GlobalSlot;
}

/** The process-wide slot, created on first access. */
function globalSlot(): GlobalSlot {
  return ((globalThis as GlobalHolder)[GLOBAL_KEY] ??= {});
}

/**
 * The global format context, built on first call as the reference's
 * `LazyFormatContext::get` builds it: dcbor's global tags store receives
 * the standard tags, every Blockchain Commons tag name and the components
 * summarisers (`bc_components::register_tags()`), then the context takes a
 * snapshot of that store, of the global known-values registry and of the
 * global functions and parameters stores (`FormatContext::new` clones its
 * arguments). A tag or known value registered globally afterwards is not
 * seen by the context.
 *
 * The envelope summarisers (known values as `'name'`, functions as `«…»`,
 * parameters as `❰…❱`, requests, responses and events) are NOT installed
 * here: call {@link registerTags} first, as the reference calls
 * `bc_envelope::register_tags()`. Until then a leaf holding `40000(1)`
 * formats as `40000(1)`.
 *
 * One context per process: the ESM and CommonJS builds share it.
 */
export const getGlobalFormatContext = (): FormatContext => {
  const slot = globalSlot();
  if (slot.context === undefined) {
    // `bc_components::register_tags()` on dcbor's global store: the explicit
    // argument matters when a sibling package resolves its own copy of
    // dcbor (`registerTags()` with no argument would fill that copy's store).
    const global = getGlobalTagsStore();
    registerBcTags(global);
    registerComponentSummarizers(global);
    slot.context = new FormatContext({
      tags: global.clone(),
      knownValues: getGlobalKnownValuesStore().clone(),
      functions: globalFunctions().clone(),
      parameters: globalParameters().clone(),
    });
  }
  return slot.context;
};

/** Execute a function with access to the global format context. */
export const withFormatContext = <T>(action: (context: FormatContext) => T): T => {
  return action(getGlobalFormatContext());
};

/**
 * Registers the envelope summarisers in the global format context (the
 * reference's `bc_envelope::register_tags()`): after this call known
 * values, functions, parameters, requests, responses and events print by
 * name. Idempotent: the second call does nothing.
 */
export function registerTags(): void {
  const slot = globalSlot();
  const context = getGlobalFormatContext();
  if (slot.registered === true) return;
  registerTagsIn(context);
  slot.registered = true;
}

// ============================================================================
// Tag Registration
// ============================================================================

/**
 * Registers every tag name and summariser in `context` (the reference's
 * `register_tags_in`): the standard and Blockchain Commons tag names, the
 * components summarisers, then the envelope summarisers. Each envelope
 * summariser captures a clone of the store it names through at this call,
 * as the reference's closures do, so a value registered in the context
 * afterwards is not seen by them.
 */
export const registerTagsIn = (context: FormatContext): void => {
  registerBcTags(context.tags);
  registerComponentSummarizers(context.tags);
  setupKnownValueSummarizer(context);
  setupExpressionSummarizers(context);
};

/** The result dcbor renders as `<error: message>`. */
const summarizerError = (e: unknown): { ok: false; error: CborError } => {
  if (CborError.isCborError(e)) return { ok: false as const, error: e };
  const message = e instanceof Error ? e.message : String(e);
  return { ok: false as const, error: CborError.custom(message) };
};

/**
 * The known-value summariser: `'name'` through a clone of the context's
 * registry. A summariser receives the *content* of tag 40000 (the bare
 * integer), so the decoder is `KnownValue.fromUntaggedCbor`, which wraps a
 * negative integer as the reference's `u64::try_from` does; a non-integer
 * content is the dcbor error (`<error: the decoded CBOR value was not the
 * expected type>`).
 */
const setupKnownValueSummarizer = (context: FormatContext): void => {
  const knownValues = context.knownValues.clone();
  context.tags.setSummarizer(TAG_KNOWN_VALUE.value, (cbor: Cbor) => {
    try {
      return { ok: true, value: `'${knownValues.nameOf(KnownValue.fromUntaggedCbor(cbor))}'` };
    } catch (e) {
      return summarizerError(e);
    }
  });
};

/**
 * The expression summarisers: `«name»` and `❰name❱` through clones of the
 * context's functions and parameters stores; `request(…)`, `response(…)`
 * and `event(…)` around the inner envelope formatted through a clone of
 * the context taken before each summariser is installed (the reference's
 * `let cloned_context = context.clone()` before each `set_summarizer`).
 */
const setupExpressionSummarizers = (context: FormatContext): void => {
  const tags = context.tags;

  const functions = context.functions.clone();
  tags.setSummarizer(TAG_FUNCTION.value, (cbor: Cbor) => {
    try {
      const f = Function.fromUntaggedCbor(cbor);
      return { ok: true, value: `«${FunctionsStore.nameForFunction(f, functions)}»` };
    } catch (e) {
      return summarizerError(e);
    }
  });

  const parameters = context.parameters.clone();
  tags.setSummarizer(TAG_PARAMETER.value, (cbor: Cbor) => {
    try {
      const p = Parameter.fromUntaggedCbor(cbor);
      return { ok: true, value: `❰${ParametersStore.nameForParameter(p, parameters)}❱` };
    } catch (e) {
      return summarizerError(e);
    }
  });

  // The inner envelope is `Envelope::new(untagged_cbor)` formatted with the
  // summariser's `flat` and the captured context, flanked by the keyword.
  // The formatter lives in the notation module, which imports this one; a
  // value import back would be a cycle (the module graph forbids them), so
  // notation installs it through `setEnvelopeFormatHook` when it loads,
  // the one import-time side effect of `/format`, internal to the subpath.
  const wrapWithEnvelopeFormat = (keyword: string): CborSummarizer => {
    const captured = context.clone();
    return (cbor, flat) => {
      try {
        if (envelopeFormatHook === undefined) {
          return { ok: true, value: `${keyword}(${diagnostic(cbor)})` };
        }
        return { ok: true, value: `${keyword}(${envelopeFormatHook(cbor, flat, captured)})` };
      } catch (e) {
        return summarizerError(e);
      }
    };
  };
  tags.setSummarizer(TAG_REQUEST.value, wrapWithEnvelopeFormat("request"));
  tags.setSummarizer(TAG_RESPONSE.value, wrapWithEnvelopeFormat("response"));
  tags.setSummarizer(TAG_EVENT.value, wrapWithEnvelopeFormat("event"));
};

/**
 * The formatter the request/response/event summarisers call for the inner
 * envelope: the tag's content as a leaf, formatted with `flat` and the
 * context captured when the summariser was installed. Installed by the
 * notation module when it loads; not part of the public subpath (the module
 * graph has no value-import cycles, so the formatter cannot be imported
 * here directly).
 */
export type EnvelopeFormatHook = (cbor: Cbor, flat: boolean, context: FormatContext) => string;
let envelopeFormatHook: EnvelopeFormatHook | undefined;
/** @internal */
export const setEnvelopeFormatHook = (hook: EnvelopeFormatHook): void => {
  envelopeFormatHook = hook;
};
