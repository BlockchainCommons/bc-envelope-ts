import {
  type Cbor,
  cbor as toCbor,
  taggedValue,
  asTaggedValue,
  expectInteger,
  isInteger,
  expectText,
  isText,
} from "@blockchaincommons/dcbor";

import { TAG_FUNCTION, TAG_PARAMETER } from "@blockchaincommons/tags";

import { Envelope } from "../base/envelope";
import { type ToEnvelope, type EnvelopeInput } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";

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

/** Type for function identifier (number or string) */
export type FunctionID = number | string;

/** Type for parameter identifier (number or string) */
export type ParameterID = number | string;

//------------------------------------------------------------------------------
// Function class - matches the reference's Function enum
//------------------------------------------------------------------------------

/** Type tag for function variant */
type FunctionVariant = "known" | "named";

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
 * When encoded in CBOR, functions are tagged with #6.40006.
 */
export class Function implements ToEnvelope {
  private readonly _variant: FunctionVariant;
  private readonly _value: number; // Only used for 'known' variant
  private readonly _name: string | undefined;

  private constructor(variant: FunctionVariant, value: number, name?: string) {
    this._variant = variant;
    this._value = value;
    this._name = name;
  }

  /** A function by known id (number) or name (string). */
  static from(id: FunctionID): Function {
    return typeof id === "number" ? Function.known(id) : Function.named(id);
  }

