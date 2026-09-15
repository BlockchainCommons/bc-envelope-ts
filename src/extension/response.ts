/**
 * Response type for distributed function calls.
 *
 * A Response represents a reply to a Request containing either a
 * successful result or an error.
 *
 * Responses are part of the expression system that enables distributed
 * function calls. Each response contains:
 * - A reference to the original request's ID (ARID) for correlation
 * - Either a successful result or an error message
 *
 * When serialized to an envelope, responses are tagged with RESPONSE tag.
 */

import { type ARID } from "@blockchaincommons/components";
import { TAG_RESPONSE } from "@blockchaincommons/tags";
import { taggedValue } from "@blockchaincommons/dcbor";
import { RESULT, ERROR, OK_VALUE, UNKNOWN_VALUE } from "@blockchaincommons/known-values";

import { Envelope, type CborDecoder } from "../base/envelope";
import { type ToEnvelope, type EnvelopeInput } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
import { decodeId, expectTaggedSubject, tryKnownValue } from "./tagged-id";
import { formatFlat } from "../format/notation.js";

/**
 * Type representing a successful response: (ARID, result envelope)
 */
interface SuccessResult {
  ok: true;
  id: ARID;
  result: Envelope;
}

/**
 * Type representing a failed response: (optional ARID, error envelope)
 */
interface FailureResult {
  ok: false;
  id: ARID | undefined;
  error: Envelope;
}

/**
 * Internal result type for Response
 */
type ResponseResult = SuccessResult | FailureResult;

/**
 * A Response represents a reply to a Request containing either a
 * successful result or an error.
 *
 * @example
 * ```typescript
 * import { Response, ARID } from '@blockchaincommons/envelope';
 *
 * // Create a request ID (normally this would come from the original request)
 * const requestId = ARID.new();
 *
 * // Create a successful response
 * const successResponse = Response.success(requestId)
 *   .withResult("Transaction completed");
 *
 * // Create an error response
 * const errorResponse = Response.failure(requestId)
 *   .withError("Insufficient funds");
 *
 * // Convert to envelopes
 * const successEnvelope = successResponse.toEnvelope();
 * const errorEnvelope = errorResponse.toEnvelope();
 * ```
 */
export class Response implements ToEnvelope {
  private readonly _result: ResponseResult;

  private constructor(result: ResponseResult) {
    this._result = result;
  }

  /**
   * Creates a new successful response with the specified request ID.
   *
   * By default, the result will be the 'OK' known value. Use `withResult`
   * to set a specific result value.
   */
  static success(id: ARID): Response {
    return new Response({
      ok: true,
      id,
      result: Response.OK,
    });
  }

  /**
   * Creates a new failure response with the specified request ID.
   *
   * By default, the error will be the 'Unknown' known value. Use
   * `withError` to set a specific error message.
   */
  static failure(id: ARID): Response {
    return new Response({
      ok: false,
      id,
      error: Response.UNKNOWN,
    });
  }

  /**
   * Creates a new early failure response without a request ID.
   *
   * An early failure occurs when the error happens before the request
   * has been fully processed, so the request ID is not known.
   */
  static earlyFailure(): Response {
    return new Response({
      ok: false,
      id: undefined,
      error: Response.UNKNOWN,
    });
  }

  /**
   * Creates an envelope containing the 'Unknown' known value.
   */
  static get UNKNOWN(): Envelope {
    return Envelope.from(UNKNOWN_VALUE);
  }

  /**
   * Creates an envelope containing the 'OK' known value.
   */
  static get OK(): Envelope {
    return Envelope.from(OK_VALUE);
  }

  /**
   * Returns a human-readable summary of the response.
   */
  summary(): string {
    if (this._result.ok) {
      return `id: ${this._result.id.shortDescription()}, result: ${formatFlat(this._result.result)}`;
    } else {
      // The reference's `summary()` separates the id and the error with a
      // space (no comma) on the failure branches.
      const idStr =
        this._result.id !== undefined ? this._result.id.shortDescription() : "'Unknown'";
      return `id: ${idStr} error: ${formatFlat(this._result.error)}`;
    }
  }

  /**
   * Sets the result value for a successful response.
   * @throws Error if called on a failure response.
   */
  withResult(result: EnvelopeInput): Response {
    if (!this._result.ok) {
      throw EnvelopeError.general("Cannot set result on a failed response");
    }
    // Builders return a new response; the receiver is unchanged.
    return new Response({
      ok: true,
      id: this._result.id,
      result: Envelope.from(result),
    });
  }

  /** A copy with `result` when given, with a `null` result otherwise (as the reference). */
  withOptionalResult(result: EnvelopeInput | undefined): Response {
    if (result !== undefined) {
      return this.withResult(result);
    }
    return this.withResult(null);
  }

  /**
   * Sets the error value for a failure response.
   * @throws Error if called on a successful response.
   */
  withError(error: EnvelopeInput): Response {
    if (this._result.ok) {
      throw EnvelopeError.general("Cannot set error on a successful response");
    }
    return new Response({
      ok: false,
      id: this._result.id,
      error: Envelope.from(error),
    });
  }

  /** A copy with `error` when given; this response otherwise. */
  withOptionalError(error: EnvelopeInput | undefined): Response {
    if (error !== undefined) {
      return this.withError(error);
    }
    return this;
  }

  /**
   * Returns true if this is a successful response.
   */
  isOk(): boolean {
    return this._result.ok;
  }

  /**
   * Returns true if this is a failure response.
   */
  isErr(): boolean {
    return !this._result.ok;
  }

