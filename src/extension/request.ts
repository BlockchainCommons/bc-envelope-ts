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
import { taggedValue, CborDate } from "@blockchaincommons/dcbor";
import { BODY, NOTE, DATE } from "@blockchaincommons/known-values";

import { Envelope } from "../base/envelope";
import { type ToEnvelope, type EnvelopeInput } from "../base/envelope-encodable";
import { Expression, Function, type FunctionID, type ParameterID } from "./expression";
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
  private readonly _date: Date | undefined;

  private constructor(body: Expression, id: ARID, note = "", date?: Date) {
    this._body = body;
    this._id = id;
    this._note = note;
    this._date = date;
  }

  /**
   * A request for `func` (a `Function`, a known-function number, a name, or
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
  withParameter(param: ParameterID, value: EnvelopeInput): Request {
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
   * Adds a date to the request.
   */
  withDate(date: Date): Request {
    return new Request(this._body, this._id, this._note, date);
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
   * Returns the date attached to the request, if any.
   */
  get date(): Date | undefined {
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
    // Create the tagged ARID as the subject
    // Wrap the **tagged** ARID inside the request tag — mirrors the reference
    // `CBOR::to_tagged_value(TAG_REQUEST, request.id)`, which goes
    // through the `From<ARID> for CBOR` impl that returns the tagged
    // form. Earlier the TS port stored an untagged ARID byte string,
    // so format() rendered the request subject as `Bytes(32)` instead
    // of `ARID(<short>)` — observable in the GSTP byte-shape pins.
    const taggedArid = taggedValue(TAG_REQUEST, this._id.toCbor());

    let envelope = Envelope.leaf(taggedArid).addAssertion(BODY, this._body.toEnvelope());

    if (this._note !== "") {
      envelope = envelope.addAssertion(NOTE, this._note);
    }

    if (this._date !== undefined) {
      // Pass a tagged-CBOR Date (tag 1); mirrors the reference
      // `Envelope::add_assertion(DATE, self.date)` which dispatches via
      // `Date → CBOR` (tag 1). The earlier port stored the ISO 8601
      // string here, producing a different CBOR object and digest.
      envelope = envelope.addAssertion(DATE, CborDate.fromDate(this._date));
    }

    return envelope;
  }

  /**
   * Creates a request from an envelope.
   *
   * @throws EnvelopeError with code `General`.
   */
  static fromEnvelope(envelope: Envelope, expectedFunction?: Function): Request {
    // `NonexistentPredicate` / `AmbiguousPredicate` when the body is not exactly one.
    const body = Expression.fromEnvelope(envelope.objectForPredicate(BODY), expectedFunction);

    // The subject is TAG_REQUEST(ARID); `NotLeaf` / `Cbor` when it is not.
    const id = decodeTaggedId(envelope, TAG_REQUEST.value);

    // A `'note'` must be text and a `'date'` a tag-1 date when present (`Cbor` otherwise).
    const note = envelope.optionalObjectForPredicate(NOTE)?.expectString() ?? "";
    const date = envelope.optionalObjectForPredicate(DATE)?.expectDate();

    return new Request(body, id, note, date);
  }

  /**
   * Returns a string representation of the request.
   */
  toString(): string {
    return `Request(${this.summary()})`;
  }

  /**
   * Checks equality with another request.
   */
  equals(other: Request): boolean {
    return (
      this._id.equals(other._id) &&
      this._note === other._note &&
      this._date?.getTime() === other._date?.getTime()
    );
  }
}
