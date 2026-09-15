// Error types returned when operating on Gordian Envelopes.
//
// These errors capture various conditions that can occur when working with
// envelopes, including structure validation, operation constraints, and
// extension-specific errors.
//
// The errors are organized by category, reflecting the base envelope
// specification and various extensions defined in the Gordian Envelope
// Internet Draft and Blockchain Commons Research (BCR) documents.

/** Every code an `EnvelopeError` can carry; see each member for when it is raised. */
export const EnvelopeErrorCode = {
  /** The part is already elided. */
  AlreadyElided: "AlreadyElided",
  /** More than one assertion has the predicate. */
  AmbiguousPredicate: "AmbiguousPredicate",
  /** A digest in the wire form does not match the recomputed one. */
  InvalidDigest: "InvalidDigest",
  /** The CBOR is not a well-formed envelope. */
  InvalidFormat: "InvalidFormat",
  /** An expected digest is absent. */
  MissingDigest: "MissingDigest",
  /** No assertion has the predicate. */
  NonexistentPredicate: "NonexistentPredicate",
  /** The envelope is not a wrapper. */
  NotWrapped: "NotWrapped",
  /** The subject is not a leaf. */
  NotLeaf: "NotLeaf",
  /** The envelope is not an assertion. */
  NotAssertion: "NotAssertion",
  /** The assertion's wire form is malformed. */
  InvalidAssertion: "InvalidAssertion",
  /** The attachment's structure is malformed. */
  InvalidAttachment: "InvalidAttachment",
  /** No attachment matches. */
  NonexistentAttachment: "NonexistentAttachment",
  /** More than one attachment matches. */
  AmbiguousAttachment: "AmbiguousAttachment",
  /** The edge has no `isA` assertion. */
  EdgeMissingIsA: "EdgeMissingIsA",
  /** The edge has no `source` assertion. */
  EdgeMissingSource: "EdgeMissingSource",
  /** The edge has no `target` assertion. */
  EdgeMissingTarget: "EdgeMissingTarget",
  /** The edge has more than one `isA` assertion. */
  EdgeDuplicateIsA: "EdgeDuplicateIsA",
  /** The edge has more than one `source` assertion. */
  EdgeDuplicateSource: "EdgeDuplicateSource",
  /** The edge has more than one `target` assertion. */
  EdgeDuplicateTarget: "EdgeDuplicateTarget",
  /** The edge carries an assertion that is not `isA`, `source` or `target`. */
  EdgeUnexpectedAssertion: "EdgeUnexpectedAssertion",
  /** No edge matches. */
  NonexistentEdge: "NonexistentEdge",
  /** More than one edge matches. */
  AmbiguousEdge: "AmbiguousEdge",
  /** The part is already compressed. */
  AlreadyCompressed: "AlreadyCompressed",
  /** The part is not compressed. */
  NotCompressed: "NotCompressed",
  /** The part is already encrypted. */
  AlreadyEncrypted: "AlreadyEncrypted",
  /** The part is not encrypted. */
  NotEncrypted: "NotEncrypted",
  /** The subject is not a known value. */
  NotKnownValue: "NotKnownValue",
  /** No `hasRecipient` assertion opens with the given key. */
  UnknownRecipient: "UnknownRecipient",
  /** No `hasSecret` assertion opens with the given secret. */
  UnknownSecret: "UnknownSecret",
  /** No signature verifies for the given key. */
  UnverifiedSignature: "UnverifiedSignature",
  /** The outer signature of a signed-with-metadata assertion is not a `Signature`. */
  InvalidOuterSignatureType: "InvalidOuterSignatureType",
  /** The inner signature of a signed-with-metadata assertion is not a `Signature`. */
  InvalidInnerSignatureType: "InvalidInnerSignatureType",
  /** The inner signature of a signed-with-metadata assertion does not verify. */
  UnverifiedInnerSignature: "UnverifiedInnerSignature",
  /** The `signed` object is not a `Signature`. */
  InvalidSignatureType: "InvalidSignatureType",
  /** The SSKR shares are empty or not all from the same split. */
  InvalidShares: "InvalidShares",
  /** The SSKR library rejected the shares. */
  Sskr: "Sskr",
  /** The envelope does not carry the expected `isA` type. */
  InvalidType: "InvalidType",
  /** The envelope has zero or several `isA` types where exactly one was required. */
  AmbiguousType: "AmbiguousType",
  /** The subject is not the unit known value. */
  SubjectNotUnit: "SubjectNotUnit",
  /** The response's id does not match the request's. */
  UnexpectedResponseId: "UnexpectedResponseId",
  /** The response's structure is malformed. */
  InvalidResponse: "InvalidResponse",
  /** The CBOR layer rejected the bytes (wrapped `CborError`). */
  Cbor: "Cbor",
  /** The components layer rejected the input (wrapped `ComponentsError`). */
  Components: "Components",
  /** A JavaScript-only input the reference's types make impossible (a fractional index, a `NaN` date, an empty name). */
  InvalidParameter: "InvalidParameter",
  /** Any other failure; see the message. */
  General: "General",
} as const;

