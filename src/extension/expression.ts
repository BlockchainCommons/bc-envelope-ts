import {
  type Cbor,
  type CborCodec,
  type CborTagged,
  type Tag,
  type ToCbor,
  cbor as toCbor,
  taggedValue,
  tagsForValues,
  validateTag,
  extractTaggedContent,
  expectUnsigned,
  expectText,
  isText,
  MajorType,
  CborError,
} from "@blockchaincommons/dcbor";

import { TAG_FUNCTION, TAG_PARAMETER } from "@blockchaincommons/tags";

import { Envelope } from "../base/envelope";
import { type ToEnvelope, type EnvelopeInput } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
import { rustDebugString } from "./rust-debug.js";

// Extension for envelope expressions.
//
// This module implements the Gordian Envelope expression syntax as specified
// in BCR-2023-012. Expressions enable encoding of machine-evaluatable
// expressions using envelopes, providing a foundation for distributed
// function calls and computation.
//
// ## Expression Structure
//
// An expression consists of:
// - A function identifier (the subject)
// - Zero or more parameters (as assertions)
// - Optional metadata (non-parameter assertions)
//
// ## CBOR Tags
//
// - Function: #6.40006
// - Parameter: #6.40007
// - Placeholder: #6.40008
// - Replacement: #6.40009
//
// @example
// ```typescript
// // Create a simple addition expression: add(lhs: 2, rhs: 3)
// const expr = Function.named('add')
//   .withParameter(PARAMETER_IDS.LHS, 2)
//   .withParameter(PARAMETER_IDS.RHS, 3);
//
// const envelope = expr.toEnvelope();
// ```

/** Well-known function identifiers (numeric) */
export const FUNCTION_IDS = {
  /** Addition (`add`). */
  ADD: 1,
  /** Subtraction (`sub`). */
  SUB: 2,
  /** Multiplication (`mul`). */
  MUL: 3,
  /** Division (`div`). */
  DIV: 4,
  /** Unary negation (`neg`). */
  NEG: 5,
  /** Less than (`lt`). */
  LT: 6,
  /** Less than or equal (`le`). */
  LE: 7,
  /** Greater than (`gt`). */
  GT: 8,
  /** Greater than or equal (`ge`). */
  GE: 9,
  /** Equal to (`eq`). */
  EQ: 10,
  /** Not equal to (`ne`). */
  NE: 11,
  /** Logical and (`and`). */
  AND: 12,
  /** Logical or (`or`). */
  OR: 13,
  /** Logical xor (`xor`). */
  XOR: 14,
  /** Logical not (`not`). */
  NOT: 15,
} as const;

/** Well-known parameter identifiers (numeric) */
export const PARAMETER_IDS = {
  /** Blank/implicit parameter (`blank`). */
  BLANK: 1,
  /** Left-hand side (`lhs`). */
  LHS: 2,
  /** Right-hand side (`rhs`). */
  RHS: 3,
} as const;

/**
 * A function identifier: a known function's numeric id (a `number` when it
 * is a safe integer, a `bigint` for the rest of the reference's `u64`
 * range) or a named function's name.
 */
export type FunctionID = number | bigint | string;

/**
 * A parameter identifier: a known parameter's numeric id (a `number` when
 * it is a safe integer, a `bigint` for the rest of the reference's `u64`
 * range) or a named parameter's name.
 */
export type ParameterID = number | bigint | string;

//------------------------------------------------------------------------------
// Ids: the reference's `u64`
//------------------------------------------------------------------------------

const U64_MAX = 0xffffffffffffffffn;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const ID_EXPECTATION =
  "an integer in [0, 9007199254740991] or a bigint in [0, 18446744073709551615]";

/**
 * The exact `u64` a caller-supplied id stands for: a non-negative safe
 * integer `number` or a `bigint` in `0 ..= 2⁶⁴ − 1`.
 *
 * @throws EnvelopeError `InvalidParameter` otherwise
 */
function idToBigInt(parameter: string, value: unknown): bigint {
  if (typeof value === "bigint") {
    if (value >= 0n && value <= U64_MAX) return value;
  } else if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  throw EnvelopeError.invalidParameter(parameter, ID_EXPECTATION, value);
}

/** A `u64` as a `number` when it is a safe integer, else as the `bigint`. */
const narrow = (value: bigint): number | bigint => (value <= MAX_SAFE ? Number(value) : value);

/** The exact id of an untagged function or parameter node: `Unsigned` → known, text → named. */
function decodeIdentity(cbor: Cbor, what: "function" | "parameter"): bigint | string {
  if (cbor.type === MajorType.Unsigned) return BigInt(expectUnsigned(cbor, { width: 64 }));
  if (isText(cbor)) return expectText(cbor);
  throw CborError.custom(`invalid ${what}`);
}

