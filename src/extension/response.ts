/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
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

import { ARID } from "@blockchaincommons/components";
import { RESPONSE as TAG_RESPONSE } from "@blockchaincommons/tags";
import { taggedValue, expectTaggedContent } from "@blockchaincommons/dcbor";
import { RESULT, ERROR, OK_VALUE, UNKNOWN_VALUE } from "@blockchaincommons/known-values";

import { Envelope } from "../base/envelope";
import { type ToEnvelope, type EnvelopeInput } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
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
 * Interface that defines the behavior of a response.
 */
export interface ResponseBehavior {
  /**
   * Sets the result value for a successful response.
   * @throws Error if called on a failure response.
   */
  withResult(result: EnvelopeInput): Response;

  /**
   * Sets the error value for a failure response.
   * @throws Error if called on a successful response.
   */
  withError(error: EnvelopeInput): Response;

  /**
   * Returns true if this is a successful response.
   */
  isOk(): boolean;

  /**
   * Returns true if this is a failure response.
   */
  isErr(): boolean;

  /**
   * Returns the ID of the request this response corresponds to, if known.
   */
  readonly id: ARID | undefined;

  /**
   * Returns the result envelope if this is a successful response.
   * @throws Error if this is a failure response.
   */
  readonly result: Envelope;

  /**
   * Returns the error envelope if this is a failure response.
   * @throws Error if this is a successful response.
   */
  readonly error: Envelope;

  /**
   * Converts the response to an envelope.
   */
  toEnvelope(): Envelope;
}

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
export class Response implements ResponseBehavior, ToEnvelope {
  private _result: ResponseResult;

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
      const idStr =
        this._result.id !== undefined ? this._result.id.shortDescription() : "'Unknown'";
      return `id: ${idStr}, error: ${formatFlat(this._result.error)}`;
    }
  }

  // ResponseBehavior implementation

  withResult(result: EnvelopeInput): Response {
    if (!this._result.ok) {
      throw EnvelopeError.general("Cannot set result on a failed response");
    }
    this._result = {
      ok: true,
      id: this._result.id,
      result: Envelope.from(result),
    };
    return this;
  }

  withOptionalResult(result: EnvelopeInput | undefined): Response {
    if (result !== undefined) {
      return this.withResult(result);
    }
    return this.withResult(null);
  }

  withError(error: EnvelopeInput): Response {
    if (this._result.ok) {
      throw EnvelopeError.general("Cannot set error on a successful response");
    }
    this._result = {
      ok: false,
      id: this._result.id,
      error: Envelope.from(error),
    };
    return this;
  }

  withOptionalError(error: EnvelopeInput | undefined): Response {
    if (error !== undefined) {
      return this.withError(error);
    }
    return this;
  }

  isOk(): boolean {
    return this._result.ok;
  }

  isErr(): boolean {
    return !this._result.ok;
  }

  get id(): ARID | undefined {
    return this._result.id;
  }

  expectId(): ARID {
    const id = this.id;
    if (id === undefined) {
      throw EnvelopeError.general("expected an ID");
    }
    return id;
  }

  get result(): Envelope {
    if (!this._result.ok) {
      throw EnvelopeError.general("Cannot get result from failed response");
    }
    return this._result.result;
  }

  get error(): Envelope {
    if (this._result.ok) {
      throw EnvelopeError.general("Cannot get error from successful response");
    }
    return this._result.error;
  }

  /**
   * Extracts a typed result value from a successful response.
   */
  extractResult<T>(decoder: (cbor: unknown) => T): T {
    return this.result.expectSubject(decoder);
  }

  /**
   * Extracts a typed error value from a failure response.
   */
  extractError<T>(decoder: (cbor: unknown) => T): T {
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
    if (this._result.ok) {
      // Wrap the **tagged** ARID inside the response tag — mirrors
      // Rust `CBOR::to_tagged_value(TAG_RESPONSE, response.id)` which
      // dispatches via `From<ARID> for CBOR` (the tagged form). See
      // request.ts for the same fix and rationale.
      const taggedArid = taggedValue(TAG_RESPONSE, this._result.id.toCbor());
      return Envelope.leaf(taggedArid).addAssertion(RESULT, this._result.result);
    } else {
      let subject: Envelope;
      if (this._result.id !== undefined) {
        const taggedArid = taggedValue(TAG_RESPONSE, this._result.id.toCbor());
        subject = Envelope.leaf(taggedArid);
      } else {
        // UNKNOWN_VALUE is a `KnownValue`; its tagged-CBOR form is
        // tag(40000, uint(N)). Mirror Rust's
        // `CBOR::to_tagged_value(TAG_RESPONSE, KnownValue::Unknown)`.
        const taggedUnknown = taggedValue(TAG_RESPONSE, UNKNOWN_VALUE.toCbor());
        subject = Envelope.leaf(taggedUnknown);
      }
      return subject.addAssertion(ERROR, this._result.error);
    }
  }

  /**
   * Creates a response from an envelope.
   */
  static fromEnvelope(envelope: Envelope): Response {
    // Check for result or error assertion
    let hasResult = false;
    let hasError = false;

    try {
      const resultObj = envelope.objectForPredicate(RESULT);
      hasResult = resultObj !== undefined;
    } catch {
      // No result
    }

    try {
      const errorObj = envelope.objectForPredicate(ERROR);
      hasError = errorObj !== undefined;
    } catch {
      // No error
    }

    // Must have exactly one of result or error
    if (hasResult === hasError) {
      throw EnvelopeError.invalidResponse();
    }

    // Extract ARID from tagged subject. The subject is either
    // TAG_RESPONSE(tag_40012(arid_bytes)) for a successful/known-id
    // response, or TAG_RESPONSE(tag_40000(uint)) for an
    // UNKNOWN_VALUE id. See toEnvelope above.
    const subject = envelope.subject();
    const leaf = subject.asLeaf();
    if (leaf === undefined) {
      throw EnvelopeError.general("Response envelope has invalid subject");
    }
    const content = expectTaggedContent(leaf, TAG_RESPONSE.value);

    // Distinguish ARID (tag 40012) from UNKNOWN_VALUE (tag 40000)
    // by inspecting the tagged content.
    let id: ARID | undefined;
    try {
      id = ARID.fromCbor(content);
    } catch {
      // Content is not a tagged ARID — assumed to be the
      // UNKNOWN_VALUE known-value (tag 40000); leave id undefined.
      id = undefined;
    }

    if (hasResult) {
      const resultEnvelope = envelope.objectForPredicate(RESULT);
      if (id === undefined) {
        throw EnvelopeError.general("Successful response must have an ID");
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
   * Checks equality with another response.
   */
  equals(other: Response): boolean {
    if (this._result.ok !== other._result.ok) return false;

    if (this._result.ok && other._result.ok) {
      return this._result.id.equals(other._result.id);
    }

    if (!this._result.ok && !other._result.ok) {
      if (this._result.id === undefined && other._result.id === undefined) {
        return true;
      }
      if (this._result.id !== undefined && other._result.id !== undefined) {
        return this._result.id.equals(other._result.id);
      }
      return false;
    }

    return false;
  }
}