/** One of the `EnvelopeErrorCode` values. */
export type EnvelopeErrorCode = (typeof EnvelopeErrorCode)[keyof typeof EnvelopeErrorCode];

/** `details` of an `InvalidParameter` error. */
export interface InvalidParameterDetails {
  /** The discriminant. */
  code: "InvalidParameter";
  /** The parameter that was rejected. */
  parameter: string;
  /** What it had to be. */
  expected: string;
  /** What it was, when known. */
  value?: unknown;
}

/** `details` of every other code. */
export interface MessageDetails {
  /** The discriminant. */
  code: Exclude<EnvelopeErrorCode, "InvalidParameter">;
  /** The message without the code's prefix. */
  message: string;
}

/** `details` is discriminated by `code`. */
export type EnvelopeErrorDetails = InvalidParameterDetails | MessageDetails;

/**
 * The error every envelope operation throws. `code` names the condition
 * (one of `EnvelopeErrorCode`), `details` is discriminated by it, and
 * `cause` carries the underlying error when a lower layer (CBOR,
 * components, crypto) failed.
 *
 * ```ts
 * try {
 *   envelope.decryptSubject(key);
 * } catch (e) {
 *   if (EnvelopeError.isEnvelopeError(e) && e.is("NotEncrypted")) { … }
 * }
 * ```
 */
export class EnvelopeError extends Error {
  /** Always `"EnvelopeError"`; what `isEnvelopeError` checks across module graphs. */
  override readonly name = "EnvelopeError";
  /** Which condition was raised. */
  readonly code: EnvelopeErrorCode;
  /** Structured information, discriminated by `code`. */
  readonly details: EnvelopeErrorDetails;
  /** The lower-layer error this one wraps, when any. */
  declare readonly cause?: Error;

  private constructor(message: string, details: EnvelopeErrorDetails, cause?: Error) {
    super(message, cause === undefined ? undefined : { cause });
    this.code = details.code;
    this.details = details;
  }

  /** `true` when `value` is an `EnvelopeError` (across module graphs). */
  static isEnvelopeError(value: unknown): value is EnvelopeError {
    return value instanceof Error && value.name === "EnvelopeError" && "code" in value;
  }

  /** `true` when this error carries `code`. */
  is(code: EnvelopeErrorCode): boolean {
    return this.code === code;
  }

  /** An error with `code` and `message` (the `details` are `{ code, message }`). */
  private static make(
    code: Exclude<EnvelopeErrorCode, "InvalidParameter">,
    message: string,
    cause?: Error,
  ): EnvelopeError {
    return new EnvelopeError(message, { code, message }, cause);
  }

  //
  // Base Specification
  /**
   * Returned when attempting to compress or encrypt an envelope that has
   * already been elided.
   *
   * This error occurs because an elided envelope only contains a digest
   * reference and no longer has a subject that can be compressed or
   * encrypted.
   */
  static alreadyElided(): EnvelopeError {
    return EnvelopeError.make(
      "AlreadyElided",
      "envelope was elided, so it cannot be compressed or encrypted",
    );
  }

  /**
   * Returned when attempting to retrieve an assertion by predicate, but
   * multiple matching assertions exist.
   *
   * For queries that expect a single result (like `objectForPredicate`),
   * having multiple matching assertions is ambiguous and requires more
   * specific targeting.
   */
  static ambiguousPredicate(): EnvelopeError {
    return EnvelopeError.make(
      "AmbiguousPredicate",
      "more than one assertion matches the predicate",
    );
  }

  /**
   * Returned when a digest validation fails.
   *
   * This can occur when unwrapping an envelope, verifying signatures, or
   * other operations that rely on the integrity of envelope digests.
   */
  static invalidDigest(): EnvelopeError {
    return EnvelopeError.make("InvalidDigest", "digest did not match");
  }