/** The key a store files a function or parameter under: its `u64` id or its name. */
function storeKey(entry: Function | Parameter): bigint | string {
  return entry.valueBigInt ?? entry.namedName ?? "";
}

/**
 * The instances whose name the reference declares as a `Static` string:
 * the module constants. Every other name is `Dynamic`. Only the `Debug`
 * rendering tells them apart.
 */
const STATIC_NAMED = new WeakSet<object>();

/**
 * The reference's `Debug` of a `Function` or `Parameter`:
 * `Known(1, Some(Static("add")))`, `Known(5, None)`, `Named(Dynamic("f"))`.
 */
function debugOf(entry: Function | Parameter): string {
  const name = entry.isKnown() ? entry.assignedName : entry.namedName;
  const nameDebug =
    name === undefined
      ? undefined
      : `${STATIC_NAMED.has(entry) ? "Static" : "Dynamic"}(${rustDebugString(name)})`;
  if (entry.isKnown()) {
    return `Known(${String(entry.valueBigInt)}, ${nameDebug === undefined ? "None" : `Some(${nameDebug})`})`;
  }
  return `Named(${nameDebug ?? 'Dynamic("")'})`;
}

//------------------------------------------------------------------------------
// Function class - matches the reference's Function enum
//------------------------------------------------------------------------------

/** Type tag for function variant */
type FunctionVariant = "known" | "named";

let FUNCTION_CODEC: CborCodec<Function> | undefined;

/**
 * Represents a function identifier in an expression.
 *
 * In Gordian Envelope, a function appears as the subject of an expression
 * envelope, with its parameters as assertions on that envelope.
 *
 * Functions can be identified in two ways:
 * 1. By a numeric ID (for well-known functions) - Known variant
 * 2. By a string name (for application-specific functions) - Named variant
 *
 * A known function's id is the reference's `u64`: `value` is a `number`
 * when it is a safe integer and a `bigint` otherwise, `valueBigInt` is
 * always exact.
 *
 * When encoded in CBOR, functions are tagged with #6.40006.
 */
export class Function implements ToEnvelope, ToCbor, CborTagged {
  private readonly _variant: FunctionVariant;
  private readonly _value: bigint; // Only used for 'known' variant
  private readonly _name: string | undefined;

  private constructor(variant: FunctionVariant, value: bigint, name?: string) {
    this._variant = variant;
    this._value = value;
    this._name = name;
  }

  /**
   * A function by known id (a number or bigint) or name (a string).
   *
   * @throws EnvelopeError `InvalidParameter` as `known` does
   */
  static from(id: FunctionID): Function {
    return typeof id === "string" ? Function.named(id) : Function.known(id);
  }

  /**
   * A known function with a numeric id and an optional display name.
   *
   * @throws EnvelopeError `InvalidParameter` when `value` is not a non-negative safe
   *   integer `number` or a `bigint` in `0 ..= 2⁶⁴ − 1`
   */
  static known(value: number | bigint, name?: string): Function {
    return new Function("known", idToBigInt("value", value), name);
  }

  /** Creates a new named function identified by a string. */
  static named(name: string): Function {
    return new Function("named", 0n, name);
  }

  /** Returns true if this is a known (numeric) function. */
  isKnown(): boolean {
    return this._variant === "known";
  }

  /** Returns true if this is a named (string) function. */
  isNamed(): boolean {
    return this._variant === "named";
  }

  /** The numeric id of a known function (a `number` when safe, else a `bigint`); `undefined` for a named one. */
  get value(): number | bigint | undefined {
    return this._variant === "known" ? narrow(this._value) : undefined;
  }

  /** The exact numeric id of a known function; `undefined` for a named one. */
  get valueBigInt(): bigint | undefined {
    return this._variant === "known" ? this._value : undefined;
  }

  /** Returns the function identifier (the numeric id for known, the name for named). */
  get id(): FunctionID {
    if (this._variant === "known") {
      return narrow(this._value);
    }
    // For named variant, name is always set during construction
    return this._name ?? "";
  }

  /**
   * Returns the display name of the function.
   *
   * For known functions with a name, returns the name.
   * For known functions without a name, returns the numeric ID as a string.
   * For named functions, returns the name enclosed in quotes.
   */
  get name(): string {
    if (this._variant === "known") {
      return this._name ?? this._value.toString();
    } else {
      return `"${this._name}"`;
    }
  }

