/**
 * Request type for distributed function calls.
 *
 * A Request represents a message requesting execution of a function with
 * parameters. Requests are part of the expression system that enables
 * distributed function calls and communication between systems.
 *
 * Each request:
 * - Contains a body (an Expression) that represents the function to be executed
 * - Has a unique identifier (ARID) for tracking and correlation
 * - May include optional metadata like a note and timestamp
 *
 * Requests are designed to be paired with Response objects that contain the
 * results of executing the requested function.
 *
 * When serialized to an envelope, requests are tagged with REQUEST tag.
 */

import { type ARID } from "@blockchaincommons/components";
import { TAG_REQUEST } from "@blockchaincommons/tags";
import { taggedValue, CborDate, expectText } from "@blockchaincommons/dcbor";
import { BODY, NOTE, DATE } from "@blockchaincommons/known-values";

import { Envelope } from "../base/envelope";
import { type ToEnvelope, type EnvelopeInput } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
import { cborErrorAt } from "../base/foreign-errors.js";
import {
  Expression,
  Function,
  type FunctionID,
  type ParameterID,
  type Parameter,
} from "./expression";
import { decodeTaggedId } from "./tagged-id";
import { formatFlat } from "../format/notation.js";

/**
 * A Request represents a message requesting execution of a function with parameters.
 *
 * @example
 * ```typescript
 * import { Request, ARID } from '@blockchaincommons/envelope';
 *
 * // Create a random request ID
 * const requestId = ARID.new();
 *
 * // Create a request to execute a function with parameters
 * const request = Request.from("getBalance", requestId)
 *   .withParameter("account", "alice")
 *   .withParameter("currency", "USD")
 *   .withNote("Monthly balance check");
 *
 * // Convert to an envelope
 * const envelope = request.toEnvelope();
 * ```
 */
export class Request implements ToEnvelope {
  private readonly _body: Expression;
  private readonly _id: ARID;
  private readonly _note: string;
  private readonly _date: CborDate | undefined;

  private constructor(body: Expression, id: ARID, note = "", date?: CborDate) {
    this._body = body;
    this._id = id;
    this._note = note;
    this._date = date;
  }

  /**
   * A request for `func` (a `Function`, a known-function id, a name, or
   * a ready `Expression`) identified by `id`.
   */
  static from(func: Function | Expression | FunctionID, id: ARID): Request {
    const body =
      func instanceof Expression
        ? func
        : new Expression(func instanceof Function ? func : Function.from(func));
    return new Request(body, id);
  }

  /**
   * Returns a human-readable summary of the request.
   */
  summary(): string {
    return `id: ${this._id.shortDescription()}, body: ${formatFlat(this._body.toEnvelope())}`;
  }

  /**
   * Adds a parameter to the request.
   */
  withParameter(param: ParameterID | Parameter, value: EnvelopeInput): Request {
    // Builders return a new request; the receiver is unchanged.
    return new Request(this._body.withParameter(param, value), this._id, this._note, this._date);
  }

  /**
   * Adds a note to the request.
   */
  withNote(note: string): Request {
    return new Request(this._body, this._id, note, this._date);
  }

  /**
   * Adds a date to the request: a `CborDate` is kept as it is (the
   * reference's `Date`, exact to the nanosecond); a JavaScript `Date`
   * converts through `CborDate.fromDate`.
   */
  withDate(date: Date | CborDate): Request {
    return new Request(
      this._body,
      this._id,
      this._note,
      date instanceof Date ? CborDate.fromDate(date) : date,
    );
  }

  /**
   * Returns the body of the request (the expression to be evaluated).
   */
  get body(): Expression {
    return this._body;
  }

  /**
   * Returns the unique identifier (ARID) of the request.
   */
  get id(): ARID {
    return this._id;
  }

  /**
   * Returns the note attached to the request, or an empty string if none exists.
   */
  get note(): string {
    return this._note;
  }