  /**
   * Returned when an envelope's format is invalid.
   *
   * This typically occurs during parsing or decoding of an envelope from
   * CBOR.
   */
  static invalidFormat(): EnvelopeError {
    return EnvelopeError.make("InvalidFormat", "invalid format");
  }

  /**
   * Returned when a digest is expected but not found.
   *
   * This can occur when working with envelope structures that require digest
   * information, such as when working with elided envelopes.
   */
  static missingDigest(): EnvelopeError {
    return EnvelopeError.make("MissingDigest", "a digest was expected but not found");
  }

  /**
   * Returned when attempting to retrieve an assertion by predicate, but no
   * matching assertion exists.
   *
   * This error occurs with functions like `objectForPredicate` when the
   * specified predicate doesn't match any assertion in the envelope.
   */
  static nonexistentPredicate(): EnvelopeError {
    return EnvelopeError.make("NonexistentPredicate", "no assertion matches the predicate");
  }

  /**
   * Returned when attempting to unwrap an envelope that wasn't wrapped.
   *
   * This error occurs when calling `Envelope.tryUnwrap` on an
   * envelope that doesn't have the wrapped format.
   */
  static notWrapped(): EnvelopeError {
    return EnvelopeError.make("NotWrapped", "cannot unwrap an envelope that was not wrapped");
  }

  /**
   * Returned when expecting an envelope's subject to be a leaf, but it
   * isn't.
   *
   * This error occurs when calling methods that require access to a leaf
   * value but the envelope's subject is an assertion, node, or elided.
   */
  static notLeaf(): EnvelopeError {
    return EnvelopeError.make("NotLeaf", "the envelope's subject is not a leaf");
  }

  /**
   * Returned when expecting an envelope's subject to be an assertion, but it
   * isn't.
   *
   * This error occurs when calling methods that require an assertion
   * structure but the envelope's subject has a different format.
   */
  static notAssertion(): EnvelopeError {
    return EnvelopeError.make("NotAssertion", "the envelope's subject is not an assertion");
  }

  /** Returned when assertion is invalid */
  static invalidAssertion(): EnvelopeError {
    return EnvelopeError.make(
      "InvalidAssertion",
      "assertion must be a map with exactly one element",
    );
  }

  //
  // Attachments Extension
  /**
   * Returned when an attachment's structure is invalid according to the
   * Envelope Attachment specification (BCR-2023-006): the envelope is not an
   * assertion, or its parts do not rebuild an equivalent attachment.
   */
  static invalidAttachment(): EnvelopeError {
    return EnvelopeError.make("InvalidAttachment", "invalid attachment");
  }

  /**
   * Returned when an attachment is requested but does not exist.
   *
   * This error occurs when attempting to retrieve an attachment by ID that
   * doesn't exist in the envelope.
   */
  static nonexistentAttachment(): EnvelopeError {
    return EnvelopeError.make("NonexistentAttachment", "nonexistent attachment");
  }

  /**
   * Returned when multiple attachments match a single query.
   *
   * The message is the reference's `#[error]` text, misspelling included
   * (`abiguous attachment`), so both implementations report the same text.
   */
  static ambiguousAttachment(): EnvelopeError {
    return EnvelopeError.make("AmbiguousAttachment", "abiguous attachment");
  }

  //
  // Edges Extension
  /** Returned when an edge is missing the required `'isA'` assertion. */
  static edgeMissingIsA(): EnvelopeError {
    return EnvelopeError.make("EdgeMissingIsA", "edge missing 'isA' assertion");
  }

  /** Returned when an edge is missing the required `'source'` assertion. */
  static edgeMissingSource(): EnvelopeError {
    return EnvelopeError.make("EdgeMissingSource", "edge missing 'source' assertion");
  }

  /** Returned when an edge is missing the required `'target'` assertion. */
  static edgeMissingTarget(): EnvelopeError {
    return EnvelopeError.make("EdgeMissingTarget", "edge missing 'target' assertion");
  }

  /** Returned when an edge has duplicate `'isA'` assertions. */
  static edgeDuplicateIsA(): EnvelopeError {
    return EnvelopeError.make("EdgeDuplicateIsA", "edge has duplicate 'isA' assertions");
  }

  /** Returned when an edge has duplicate `'source'` assertions. */
  static edgeDuplicateSource(): EnvelopeError {
    return EnvelopeError.make("EdgeDuplicateSource", "edge has duplicate 'source' assertions");
  }