  /** Returns the raw name for named functions, or undefined for known functions. */
  get namedName(): string | undefined {
    return this._variant === "named" ? this._name : undefined;
  }

  /** Returns the assigned name if present (for known functions only). */
  get assignedName(): string | undefined {
    return this._variant === "known" ? this._name : undefined;
  }

  /** The function tag (40006), named as the global tags store names it at the time. */
  cborTags(): Tag[] {
    return tagsForValues([TAG_FUNCTION.value]);
  }

  /** The bare id: the unsigned integer of a known function, the text of a named one. */
  untaggedCbor(): Cbor {
    return this._variant === "known" ? toCbor(this._value) : toCbor(this._name);
  }

  /** `#6.40006(id)`, the tag named as the global tags store names it. */
  toCbor(): Cbor {
    return taggedValue(this.cborTags()[0], this.untaggedCbor());
  }

  /**
   * Tagged-CBOR codec. `decode` requires `#6.40006(n)`: the tag is part of
   * the type, as in the reference's `TryFrom<CBOR>`; use `fromUntaggedCbor`
   * for the bare id. `tags` is named from the global tags store at each
   * access, as the reference's `cbor_tags()` is.
   */
  static get codec(): CborCodec<Function> {
    return (FUNCTION_CODEC ??= {
      get tags(): Tag[] {
        return tagsForValues([TAG_FUNCTION.value]);
      },
      encode: (f) => f.toCbor(),
      decode: (c) => Function.fromCbor(c),
    });
  }

  /**
   * Decode `#6.40006(id)` (the reference's `TryFrom<CBOR>`).
   *
   * @throws CborError (dcbor's, with a code) — `WrongType` for an untagged value,
   *   `WrongTag` for another tag (both tags named as the global tags store names
   *   them), `Custom` `invalid function` for a content that is neither an unsigned
   *   integer nor text
   */
  static fromCbor(cbor: Cbor): Function {
    validateTag(cbor, tagsForValues([TAG_FUNCTION.value]));
    return Function.fromUntaggedCbor(extractTaggedContent(cbor));
  }

  /**
   * Decode the bare id — the content of tag 40006 (the reference's
   * `from_untagged_cbor`): an unsigned integer is a known function, a text
   * a named one.
   *
   * @throws CborError `Custom` `invalid function` for anything else
   */
  static fromUntaggedCbor(cbor: Cbor): Function {
    const id = decodeIdentity(cbor, "function");
    return typeof id === "bigint" ? Function.known(id) : Function.named(id);
  }

  /**
   * Creates an expression envelope with this function as the subject: the
   * leaf `#6.40006(id)`, as the reference's `Envelope::new_leaf(function)`.
   */
  toEnvelope(): Envelope {
    return Envelope.leaf(this.toCbor());
  }

  /** Creates an expression with a parameter. */
  withParameter(param: ParameterID | Parameter, value: EnvelopeInput): Expression {
    const expr = new Expression(this);
    return expr.withParameter(param, value);
  }

  /** Checks equality based on value (for known) or name (for named). */
  equals(other: Function): boolean {
    if (this._variant !== other._variant) return false;
    if (this._variant === "known") {
      return this._value === other._value;
    } else {
      return this._name === other._name;
    }
  }

  /**
   * The reference's `Display`: the assigned name or the number for a known
   * function, the name in quotes for a named one (`add`, `99`, `"greet"`).
   * The `«…»` form belongs to the format strings, where the format context
   * prints it on both sides.
   */
  toString(): string {
    return this.name;
  }
}

//------------------------------------------------------------------------------
// FunctionsStore class - matches the reference's FunctionsStore
//------------------------------------------------------------------------------

/**
 * A store that maps functions to their assigned names.
 *
 * FunctionsStore maintains a registry of functions and their human-readable
 * names, which is useful for displaying and debugging expression functions.
 */
export class FunctionsStore {
  private readonly _dict = new Map<bigint | string, Function>();

  /** Creates a new FunctionsStore with the given functions. */
  constructor(functions: Iterable<Function> = []) {
    for (const func of functions) {
      this.register(func);
    }
  }

  /** Inserts a function into the store, keyed by its id (known) or name (named). */
  register(func: Function): void {
    this._dict.set(storeKey(func), func);
  }

  /**
   * The name the store assigned to `func`, if it is registered: the
   * registered function's own name (its assigned name, or its number when
   * it has none), as the reference's `assigned_name` returns the name it
   * filed at insertion.
   */
  assignedNameOf(func: Function): string | undefined {
    const stored = this._dict.get(storeKey(func));
    if (stored === undefined) return undefined;
    return stored.isKnown() ? stored.name : stored.namedName;
  }