  /**
   * The date attached to the request as a JavaScript `Date` (millisecond
   * precision), if any; `cborDate` is the exact value.
   */
  get date(): Date | undefined {
    return this._date?.toDate();
  }

  /** The date attached to the request, if any: the stored `CborDate`, exact as decoded or given. */
  get cborDate(): CborDate | undefined {
    return this._date;
  }

  /**
   * Returns the function of the request.
   */
  get function(): Function {
    return this._body.function;
  }

  /**
   * Returns the expression envelope of the request.
   */
  get expressionEnvelope(): Envelope {
    return this._body.toEnvelope();
  }

  /**
   * Converts the request to an envelope.
   *
   * The envelope's subject is the request's ID tagged with TAG_REQUEST,
   * and assertions include the request's body, note (if not empty), and date (if present).
   */
  toEnvelope(): Envelope {
    // The subject is the tagged ARID inside the request tag, as the
    // reference's `CBOR::to_tagged_value(TAG_REQUEST, request.id)` builds it;
    // the outer tag is the bare number, as the reference's constant is.
    const taggedArid = taggedValue(TAG_REQUEST.value, this._id.toCbor());

    let envelope = Envelope.leaf(taggedArid).addAssertion(BODY, this._body.toEnvelope());

    if (this._note !== "") {
      envelope = envelope.addAssertion(NOTE, this._note);
    }

    if (this._date !== undefined) {
      // The stored date's own tag-1 encoding, as the reference's
      // `add_optional_assertion(DATE, self.date)` dispatches through `Date → CBOR`.
      envelope = envelope.addAssertion(DATE, this._date);
    }

    return envelope;
  }

  /**
   * Reads a request from an envelope (the reference's
   * `Request::try_from((envelope, expected_function))`): the `'body'`
   * object as an expression, the subject as `TAG_REQUEST(ARID)`, the
   * `'note'` and `'date'` objects by subject extraction.
   *
   * @throws EnvelopeError `NonexistentPredicate` / `AmbiguousPredicate` when the body is
   *   not exactly one; `Cbor` (`dcbor error: <reason>`) when the body is not an
   *   expression or is not `expectedFunction`; `NotLeaf` / `Cbor` when the subject is not
   *   `TAG_REQUEST(ARID)`; `Cbor` / `InvalidFormat` when a `'note'` is not text or a
   *   `'date'` is not a tag-1 date
   */
  static fromEnvelope(envelope: Envelope, expectedFunction?: Function): Request {
    const bodyEnvelope = envelope.objectForPredicate(BODY);
    let body: Expression;
    try {
      body = Expression.fromEnvelope(bodyEnvelope, expectedFunction);
    } catch (error) {
      // The reference's `?` into `Error::Cbor`: `dcbor error: ` before the dcbor text.
      if (EnvelopeError.isEnvelopeError(error)) throw cborErrorAt(error);
      throw error;
    }

    const id = decodeTaggedId(envelope, TAG_REQUEST.value);

    const note = envelope.objectForPredicateOr(NOTE, expectText, "");
    const date = envelope.optionalObjectForPredicateAs(DATE, (cbor) =>
      CborDate.fromTaggedCbor(cbor),
    );

    return new Request(body, id, note, date);
  }

  /**
   * Returns a string representation of the request.
   */
  toString(): string {
    return `Request(${this.summary()})`;
  }

  /**
   * Checks equality with another request: the id, the note, the exact
   * date and the body envelope must all be equal (the reference's derived
   * `PartialEq`).
   */
  equals(other: Request): boolean {
    return (
      this._id.equals(other._id) &&
      this._note === other._note &&
      datesEqual(this._date, other._date) &&
      this._body.function.equals(other._body.function) &&
      this._body.toEnvelope().digest().equals(other._body.toEnvelope().digest())
    );
  }
}

/** Both absent, or both present and equal to the nanosecond. */
export function datesEqual(a: CborDate | undefined, b: CborDate | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.equals(b);
}