  /** A known function with a numeric id and an optional display name. */
  static known(value: number, name?: string): Function {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw EnvelopeError.invalidParameter("value", "an unsigned integer", value);
    }
    return new Function("known", value, name);
  }

  /** Creates a new named function identified by a string. */
  static named(name: string): Function {
    return new Function("named", 0, name);
  }

  /** Returns true if this is a known (numeric) function. */
  isKnown(): boolean {
    return this._variant === "known";
  }

  /** Returns true if this is a named (string) function. */
  isNamed(): boolean {
    return this._variant === "named";
  }

  /** Returns the numeric value for known functions. */
  get value(): number | undefined {
    return this._variant === "known" ? this._value : undefined;
  }

  /** Returns the function identifier (number for known, string for named). */
  get id(): FunctionID {
    if (this._variant === "known") {
      return this._value;
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

  /**
   * Creates an expression envelope with this function as the subject.
   *
   * which calls `Envelope::new_leaf(self)` — that goes through
   * `From<Function> for CBOR = self.tagged_cbor()` which produces
   * `tag(40006, untagged)` where untagged is `uint(N)` for Known
   * or `text(name)` for Named.
   *
   * The earlier TS port pre-formatted the display string into a
   * text leaf (`Envelope.from("«\"name\"»")`), which breaks the
   * TAG_FUNCTION summarizer (it never fires because the leaf is
   * not tagged), so format() rendered the leaf as a quoted string
   * instead of `«"name"»`.
   */
  toEnvelope(): Envelope {
    const untagged: Cbor = this._variant === "known" ? toCbor(this._value) : toCbor(this._name);
    return Envelope.leaf(taggedValue(TAG_FUNCTION.value, untagged));
  }

  /** Creates an expression with a parameter. */
  withParameter(param: ParameterID, value: EnvelopeInput): Expression {
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

  /** Returns a string representation for display. */
  toString(): string {
    return this._variant === "known" ? `«${this._value}»` : `«"${this._name}"»`;
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
  private readonly _dict = new Map<number | string, Function>();

  /** Creates a new FunctionsStore with the given functions. */
  constructor(functions: Iterable<Function> = []) {
    for (const func of functions) {
      this.register(func);
    }
  }

  /** Inserts a function into the store. */
  register(func: Function): void {
    if (func.isKnown()) {
      const value = func.value;
      if (value !== undefined) {
        this._dict.set(value, func);
      }
    } else {
      const name = func.namedName;
      if (name !== undefined) {
        this._dict.set(name, func);
      }
    }
  }

  /** Returns the assigned name for a function, if it exists in the store. */
  assignedNameOf(func: Function): string | undefined {
    let key: number | string | undefined;
    if (func.isKnown()) {
      key = func.value;
    } else {
      key = func.namedName;
    }
    if (key === undefined) return undefined;
    const stored = this._dict.get(key);
    return stored?.assignedName;
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

  /** The function's name in `store` when registered there, else its own name. */
  static nameForFunction(func: Function, store?: FunctionsStore): string {
    if (store !== undefined) {
      const assigned = store.assignedNameOf(func);
      if (assigned !== undefined && assigned !== "") return assigned;
    }
    return func.name;
  }
}

//------------------------------------------------------------------------------
// Parameter class - matches the reference's Parameter enum
//------------------------------------------------------------------------------

/** Type tag for parameter variant */
type ParameterVariant = "known" | "named";

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
 * When encoded in CBOR, parameters are tagged with #6.40007.
 */
export class Parameter implements ToEnvelope {
  private readonly _variant: ParameterVariant;
  private readonly _value: number; // Only used for 'known' variant, or 0 for 'named'
  private readonly _name: string | undefined;
  private readonly _paramValue: Envelope | undefined; // The parameter's value envelope

  private constructor(
    variant: ParameterVariant,
    value: number,
    name?: string,
    paramValue?: Envelope,
  ) {
    this._variant = variant;
    this._value = value;
    this._name = name;
    this._paramValue = paramValue;
  }

  /** Creates a new known parameter with a numeric ID and optional name. */
  static known(value: number, name?: string): Parameter {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw EnvelopeError.invalidParameter("value", "an unsigned integer", value);
    }
    return new Parameter("known", value, name);
  }

  /** Creates a new named parameter identified by a string. */
  static named(name: string): Parameter {
    return new Parameter("named", 0, name);
  }

  /** A parameter by known id or name, carrying `value` when given. */
  static from(id: ParameterID, value?: EnvelopeInput): Parameter {
    const v = value === undefined ? undefined : Envelope.from(value);
    if (typeof id === "number") {
      if (!Number.isSafeInteger(id) || id < 0) {
        throw EnvelopeError.invalidParameter("id", "an unsigned integer", id);
      }
      return new Parameter("known", id, undefined, v);
    }
    return new Parameter("named", 0, id, v);
  }

  /** Returns true if this is a known (numeric) parameter. */
  isKnown(): boolean {
    return this._variant === "known";
  }

  /** Returns true if this is a named (string) parameter. */
  isNamed(): boolean {
    return this._variant === "named";
  }

  /** Returns the numeric value for known parameters. */
  get value(): number | undefined {
    return this._variant === "known" ? this._value : undefined;
  }

  /** Returns the parameter identifier (number for known, string for named). */
  get id(): ParameterID {
    if (this._variant === "known") {
      return this._value;
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

  /**
   * Creates a parameter envelope.
   *
   * Same encoding as `Function.toEnvelope` above: the parameter is stored
   * as `tag(40007, untagged)` where untagged is `uint(N)` (Known) or
   * `text(name)` (Named).
   */
  toEnvelope(): Envelope {
    const untagged: Cbor = this._variant === "known" ? toCbor(this._value) : toCbor(this._name);
    const paramLeaf = Envelope.leaf(taggedValue(TAG_PARAMETER.value, untagged));
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

  /** Returns a string representation for display. */
  toString(): string {
    const idStr = this._variant === "known" ? `❰${this._value}❱` : `❰"${this._name}"❱`;
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
  private readonly _dict = new Map<number | string, Parameter>();

  /** Creates a new ParametersStore with the given parameters. */
  constructor(parameters: Iterable<Parameter> = []) {
    for (const param of parameters) {
      this.register(param);
    }
  }

  /** Inserts a parameter into the store. */
  register(param: Parameter): void {
    if (param.isKnown()) {
      const value = param.value;
      if (value !== undefined) {
        this._dict.set(value, param);
      }
    } else {
      const name = param.namedName;
      if (name !== undefined) {
        this._dict.set(name, param);
      }
    }
  }

  /** Returns the assigned name for a parameter, if it exists in the store. */
  assignedNameOf(param: Parameter): string | undefined {
    let key: number | string | undefined;
    if (param.isKnown()) {
      key = param.value;
    } else {
      key = param.namedName;
    }
    if (key === undefined) return undefined;
    const stored = this._dict.get(key);
    return stored?.assignedName;
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

  /** The parameter's name in `store` when registered there, else its own name. */
  static nameForParameter(param: Parameter, store?: ParametersStore): string {
    if (store !== undefined) {
      const assigned = store.assignedNameOf(param);
      if (assigned !== undefined && assigned !== "") return assigned;
    }
    return param.name;
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

/**
 * Represents a complete expression with function and parameters.
 *
 * Parameters are stored as an *append-only array*, mirroring the reference
 * `bc-envelope`'s `Expression` which adds each parameter as a fresh
 * envelope assertion (multiple values per parameter ID are valid —
 * e.g. GSTP DKG invites carry multiple `participant` parameters).
 * Earlier the TS port used `Map<string, Parameter>`, which silently
 * overwrote previous values with the same parameter ID. The
 * resulting envelope had only the last `participant`, breaking
 * `objectsForParameter("participant")` decoders downstream
 * (`frost-hubert/group-invite.ts:383`).
 */
export class Expression implements ToEnvelope {
  private readonly _function: Function;
  private readonly _parameters: Parameter[] = [];
  private _envelope: Envelope | null = null;

  constructor(func: Function) {
    this._function = func;
  }

  /** Returns the function. */
  get function(): Function {
    return this._function;
  }

  /** Returns all parameters. */
  get parameters(): Parameter[] {
    return this._parameters.slice();
  }

  /** Adds a parameter to the expression. */
  withParameter(param: ParameterID, value: EnvelopeInput): Expression {
    // A builder returns a new expression; the receiver is unchanged.
    const next = new Expression(this._function);
    next._parameters.push(...this._parameters, Parameter.from(param, value));
    return next;
  }

  /** Adds multiple parameters at once; returns a new expression. */
  withParameters(params: Record<string, EnvelopeInput>): Expression {
    return Object.entries(params).reduce<Expression>(
      (acc, [key, value]) => acc.withParameter(key, value),
      this,
    );
  }

  /** Returns true if the parameter ID matches the one stored on a Parameter. */
  private static parameterIdMatches(stored: ParameterID, query: ParameterID): boolean {
    if (typeof stored === "number" && typeof query === "number") return stored === query;
    if (typeof stored === "string" && typeof query === "string") return stored === query;
    // Cross-type: numeric IDs are stringified to compare against named lookups.
    return String(stored) === String(query);
  }

  /**
   * Gets the first parameter value with the given ID.
   *
   * For multi-valued parameters (e.g. several `participant` assertions),
   * use {@link objectsForParameter} to retrieve all matching values.
   */
  parameter(param: ParameterID): Envelope | undefined {
    const found = this._parameters.find((p) => Expression.parameterIdMatches(p.id, param));
    return found?.paramValue;
  }

  /**
   * Returns all parameter values matching the given ID.
   *
   * to `Envelope::objects_for_predicate` and returns a `Vec<Envelope>`.
   */
  objectsForParameter(param: ParameterID): Envelope[] {
    const matches: Envelope[] = [];
    for (const p of this._parameters) {
      if (Expression.parameterIdMatches(p.id, param)) {
        const v = p.paramValue;
        if (v !== undefined) matches.push(v);
      }
    }
    return matches;
  }

  /** Checks if a parameter exists. */
  hasParameter(param: ParameterID): boolean {
    return this._parameters.some((p) => Expression.parameterIdMatches(p.id, param));
  }

  /** Converts the expression to an envelope. */
  toEnvelope(): Envelope {
    if (this._envelope !== null) {
      return this._envelope;
    }

    // Start with function envelope
    let env = this._function.toEnvelope();

    // Add all parameters as assertions. Each parameter's envelope is
    // itself an assertion (`Parameter.toEnvelope()` returns
    // `Envelope.assertion(parameterLeaf, value)`); we extract the
    // predicate (a tagged-CBOR Parameter leaf, post-M0/G1 fix) and
    // attach it to the function envelope as a fresh assertion.
    // Earlier this passed `predicate.asText()` (which only works
    // when the parameter is stored as a display string) so the
    // tagged-CBOR predicate would have produced `undefined` and the
    // assertion would silently be skipped.
    for (const param of this._parameters.values()) {
      const paramEnv = param.toEnvelope();
      const paramCase = paramEnv.case;
      if (paramCase.type === "assertion") {
        const predicate = paramCase.assertion.predicate();
        const object = paramCase.assertion.object();
        env = env.addAssertion(predicate, object);
      }
    }

    this._envelope = env;
    return env;
  }

  /**
   * Creates an expression from an envelope.
   *
   * The function and each parameter are read as **tagged CBOR**
   * (tag 40006 / tag 40007). Earlier the TS port stored these as
   * pre-formatted display strings (e.g. `«"test"»`, `❰"param1"❱`)
   * and parsed them by string matching; that diverged from the reference
   * (which stores tag-40006/40007 leaves) and prevented the
   * TAG_FUNCTION / TAG_PARAMETER format summarizers from firing.
   */
  static fromEnvelope(envelope: Envelope, expectedFunction?: Function): Expression {
    const subject = envelope.subject();
    const func = readFunctionFromLeaf(subject);
    if (expectedFunction !== undefined && !func.equals(expectedFunction)) {
      throw EnvelopeError.cbor(
        `expected function ${expectedFunction.toString()}, but found ${func.toString()}`,
      );
    }
    let expr = new Expression(func);

    for (const assertion of envelope.assertions()) {
      try {
        const pred = assertion.subject().asPredicate();
        const obj = assertion.asObject();
        if (pred === undefined || obj === undefined) continue;
        const paramId = tryReadParameterIdFromLeaf(pred);
        if (paramId !== undefined) {
          expr = expr.withParameter(paramId, obj);
        }
      } catch {
        // Skip non-parameter assertions
        continue;
      }
    }

    // The reference keeps the envelope it was read from, so assertions that
    // are not parameters survive a round trip (B13).
    expr._envelope = envelope;
    return expr;
  }

  /** Returns a string representation for display. */
  toString(): string {
    const params = Array.from(this._parameters.values())
      .map((p) => p.toString())
      .join(", ");
    return `${this._function.toString()} [${params}]`;
  }
}

//------------------------------------------------------------------------------
// Helper functions for creating common expressions
//------------------------------------------------------------------------------

/**
 * Decode a Function from an envelope leaf containing a tag-40006
 * tagged CBOR value (`tag(40006, uint(N))` for Known,
 * `tag(40006, text(name))` for Named).
 */
function readFunctionFromLeaf(envelope: Envelope): Function {
  // The reference's `extract_subject::<Function>`: `InvalidFormat` for a
  // non-leaf subject, `Cbor` when the leaf is not a tagged function.
  const leaf = envelope.case;
  if (leaf.type !== "leaf") {
    throw EnvelopeError.invalidFormat();
  }
  const tagged = asTaggedValue(leaf.cbor);
  if (tagged === undefined || Number(tagged[0].value) !== TAG_FUNCTION.value) {
    throw EnvelopeError.cbor(
      `expected CBOR tag function (${TAG_FUNCTION.value}), but got ${tagged === undefined ? "an untagged value" : String(tagged[0].value)}`,
    );
  }
  const inner = tagged[1];
  if (isInteger(inner)) {
    return Function.known(Number(expectInteger(inner)));
  }
  if (isText(inner)) {
    return Function.named(expectText(inner));
  }
  throw EnvelopeError.cbor("invalid function");
}

/**
 * If `envelope` is a leaf containing a tag-40007 (Parameter) value,
 * return the parsed `ParameterID`; otherwise `undefined`. Mirrors
 * the reference `Parameter::from_tagged_cbor`.
 */
function tryReadParameterIdFromLeaf(envelope: Envelope): ParameterID | undefined {
  const c = envelope.case;
  if (c.type !== "leaf") return undefined;
  const tagged = asTaggedValue(c.cbor);
  if (tagged === undefined || Number(tagged[0].value) !== TAG_PARAMETER.value) {
    return undefined;
  }
  const inner = tagged[1];
  if (isInteger(inner)) return Number(expectInteger(inner));
  if (isText(inner)) return expectText(inner);
  return undefined;
}

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