  /** Returns the name for a function, either from this store or from the function itself. */
  nameOf(func: Function): string {
    const assigned = this.assignedNameOf(func);
    return assigned ?? func.name;
  }

  /** The registered functions. */
  [Symbol.iterator](): IterableIterator<Function> {
    return this._dict.values();
  }

  /** An independent copy (a format context takes one, as the reference does). */
  clone(): FunctionsStore {
    return new FunctionsStore(this);
  }

  /** The function's name in `store` when registered there, else its own name (`name_for_function`). */
  static nameForFunction(func: Function, store?: FunctionsStore): string {
    return store?.assignedNameOf(func) ?? func.name;
  }
}

//------------------------------------------------------------------------------
// Parameter class - matches the reference's Parameter enum
//------------------------------------------------------------------------------

/** Type tag for parameter variant */
type ParameterVariant = "known" | "named";

let PARAMETER_CODEC: CborCodec<Parameter> | undefined;

/**
 * Represents a parameter identifier in an expression.
 *
 * In Gordian Envelope, a parameter appears as a predicate in an assertion on
 * an expression envelope. The parameter identifies the name of the argument,
 * and the object of the assertion is the argument value.
 *
 * Parameters can be identified in two ways:
 * 1. By a numeric ID (for well-known parameters) - Known variant
 * 2. By a string name (for application-specific parameters) - Named variant
 *
 * A known parameter's id is the reference's `u64`: `value` is a `number`
 * when it is a safe integer and a `bigint` otherwise, `valueBigInt` is
 * always exact. A parameter may carry the value envelope of its argument
 * (`paramValue`), which the reference keeps in the expression envelope.
 *
 * When encoded in CBOR, parameters are tagged with #6.40007.
 */
export class Parameter implements ToEnvelope, ToCbor, CborTagged {
  private readonly _variant: ParameterVariant;
  private readonly _value: bigint; // Only used for 'known' variant
  private readonly _name: string | undefined;
  private readonly _paramValue: Envelope | undefined; // The parameter's value envelope

  private constructor(
    variant: ParameterVariant,
    value: bigint,
    name?: string,
    paramValue?: Envelope,
  ) {
    this._variant = variant;
    this._value = value;
    this._name = name;
    this._paramValue = paramValue;
  }

  /**
   * A known parameter with a numeric id and an optional display name.
   *
   * @throws EnvelopeError `InvalidParameter` when `value` is not a non-negative safe
   *   integer `number` or a `bigint` in `0 ..= 2⁶⁴ − 1`
   */
  static known(value: number | bigint, name?: string): Parameter {
    return new Parameter("known", idToBigInt("value", value), name);
  }

  /** Creates a new named parameter identified by a string. */
  static named(name: string): Parameter {
    return new Parameter("named", 0n, name);
  }

  /**
   * A parameter by known id (a number or bigint) or name (a string),
   * carrying `value` when given.
   *
   * @throws EnvelopeError `InvalidParameter` when a numeric `id` is not a non-negative
   *   safe integer `number` or a `bigint` in `0 ..= 2⁶⁴ − 1`
   */
  static from(id: ParameterID, value?: EnvelopeInput): Parameter {
    const v = value === undefined ? undefined : Envelope.from(value);
    if (typeof id === "string") {
      return new Parameter("named", 0n, id, v);
    }
    return new Parameter("known", idToBigInt("id", id), undefined, v);
  }

  /** Returns true if this is a known (numeric) parameter. */
  isKnown(): boolean {
    return this._variant === "known";
  }

  /** Returns true if this is a named (string) parameter. */
  isNamed(): boolean {
    return this._variant === "named";
  }

  /** The numeric id of a known parameter (a `number` when safe, else a `bigint`); `undefined` for a named one. */
  get value(): number | bigint | undefined {
    return this._variant === "known" ? narrow(this._value) : undefined;
  }

  /** The exact numeric id of a known parameter; `undefined` for a named one. */
  get valueBigInt(): bigint | undefined {
    return this._variant === "known" ? this._value : undefined;
  }

  /** Returns the parameter identifier (the numeric id for known, the name for named). */
  get id(): ParameterID {
    if (this._variant === "known") {
      return narrow(this._value);
    }
    // For named variant, name is always set during construction
    return this._name ?? "";
  }

  /**
   * Returns the display name of the parameter.
   *
   * For known parameters with a name, returns the name.
   * For known parameters without a name, returns the numeric ID as a string.
   * For named parameters, returns the name enclosed in quotes.
   */
  get name(): string {
    if (this._variant === "known") {
      return this._name ?? this._value.toString();
    } else {
      return `"${this._name}"`;
    }
  }