  /** Returned when an edge has duplicate `'target'` assertions. */
  static edgeDuplicateTarget(): EnvelopeError {
    return EnvelopeError.make("EdgeDuplicateTarget", "edge has duplicate 'target' assertions");
  }

  /** Returned when an edge has an unexpected assertion (per BCR-2026-003). */
  static edgeUnexpectedAssertion(): EnvelopeError {
    return EnvelopeError.make("EdgeUnexpectedAssertion", "edge has unexpected assertion");
  }

  /** Returned when an edge is requested but does not exist. */
  static nonexistentEdge(): EnvelopeError {
    return EnvelopeError.make("NonexistentEdge", "nonexistent edge");
  }

  /** Returned when multiple edges match a single query. */
  static ambiguousEdge(): EnvelopeError {
    return EnvelopeError.make("AmbiguousEdge", "ambiguous edge");
  }

  //
  // Compression Extension
  /**
   * Returned when attempting to compress an envelope that is already
   * compressed.
   *
   * This error occurs when calling compression functions on an envelope that
   * already has compressed content, as defined in BCR-2023-005.
   */
  static alreadyCompressed(): EnvelopeError {
    return EnvelopeError.make("AlreadyCompressed", "envelope was already compressed");
  }

  /**
   * Returned when attempting to decompress an envelope that is not
   * compressed.
   *
   * This error occurs when calling decompression functions on an envelope
   * that doesn't contain compressed content.
   */
  static notCompressed(): EnvelopeError {
    return EnvelopeError.make(
      "NotCompressed",
      "cannot decompress an envelope that was not compressed",
    );
  }

  //
  // Symmetric Encryption Extension
  /**
   * Returned when attempting to encrypt an envelope that is already
   * encrypted or compressed.
   *
   * This error occurs to prevent multiple layers of encryption or encryption
   * of compressed data, which could reduce security, as defined in
   * BCR-2023-004.
   */
  static alreadyEncrypted(): EnvelopeError {
    return EnvelopeError.make(
      "AlreadyEncrypted",
      "envelope was already encrypted or compressed, so it cannot be encrypted",
    );
  }

  /**
   * Returned when attempting to decrypt an envelope that is not encrypted.
   *
   * This error occurs when calling decryption functions on an envelope that
   * doesn't contain encrypted content.
   */
  static notEncrypted(): EnvelopeError {
    return EnvelopeError.make("NotEncrypted", "cannot decrypt an envelope that was not encrypted");
  }

  //
  // Known Values Extension
  /**
   * Returned when expecting an envelope's subject to be a known value, but
   * it isn't.
   *
   * This error occurs when calling methods that require a known value (as
   * defined in BCR-2023-003) but the envelope's subject is a different
   * type.
   */
  static notKnownValue(): EnvelopeError {
    return EnvelopeError.make("NotKnownValue", "the envelope's subject is not a known value");
  }

  //
  // Public Key Encryption Extension
  /**
   * Returned when attempting to decrypt an envelope with a recipient that
   * doesn't match.
   *
   * This error occurs when trying to use a private key to decrypt an
   * envelope that wasn't encrypted for the corresponding public key.
   */
  static unknownRecipient(): EnvelopeError {
    return EnvelopeError.make("UnknownRecipient", "unknown recipient");
  }

  //
  // Encrypted Key Extension
  /**
   * Returned when attempting to decrypt an envelope with a secret that
   * doesn't match.
   *
   * This error occurs when trying to use a secret that does not correspond
   * to the expected recipient, preventing successful decryption.
   */
  static unknownSecret(): EnvelopeError {
    return EnvelopeError.make("UnknownSecret", "secret not found");
  }

  //
  // Public Key Signing Extension
  /**
   * Returned when a signature verification fails.
   *
   * This error occurs when a signature does not validate against its
   * purported public key.
   */
  static unverifiedSignature(): EnvelopeError {
    return EnvelopeError.make("UnverifiedSignature", "could not verify a signature");
  }

  /** Returned when the outer signature object type is not `Signature`. */
  static invalidOuterSignatureType(): EnvelopeError {
    return EnvelopeError.make(
      "InvalidOuterSignatureType",
      "unexpected outer signature object type",
    );
  }

  /** Returned when the inner signature object type is not `Signature`. */
  static invalidInnerSignatureType(): EnvelopeError {
    return EnvelopeError.make(
      "InvalidInnerSignatureType",
      "unexpected inner signature object type",
    );
  }