  /**
   * Returns the ID of the request this response corresponds to, if known.
   */
  get id(): ARID | undefined {
    return this._result.id;
  }

  /**
   * The id; `General` (`Expected an ID`, the reference's panic text) when
   * the response has none.
   *
   * @throws EnvelopeError with code `General`.
   */
  expectId(): ARID {
    const id = this.id;
    if (id === undefined) {
      throw EnvelopeError.general("Expected an ID");
    }
    return id;
  }

  /**
   * Returns the result envelope if this is a successful response.
   * @throws Error if this is a failure response.
   */
  get result(): Envelope {
    if (!this._result.ok) {
      throw EnvelopeError.general("Cannot get result from failed response");
    }
    return this._result.result;
  }

  /**
   * Returns the error envelope if this is a failure response.
   * @throws Error if this is a successful response.
   */
  get error(): Envelope {
    if (this._result.ok) {
      throw EnvelopeError.general("Cannot get error from successful response");
    }
    return this._result.error;
  }

  /**
   * Extracts a typed result value from a successful response.
   */
  extractResult<T>(decoder: CborDecoder<T>): T {
    return this.result.expectSubject(decoder);
  }

  /**
   * Extracts a typed error value from a failure response.
   */
  extractError<T>(decoder: CborDecoder<T>): T {
    return this.error.expectSubject(decoder);
  }

  /**
   * Converts the response to an envelope.
   *
   * Successful responses have the request ID as the subject and a 'result'
   * assertion. Failure responses have the request ID (or 'Unknown' if not known)
   * as the subject and an 'error' assertion.
   */
  toEnvelope(): Envelope {
    // The subject is the tagged ARID (or the tagged `'Unknown'` known
    // value) inside the response tag, as the reference's
    // `CBOR::to_tagged_value(TAG_RESPONSE, id)` builds it; the outer tag is
    // the bare number, as the reference's constant is.
    if (this._result.ok) {
      const taggedArid = taggedValue(TAG_RESPONSE.value, this._result.id.toCbor());
      return Envelope.leaf(taggedArid).addAssertion(RESULT, this._result.result);
    } else {
      let subject: Envelope;
      if (this._result.id !== undefined) {
        const taggedArid = taggedValue(TAG_RESPONSE.value, this._result.id.toCbor());
        subject = Envelope.leaf(taggedArid);
      } else {
        const taggedUnknown = taggedValue(TAG_RESPONSE.value, UNKNOWN_VALUE.toCbor());
        subject = Envelope.leaf(taggedUnknown);
      }
      return subject.addAssertion(ERROR, this._result.error);
    }
  }

  /**
   * Reads a response from an envelope (the reference's
   * `Response::try_from(envelope)`): exactly one of `'result'` and `'error'`
   * must be present, then the subject is `TAG_RESPONSE(ARID)`, or
   * `TAG_RESPONSE('Unknown')` for a failure without an id.
   *
   * @throws EnvelopeError `InvalidResponse` when neither or both of `'result'` and
   *   `'error'` are present (or either is present more than once), or a failure's
   *   known-value id is not `'Unknown'`; `NotLeaf` / `Cbor` (`dcbor error: <Display>`)
   *   when the subject is not the tagged id
   */
  static fromEnvelope(envelope: Envelope): Response {
    // Exactly one of `'result'` and `'error'`, each present once.
    let hasResult = false;
    let hasError = false;

    try {
      envelope.assertionWithPredicate(RESULT);
      hasResult = true;
    } catch {
      // No single result
    }

    try {
      envelope.assertionWithPredicate(ERROR);
      hasError = true;
    } catch {
      // No single error
    }

    if (hasResult === hasError) {
      throw EnvelopeError.invalidResponse();
    }

    const content = expectTaggedSubject(envelope, TAG_RESPONSE.value);
    let id: ARID | undefined;
    if (hasResult) {
      id = decodeId(content);
    } else {
      // The reference: a known value must be `Unknown` (no id); anything else is `InvalidResponse`.
      const known = tryKnownValue(content);
      if (known !== undefined) {
        if (!known.equals(UNKNOWN_VALUE)) {
          throw EnvelopeError.invalidResponse();
        }
        id = undefined;
      } else {
        id = decodeId(content);
      }
    }

    if (hasResult) {
      const resultEnvelope = envelope.objectForPredicate(RESULT);
      if (id === undefined) {
        throw EnvelopeError.invalidResponse();
      }
      return new Response({
        ok: true,
        id,
        result: resultEnvelope ?? Response.OK,
      });
    } else {
      const errorEnvelope = envelope.objectForPredicate(ERROR);
      return new Response({
        ok: false,
        id,
        error: errorEnvelope ?? Response.UNKNOWN,
      });
    }
  }

  /**
   * Returns a string representation of the response.
   */
  toString(): string {
    return `Response(${this.summary()})`;
  }

  /**
   * Checks equality with another response: the same outcome, the same id
   * (or none on both) and an equal result or error envelope (the
   * reference's derived `PartialEq`).
   */
  equals(other: Response): boolean {
    if (this._result.ok && other._result.ok) {
      return (
        this._result.id.equals(other._result.id) &&
        this._result.result.digest().equals(other._result.result.digest())
      );
    }

    if (!this._result.ok && !other._result.ok) {
      const sameId =
        this._result.id === undefined || other._result.id === undefined
          ? this._result.id === other._result.id
          : this._result.id.equals(other._result.id);
      return sameId && this._result.error.digest().equals(other._result.error.digest());
    }

    return false;
  }
}