  /** Returns the raw name for named parameters, or undefined for known parameters. */
  get namedName(): string | undefined {
    return this._variant === "named" ? this._name : undefined;
  }

  /** Returns the assigned name if present (for known parameters only). */
  get assignedName(): string | undefined {
    return this._variant === "known" ? this._name : undefined;
  }

  /** Returns the parameter value as an envelope, if set. */
  get paramValue(): Envelope | undefined {
    return this._paramValue;
  }

  /** The parameter tag (40007), named as the global tags store names it at the time. */
  cborTags(): Tag[] {
    return tagsForValues([TAG_PARAMETER.value]);
  }

  /** The bare id: the unsigned integer of a known parameter, the text of a named one. */
  untaggedCbor(): Cbor {
    return this._variant === "known" ? toCbor(this._value) : toCbor(this._name);
  }

  /** `#6.40007(id)`, the tag named as the global tags store names it. */
  toCbor(): Cbor {
    return taggedValue(this.cborTags()[0], this.untaggedCbor());
  }

  /**
   * Tagged-CBOR codec. `decode` requires `#6.40007(n)`: the tag is part of
   * the type, as in the reference's `TryFrom<CBOR>`; use `fromUntaggedCbor`
   * for the bare id. `tags` is named from the global tags store at each
   * access, as the reference's `cbor_tags()` is.
   */
  static get codec(): CborCodec<Parameter> {
    return (PARAMETER_CODEC ??= {
      get tags(): Tag[] {
        return tagsForValues([TAG_PARAMETER.value]);
      },
      encode: (p) => p.toCbor(),
      decode: (c) => Parameter.fromCbor(c),
    });
  }

  /**
   * Decode `#6.40007(id)` (the reference's `TryFrom<CBOR>`).
   *
   * @throws CborError (dcbor's, with a code) — `WrongType` for an untagged value,
   *   `WrongTag` for another tag (both tags named as the global tags store names
   *   them), `Custom` `invalid parameter` for a content that is neither an unsigned
   *   integer nor text
   */
  static fromCbor(cbor: Cbor): Parameter {
    validateTag(cbor, tagsForValues([TAG_PARAMETER.value]));
    return Parameter.fromUntaggedCbor(extractTaggedContent(cbor));
  }

  /**
   * Decode the bare id — the content of tag 40007 (the reference's
   * `from_untagged_cbor`): an unsigned integer is a known parameter, a text
   * a named one.
   *
   * @throws CborError `Custom` `invalid parameter` for anything else
   */
  static fromUntaggedCbor(cbor: Cbor): Parameter {
    const id = decodeIdentity(cbor, "parameter");
    return typeof id === "bigint" ? Parameter.known(id) : Parameter.named(id);
  }

  /**
   * The parameter as an envelope: the leaf `#6.40007(id)`, or the
   * assertion `#6.40007(id): value` when the parameter carries a value.
   */
  toEnvelope(): Envelope {
    const paramLeaf = Envelope.leaf(this.toCbor());
    if (this._paramValue !== undefined) {
      return Envelope.assertion(paramLeaf, this._paramValue);
    }
    return paramLeaf;
  }

  /** Checks equality based on value (for known) or name (for named). */
  equals(other: Parameter): boolean {
    if (this._variant !== other._variant) return false;
    if (this._variant === "known") {
      return this._value === other._value;
    } else {
      return this._name === other._name;
    }
  }

  /**
   * The reference's `Display`: the assigned name or the number for a known
   * parameter, the name in quotes for a named one (`lhs`, `77`, `"x"`); a
   * parameter that carries a value appends `: value`. The `❰…❱` form belongs
   * to the format strings, where the format context prints it on both sides.
   */
  toString(): string {
    const idStr = this.name;
    if (this._paramValue !== undefined) {
      return `${idStr}: ${this._paramValue.asText()}`;
    }
    return idStr;
  }

  /** The `_` (blank) parameter with `value`. */
  static blank(value: EnvelopeInput): Parameter {
    return Parameter.from(PARAMETER_IDS.BLANK, Envelope.from(value));
  }

  /** The `lhs` parameter with `value`. */
  static lhs(value: EnvelopeInput): Parameter {
    return Parameter.from(PARAMETER_IDS.LHS, Envelope.from(value));
  }

  /** The `rhs` parameter with `value`. */
  static rhs(value: EnvelopeInput): Parameter {
    return Parameter.from(PARAMETER_IDS.RHS, Envelope.from(value));
  }
}