  /**
   * Returned when the inner signature is not made with the same key as the
   * outer signature.
   */
  static unverifiedInnerSignature(): EnvelopeError {
    return EnvelopeError.make(
      "UnverifiedInnerSignature",
      "inner signature not made with same key as outer signature",
    );
  }

  /** Returned when the signature object is not a `Signature`. */
  static invalidSignatureType(): EnvelopeError {
    return EnvelopeError.make("InvalidSignatureType", "unexpected signature object type");
  }

  //
  // SSKR Extension
  /**
   * Returned when SSKR shares are invalid or insufficient for
   * reconstruction.
   *
   * This error occurs when attempting to join SSKR shares that are
   * malformed, from different splits, or insufficient to meet the
   * recovery threshold.
   */
  static invalidShares(): EnvelopeError {
    return EnvelopeError.make("InvalidShares", "invalid SSKR shares");
  }

  /** SSKR error wrapper */
  static sskr(message: string, cause?: Error): EnvelopeError {
    return EnvelopeError.make("Sskr", `sskr error: ${message}`, cause);
  }

  //
  // Types Extension
  /**
   * Returned when an envelope contains an invalid type.
   *
   * This error occurs when an envelope's type information doesn't match
   * the expected format or value.
   */
  static invalidType(): EnvelopeError {
    return EnvelopeError.make("InvalidType", "invalid type");
  }

  /**
   * Returned when an envelope contains ambiguous type information.
   *
   * This error occurs when multiple type assertions exist that conflict
   * with each other or create ambiguity about the envelope's type.
   */
  static ambiguousType(): EnvelopeError {
    return EnvelopeError.make("AmbiguousType", "ambiguous type");
  }

  //
  // Known Value Extension
  /** Returned when the subject is expected to be the unit value but isn't. */
  static subjectNotUnit(): EnvelopeError {
    return EnvelopeError.make(
      "SubjectNotUnit",
      "the subject of the envelope is not the unit value",
    );
  }

  //
  // Expressions Extension
  /**
   * Returned when a response envelope has an unexpected ID.
   *
   * This error occurs when processing a response envelope and the ID doesn't
   * match the expected request ID, as defined in BCR-2023-012.
   */
  static unexpectedResponseId(): EnvelopeError {
    return EnvelopeError.make("UnexpectedResponseId", "unexpected response ID");
  }

  /** Returned when a response envelope is invalid. */
  static invalidResponse(): EnvelopeError {
    return EnvelopeError.make("InvalidResponse", "invalid response");
  }

  //
  // External errors
  /**
   * `Cbor` as an internal site reports it: `dcbor error: <message>`, the
   * reference's `Error::Cbor` Display, with the dcbor error as `cause`.
   */
  static cbor(message: string, cause?: Error): EnvelopeError {
    return EnvelopeError.make("Cbor", `dcbor error: ${message}`, cause);
  }

  /**
   * `Cbor` as a decoder reports it: the message is the dcbor Display of
   * `cause` with no prefix, because the reference's `try_from_cbor_data`,
   * `TryFrom<CBOR>`, `from_untagged_cbor` and `Expression::try_from` return
   * a `dcbor::Error`; `cause` is that `CborError`.
   */
  static cborDecode(cause: Error): EnvelopeError {
    return EnvelopeError.make("Cbor", cause.message, cause);
  }

  /** Components error wrapper */
  static components(message: string, cause?: Error): EnvelopeError {
    return EnvelopeError.make("Components", `components error: ${message}`, cause);
  }

  /**
   * `InvalidParameter`: `parameter` did not meet `expected` (the JS-only
   * input domain: a fractional position, an invalid `Date`, `undefined`).
   */
  static invalidParameter(
    parameter: string,
    expected: string,
    value?: unknown,
    cause?: Error,
  ): EnvelopeError {
    const got = value === undefined ? "" : `, got ${describeValue(value)}`;
    const details: InvalidParameterDetails =
      value === undefined
        ? { code: "InvalidParameter", parameter, expected }
        : { code: "InvalidParameter", parameter, expected, value };
    return new EnvelopeError(`${parameter} must be ${expected}${got}`, details, cause);
  }

  /** General error wrapper */
  static general(message: string, cause?: Error): EnvelopeError {
    return EnvelopeError.make("General", `general error: ${message}`, cause);
  }
}

/** A short rendering of a rejected value for an error message. */
function describeValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "bigint") return `${value}n`;
  if (value instanceof Date) return `Date(${String(value.getTime())})`;
  if (typeof value === "number" || typeof value === "boolean" || value === null)
    return String(value);
  return typeof value;
}