//------------------------------------------------------------------------------
// ParametersStore class - matches the reference's ParametersStore
//------------------------------------------------------------------------------

/**
 * A store that maps parameters to their assigned names.
 *
 * ParametersStore maintains a registry of parameters and their human-readable
 * names, which is useful for displaying and debugging expression parameters.
 */
export class ParametersStore {
  private readonly _dict = new Map<bigint | string, Parameter>();

  /** Creates a new ParametersStore with the given parameters. */
  constructor(parameters: Iterable<Parameter> = []) {
    for (const param of parameters) {
      this.register(param);
    }
  }

  /** Inserts a parameter into the store, keyed by its id (known) or name (named). */
  register(param: Parameter): void {
    this._dict.set(storeKey(param), param);
  }

  /**
   * The name the store assigned to `param`, if it is registered: the
   * registered parameter's own name (its assigned name, or its number when
   * it has none), as the reference's `assigned_name` returns the name it
   * filed at insertion.
   */
  assignedNameOf(param: Parameter): string | undefined {
    const stored = this._dict.get(storeKey(param));
    if (stored === undefined) return undefined;
    return stored.isKnown() ? stored.name : stored.namedName;
  }

  /** Returns the name for a parameter, either from this store or from the parameter itself. */
  nameOf(param: Parameter): string {
    const assigned = this.assignedNameOf(param);
    return assigned ?? param.name;
  }

  /** The registered parameters. */
  [Symbol.iterator](): IterableIterator<Parameter> {
    return this._dict.values();
  }

  /** An independent copy (a format context takes one, as the reference does). */
  clone(): ParametersStore {
    return new ParametersStore(this);
  }

  /** The parameter's name in `store` when registered there, else its own name (`name_for_parameter`). */
  static nameForParameter(param: Parameter, store?: ParametersStore): string {
    return store?.assignedNameOf(param) ?? param.name;
  }
}

//------------------------------------------------------------------------------
// Well-known function constants
//------------------------------------------------------------------------------

/** Well-known function `add` (1). */
export const ADD: Function = Function.known(FUNCTION_IDS.ADD, "add");
/** Well-known function `sub` ({@link FUNCTION_IDS}.SUB). */
export const SUB: Function = Function.known(FUNCTION_IDS.SUB, "sub");
/** Well-known function `mul` ({@link FUNCTION_IDS}.MUL). */
export const MUL: Function = Function.known(FUNCTION_IDS.MUL, "mul");
/** Well-known function `div` ({@link FUNCTION_IDS}.DIV). */
export const DIV: Function = Function.known(FUNCTION_IDS.DIV, "div");
/** Well-known function `neg` ({@link FUNCTION_IDS}.NEG). */
export const NEG: Function = Function.known(FUNCTION_IDS.NEG, "neg");
/** Well-known function `lt` ({@link FUNCTION_IDS}.LT). */
export const LT: Function = Function.known(FUNCTION_IDS.LT, "lt");
/** Well-known function `le` ({@link FUNCTION_IDS}.LE). */
export const LE: Function = Function.known(FUNCTION_IDS.LE, "le");
/** Well-known function `gt` ({@link FUNCTION_IDS}.GT). */
export const GT: Function = Function.known(FUNCTION_IDS.GT, "gt");
/** Well-known function `ge` ({@link FUNCTION_IDS}.GE). */
export const GE: Function = Function.known(FUNCTION_IDS.GE, "ge");
/** Well-known function `eq` ({@link FUNCTION_IDS}.EQ). */
export const EQ: Function = Function.known(FUNCTION_IDS.EQ, "eq");
/** Well-known function `ne` ({@link FUNCTION_IDS}.NE). */
export const NE: Function = Function.known(FUNCTION_IDS.NE, "ne");
/** Well-known function `and` ({@link FUNCTION_IDS}.AND). */
export const AND: Function = Function.known(FUNCTION_IDS.AND, "and");
/** Well-known function `or` ({@link FUNCTION_IDS}.OR). */
export const OR: Function = Function.known(FUNCTION_IDS.OR, "or");
/** Well-known function `xor` ({@link FUNCTION_IDS}.XOR). */
export const XOR: Function = Function.known(FUNCTION_IDS.XOR, "xor");
/** Well-known function `not` ({@link FUNCTION_IDS}.NOT). */
export const NOT: Function = Function.known(FUNCTION_IDS.NOT, "not");

//------------------------------------------------------------------------------
// Well-known parameter constants
//------------------------------------------------------------------------------

/** Well-known parameter `_` (1). */
export const BLANK: Parameter = Parameter.known(PARAMETER_IDS.BLANK, "_");
/** Well-known parameter `lhs` ({@link PARAMETER_IDS}.LHS). */
export const LHS: Parameter = Parameter.known(PARAMETER_IDS.LHS, "lhs");
/** Well-known parameter `rhs` ({@link PARAMETER_IDS}.RHS). */
export const RHS: Parameter = Parameter.known(PARAMETER_IDS.RHS, "rhs");

// The constants' names are the reference's `Static` strings (`Debug` only).
for (const constant of [
  ADD,
  SUB,
  MUL,
  DIV,
  NEG,
  LT,
  LE,
  GT,
  GE,
  EQ,
  NE,
  AND,
  OR,
  XOR,
  NOT,
  BLANK,
  LHS,
  RHS,
]) {
  STATIC_NAMED.add(constant);
}

//------------------------------------------------------------------------------
// Global stores
//------------------------------------------------------------------------------

let GLOBAL_FUNCTIONS_STORE: FunctionsStore | undefined;
/** The global shared store of known functions, built on first use. */
export function globalFunctions(): FunctionsStore {
  // The reference seeds four; ids 5–15 stay exported as constants but format as their numbers.
  return (GLOBAL_FUNCTIONS_STORE ??= new FunctionsStore([ADD, SUB, MUL, DIV]));
}

let GLOBAL_PARAMETERS_STORE: ParametersStore | undefined;
/** The global shared store of known parameters, built on first use. */
export function globalParameters(): ParametersStore {
  return (GLOBAL_PARAMETERS_STORE ??= new ParametersStore([BLANK, LHS, RHS]));
}

//------------------------------------------------------------------------------
// Expression class
//------------------------------------------------------------------------------

/** The predicate envelope a parameter lookup matches: the leaf `#6.40007(id)`. */
function predicateOf(param: ParameterID | Parameter): Envelope {
  return (
    param instanceof Parameter ? Parameter.from(param.id) : Parameter.from(param)
  ).toEnvelope();
}

/**
 * A function with its parameters: the expression envelope whose subject is
 * the function leaf and whose assertions are the parameters (`parameter:
 * argument`), as the reference's `Expression` holds its function and
 * envelope.
 *
 * Parameters are assertions, so the same parameter may appear several
 * times (`objectsForParameter` returns every argument) and every
 * assertion, parameter or not, survives a round trip through an envelope.
 */
export class Expression implements ToEnvelope {
  private readonly _function: Function;
  private _envelope: Envelope;

  /** The expression `func` with no parameters yet. */
  constructor(func: Function) {
    this._function = func;
    this._envelope = func.toEnvelope();
  }

  /** Returns the function. */
  get function(): Function {
    return this._function;
  }

  /**
   * The parameters of the expression, each carrying its argument as
   * `paramValue`: every assertion whose predicate decodes as a parameter
   * (`#6.40007(id)`), in the envelope's order. An assertion whose predicate
   * is not a parameter is skipped. A TypeScript convenience: the reference
   * reads parameters one at a time through `object_for_parameter`.
   */
  get parameters(): Parameter[] {
    const result: Parameter[] = [];
    for (const assertion of this._envelope.assertions()) {
      const predicate = assertion.subject().asPredicate()?.asLeaf();
      const object = assertion.asObject();
      if (predicate === undefined || object === undefined) continue;
      let param: Parameter;
      try {
        param = Parameter.fromCbor(predicate);
      } catch {
        continue;
      }
      result.push(Parameter.from(param.id, object));
    }
    return result;
  }

  /**
   * A copy with the assertion `param: value` added (the reference's
   * `with_parameter`); an assertion already present is not repeated.
   */
  withParameter(param: ParameterID | Parameter, value: EnvelopeInput): Expression {
    const next = new Expression(this._function);
    next._envelope = this._envelope.addAssertion(predicateOf(param), value);
    return next;
  }

  /** Adds multiple parameters at once; returns a new expression. */
  withParameters(params: Record<string, EnvelopeInput>): Expression {
    return Object.entries(params).reduce<Expression>(
      (acc, [key, value]) => acc.withParameter(key, value),
      this,
    );
  }

  /**
   * The argument of the single `param` assertion (the reference's
   * `object_for_parameter`).
   *
   * @throws EnvelopeError `NonexistentPredicate` when there is none, `AmbiguousPredicate`
   *   when there are several
   */
  objectForParameter(param: ParameterID | Parameter): Envelope {
    return this._envelope.objectForPredicate(predicateOf(param));
  }

  /**
   * The argument of the single `param` assertion, or `undefined` when there
   * is none (the reference's `optional_object_for_parameter`).
   *
   * @throws EnvelopeError `AmbiguousPredicate` when there are several
   */
  parameter(param: ParameterID | Parameter): Envelope | undefined {
    return this._envelope.optionalObjectForPredicate(predicateOf(param));
  }

  /** The arguments of every `param` assertion (the reference's `objects_for_parameter`). */
  objectsForParameter(param: ParameterID | Parameter): Envelope[] {
    return this._envelope.objectsForPredicate(predicateOf(param));
  }

  /** `true` when at least one `param` assertion is present. */
  hasParameter(param: ParameterID | Parameter): boolean {
    return this.objectsForParameter(param).length > 0;
  }

  /** The expression envelope: the function leaf with the parameter assertions. */
  toEnvelope(): Envelope {
    return this._envelope;
  }

  /**
   * Reads an expression from an envelope (the reference's
   * `Expression::try_from((envelope, expected_function))`): the subject is
   * extracted as a function and the envelope is kept as it is, so
   * assertions that are not parameters survive a round trip.
   *
   * @throws EnvelopeError `Cbor` with the reference's dcbor Display as its message:
   *   `invalid format` when the subject is not a leaf, `dcbor error: <reason>` when the
   *   leaf is not a function (`dcbor error: invalid function`, `dcbor error: expected
   *   CBOR tag function, but got 40007`), and `Expected function <expected>, but found
   *   <found>` (the reference's `Debug` renderings) when `expectedFunction` is given
   *   and differs
   */
  static fromEnvelope(envelope: Envelope, expectedFunction?: Function): Expression {
    let func: Function;
    try {
      func = envelope.expectSubject((cbor) => Function.fromCbor(cbor));
    } catch (error) {
      if (EnvelopeError.isEnvelopeError(error)) {
        throw EnvelopeError.cborDecode(CborError.custom(error.message));
      }
      throw error;
    }
    if (expectedFunction !== undefined && !func.equals(expectedFunction)) {
      throw EnvelopeError.cborDecode(
        CborError.custom(
          `Expected function ${debugOf(expectedFunction)}, but found ${debugOf(func)}`,
        ),
      );
    }
    const expr = new Expression(func);
    expr._envelope = envelope;
    return expr;
  }

  /**
   * The reference's `Display`: the expression's format string, quoted and
   * escaped (`write!(f, "{:?}", self.envelope.format())`); `JSON.stringify`
   * produces the same text for the characters a format string contains.
   */
  toString(): string {
    return JSON.stringify(this.toEnvelope().format());
  }
}

//------------------------------------------------------------------------------
// Helper functions for creating common expressions
//------------------------------------------------------------------------------

/** Creates an addition expression: lhs + rhs */
export function add(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression {
  return new Expression(ADD)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/** Creates a subtraction expression: lhs - rhs */
export function sub(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression {
  return new Expression(SUB)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/** Creates a multiplication expression: lhs * rhs */
export function mul(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression {
  return new Expression(MUL)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/** Creates a division expression: lhs / rhs */
export function div(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression {
  return new Expression(DIV)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/** Creates a negation expression: -value */
export function neg(value: EnvelopeInput): Expression {
  return new Expression(NEG).withParameter(PARAMETER_IDS.BLANK, value);
}

/** Creates a less-than expression: lhs < rhs */
export function lt(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression {
  return new Expression(LT)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/** Creates a less-than-or-equal expression: lhs <= rhs */
export function le(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression {
  return new Expression(LE)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/** Creates a greater-than expression: lhs > rhs */
export function gt(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression {
  return new Expression(GT)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/** Creates a greater-than-or-equal expression: lhs >= rhs */
export function ge(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression {
  return new Expression(GE)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/** Creates an equality expression: lhs == rhs */
export function eq(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression {
  return new Expression(EQ)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/** Creates a not-equal expression: lhs != rhs */
export function ne(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression {
  return new Expression(NE)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/** Creates a logical AND expression: lhs && rhs */
export function and(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression {
  return new Expression(AND)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/** Creates a logical OR expression: lhs || rhs */
export function or(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression {
  return new Expression(OR)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/** Creates a logical XOR expression: lhs ^ rhs */
export function xor(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression {
  return new Expression(XOR)
    .withParameter(PARAMETER_IDS.LHS, lhs)
    .withParameter(PARAMETER_IDS.RHS, rhs);
}

/** Creates a logical NOT expression: !value */
export function not(value: EnvelopeInput): Expression {
  return new Expression(NOT).withParameter(PARAMETER_IDS.BLANK, value);
}
