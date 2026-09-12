import { ARID, Compressed, Decrypter, Decrypter as Decrypter$1, Digest, Digest as Digest$1, EncapsulationPublicKey as PublicKeyBase, EncryptedMessage, Encrypter, Encrypter as Encrypter$1, KeyDerivationMethod, Nonce, PrivateKeys as PrivateKeyBase, SSKRSpec, Salt, SealedMessage as ComponentsSealedMessage, SealedMessage as SealedMessage$1, Signature, Signer, SigningOptions, SigningPrivateKey, SigningPublicKey, SymmetricKey, Verifier } from "@blockchaincommons/components";
import { Cbor, CborMap, CborNumber, CborSummarizer, CborTagged, CborTaggedDecodable, CborTaggedEncodable, Tag, TagsStore, TagsStoreTrait, tagsForValues } from "@blockchaincommons/dcbor-compat";
import { ATTACHMENT, CONFORMS_TO, EDGE, IS_A, KnownValue, KnownValuesStore, NOTE, SIGNED, SOURCE, TARGET, VENDOR } from "@blockchaincommons/known-values";
import { RandomNumberGenerator } from "@blockchaincommons/rand";
import { UR } from "@blockchaincommons/uniform-resources";
//#region src/base/digest.d.ts
interface DigestProvider {
  digest(): Digest$1;
}
declare module "@blockchaincommons/components" {
  interface Digest {
    short(): string;
  }
}
//#endregion
//#region src/base/envelope-encodable.d.ts
interface EnvelopeEncodable {
  intoEnvelope(): Envelope;
}
declare function isEnvelopeEncodable(value: unknown): value is EnvelopeEncodable;
type EnvelopeEncodableValue = EnvelopeEncodable | string | number | boolean | bigint | Uint8Array | null | undefined | Envelope | KnownValue | CborTaggedEncodable;
//#endregion
//#region src/base/assertion.d.ts
declare class Assertion implements DigestProvider {
  private readonly _predicate;
  private readonly _object;
  private readonly _digest;
  constructor(predicate: EnvelopeEncodable | Envelope, object: EnvelopeEncodable | Envelope);
  predicate(): Envelope;
  object(): Envelope;
  digest(): Digest;
  equals(other: Assertion): boolean;
  toCbor(): Cbor;
  static fromCbor(cbor: Cbor): Assertion;
  static fromCborMap(map: CborMap): Assertion;
  toString(): string;
  clone(): Assertion;
}
//#endregion
//#region src/base/elide.d.ts
declare enum ObscureType {
  Elided = "elided",
  Encrypted = "encrypted",
  Compressed = "compressed"
}
type ObscureAction = {
  type: "elide";
} | {
  type: "encrypt";
  key: unknown;
} | {
  type: "compress";
};
declare function elideAction(): ObscureAction;
//#endregion
//#region src/base/walk.d.ts
declare enum EdgeType {
  None = "none",
  Subject = "subject",
  Assertion = "assertion",
  Predicate = "predicate",
  Object = "object",
  Content = "content"
}
declare function edgeLabel(edgeType: EdgeType): string | undefined;
type Visitor<State> = (envelope: Envelope, level: number, incomingEdge: EdgeType, state: State) => [State, boolean];
//#endregion
//#region src/extension/salt.d.ts
declare const SALT: KnownValue;
//#endregion
//#region src/extension/compress.d.ts
declare function registerCompressExtension(): void;
//#endregion
//#region src/extension/encrypt.d.ts
declare function registerEncryptExtension(): void;
//#endregion
//#region src/extension/signature.d.ts
/**
 * Metadata associated with a signature in a Gordian Envelope.
 *
 * `SignatureMetadata` provides a way to attach additional information to
 * signatures, such as the signer's identity, the signing date, or the purpose
 * of the signature. When used with the signature extension, this metadata is
 * included in a structured way that is also signed, ensuring the metadata
 * cannot be tampered with without invalidating the signature.
 *
 * Ported from bc-envelope-rust/src/extension/signature/signature_metadata.rs
 */
declare class SignatureMetadata {
  private readonly _assertions;
  private constructor();
  /**
   * Creates a new empty SignatureMetadata.
   */
  static new(): SignatureMetadata;
  /**
   * Adds an assertion to the metadata.
   *
   * @param predicate - The predicate for the assertion (accepts KnownValue, string, etc.)
   * @param object - The object for the assertion
   * @returns A new SignatureMetadata with the assertion added
   */
  withAssertion(predicate: EnvelopeEncodableValue, object: unknown): SignatureMetadata;
  /**
   * Returns all assertions in this metadata.
   */
  assertions(): readonly [EnvelopeEncodableValue, unknown][];
  /**
   * Returns whether this metadata contains any assertions.
   */
  hasAssertions(): boolean;
}
//#endregion
//#region src/extension/attachment.d.ts
/**
 * A container for vendor-specific metadata attachments.
 *
 * Attachments provides a flexible mechanism for attaching arbitrary metadata
 * to envelopes without modifying their core structure.
 */
declare class Attachments {
  private readonly _envelopes;
  /**
   * Creates a new empty attachments container.
   */
  constructor();
  /**
   * Adds a new attachment with the specified payload and metadata.
   *
   * @param payload - The data to attach
   * @param vendor - A string identifying the entity that defined the attachment format
   * @param conformsTo - Optional URI identifying the structure the payload conforms to
   */
  add(payload: EnvelopeEncodableValue, vendor: string, conformsTo?: string): void;
  /**
   * Adds a pre-constructed attachment envelope directly.
   *
   * @param envelope - The attachment envelope to add
   */
  addEnvelope(envelope: Envelope): void;
  /**
   * Retrieves an attachment by its digest.
   *
   * @param digest - The unique digest of the attachment to retrieve
   * @returns The envelope if found, or undefined
   */
  get(digest: Digest): Envelope | undefined;
  /**
   * Removes an attachment by its digest.
   *
   * @param digest - The unique digest of the attachment to remove
   * @returns The removed envelope if found, or undefined
   */
  remove(digest: Digest): Envelope | undefined;
  /**
   * Removes all attachments from the container.
   */
  clear(): void;
  /**
   * Returns whether the container has any attachments.
   */
  isEmpty(): boolean;
  /**
   * Returns the number of attachments in the container.
   */
  len(): number;
  /**
   * Returns an iterator over all attachment envelopes.
   */
  iter(): IterableIterator<[string, Envelope]>;
  /**
   * Check equality with another Attachments container.
   */
  equals(other: Attachments): boolean;
  /**
   * Adds all attachments from this container to an envelope.
   *
   * @param envelope - The envelope to add attachments to
   * @returns A new envelope with all attachments added as assertions
   */
  addToEnvelope(envelope: Envelope): Envelope;
  /**
   * Creates an Attachments container from an envelope's attachment assertions.
   *
   * @param envelope - The envelope to extract attachments from
   * @returns A new Attachments container with the envelope's attachments
   */
  static fromEnvelope(envelope: Envelope): Attachments;
}
//#endregion
//#region src/extension/edge.d.ts
/**
 * A container for edge envelopes on a document.
 *
 * `Edges` stores pre-constructed edge envelopes keyed by their digest,
 * mirroring the `Attachments` container but for edges as defined in
 * BCR-2026-003.
 *
 * Equivalent to Rust's `Edges` struct in `src/extension/edge/edges.rs`.
 */
declare class Edges {
  private readonly _envelopes;
  /**
   * Creates a new empty edges container.
   */
  constructor();
  /**
   * Adds a pre-constructed edge envelope.
   *
   * @param edgeEnvelope - The edge envelope to add
   */
  add(edgeEnvelope: Envelope): void;
  /**
   * Retrieves an edge by its digest.
   *
   * @param digest - The digest of the edge to retrieve
   * @returns The edge envelope if found, or undefined
   */
  get(digest: Digest): Envelope | undefined;
  /**
   * Removes an edge by its digest.
   *
   * @param digest - The digest of the edge to remove
   * @returns The removed edge envelope if found, or undefined
   */
  remove(digest: Digest): Envelope | undefined;
  /**
   * Removes all edges from the container.
   */
  clear(): void;
  /**
   * Returns whether the container has no edges.
   */
  isEmpty(): boolean;
  /**
   * Returns the number of edges in the container.
   */
  len(): number;
  /**
   * Returns an iterator over all edge envelopes.
   */
  iter(): IterableIterator<[string, Envelope]>;
  /**
   * Check equality with another Edges container.
   */
  equals(other: Edges): boolean;
  /**
   * Adds all edges as `'edge'` assertion envelopes to the given envelope.
   *
   * @param envelope - The envelope to add edges to
   * @returns A new envelope with all edges added as assertions
   */
  addToEnvelope(envelope: Envelope): Envelope;
  /**
   * Extracts edges from an envelope's `'edge'` assertions.
   *
   * Equivalent to Rust's `Edges::try_from_envelope()`.
   *
   * @param envelope - The envelope to extract edges from
   * @returns A new Edges container with the envelope's edges
   */
  static fromEnvelope(envelope: Envelope): Edges;
}
/**
 * A trait for types that can have edges.
 *
 * `Edgeable` provides a consistent interface for working with edges.
 * Types implementing this interface can store and retrieve edge envelopes
 * representing verifiable claims as defined in BCR-2026-003.
 *
 * Equivalent to Rust's `Edgeable` trait in `src/extension/edge/edges.rs`.
 */
interface Edgeable {
  /** Returns a reference to the edges container. */
  edges(): Edges;
  /** Returns a mutable reference to the edges container. */
  edgesMut(): Edges;
  /** Adds a pre-constructed edge envelope. */
  addEdge(edgeEnvelope: Envelope): void;
  /** Retrieves an edge by its digest. */
  getEdge(digest: Digest): Envelope | undefined;
  /** Removes an edge by its digest. */
  removeEdge(digest: Digest): Envelope | undefined;
  /** Removes all edges. */
  clearEdges(): void;
  /** Returns whether the object has any edges. */
  hasEdges(): boolean;
}
//#endregion
//#region src/extension/recipient.d.ts
/**
 * Predicate constant for recipient assertions.
 * This is the known value 'hasRecipient' used to identify recipient assertions.
 */
declare const HAS_RECIPIENT: KnownValue;
/**
 * SealedMessage wrapping the sealed content key for a recipient.
 * This is the proper implementation from @blockchaincommons/components that supports
 * both X25519 and MLKEM encryption schemes.
 */
declare class SealedMessage {
  private readonly _inner;
  constructor(sealedMessage: SealedMessage$1);
  /**
   * Creates a sealed message by encrypting a symmetric key to a recipient.
   * Uses the Encrypter interface which supports both X25519 and MLKEM.
   *
   * @param contentKey - The symmetric key to encrypt
   * @param recipient - The recipient's public key (implements Encrypter)
   * @param testNonce - Optional nonce for deterministic testing
   * @returns A sealed message containing the encrypted content key
   */
  static seal(contentKey: SymmetricKey, recipient: Encrypter$1, testNonce?: Nonce): SealedMessage;
  /**
   * Decrypts this sealed message using recipient's private key.
   *
   * @param recipient - The recipient's private key (implements Decrypter)
   * @returns The decrypted content key data
   */
  decrypt(recipient: Decrypter$1): Uint8Array;
  /**
   * Returns the underlying SealedMessage from components.
   */
  inner(): SealedMessage$1;
  /**
   * Returns the CBOR-encoded data of this sealed message.
   */
  data(): Uint8Array;
  /**
   * Creates a SealedMessage from CBOR-encoded data.
   */
  static fromData(data: Uint8Array): SealedMessage;
}
//#endregion
//#region src/extension/expression.d.ts
declare const CBOR_TAG_FUNCTION = 40006;
declare const CBOR_TAG_PARAMETER = 40007;
declare const CBOR_TAG_PLACEHOLDER = 40008;
declare const CBOR_TAG_REPLACEMENT = 40009;
declare const FUNCTION_IDS: {
  readonly ADD: 1;
  readonly SUB: 2;
  readonly MUL: 3;
  readonly DIV: 4;
  readonly NEG: 5;
  readonly LT: 6;
  readonly LE: 7;
  readonly GT: 8;
  readonly GE: 9;
  readonly EQ: 10;
  readonly NE: 11;
  readonly AND: 12;
  readonly OR: 13;
  readonly XOR: 14;
  readonly NOT: 15;
};
declare const PARAMETER_IDS: {
  readonly BLANK: 1;
  readonly LHS: 2;
  readonly RHS: 3;
};
type FunctionID = number | string;
type ParameterID = number | string;
declare class Function implements EnvelopeEncodable {
  private readonly _variant;
  private readonly _value;
  private readonly _name;
  private constructor();
  static newKnown(value: number, name?: string): Function;
  static newNamed(name: string): Function;
  static fromNumeric(id: number): Function;
  static fromString(name: string): Function;
  isKnown(): boolean;
  isNamed(): boolean;
  value(): number | undefined;
  id(): FunctionID;
  name(): string;
  namedName(): string | undefined;
  assignedName(): string | undefined;
  isNumeric(): boolean;
  isString(): boolean;
  envelope(): Envelope;
  intoEnvelope(): Envelope;
  withParameter(param: ParameterID, value: EnvelopeEncodableValue): Expression;
  equals(other: Function): boolean;
  hashCode(): number;
  toString(): string;
}
declare class FunctionsStore {
  private readonly _dict;
  constructor(functions?: Iterable<Function>);
  insert(func: Function): void;
  assignedName(func: Function): string | undefined;
  name(func: Function): string;
  static nameForFunction(func: Function, store?: FunctionsStore): string;
}
declare class Parameter implements EnvelopeEncodable {
  private readonly _variant;
  private readonly _value;
  private readonly _name;
  private readonly _paramValue;
  private constructor();
  static newKnown(value: number, name?: string): Parameter;
  static newNamed(name: string): Parameter;
  static withValue(id: ParameterID, value: Envelope): Parameter;
  isKnown(): boolean;
  isNamed(): boolean;
  value(): number | undefined;
  id(): ParameterID;
  name(): string;
  namedName(): string | undefined;
  assignedName(): string | undefined;
  paramValue(): Envelope | undefined;
  isNumeric(): boolean;
  isString(): boolean;
  envelope(): Envelope;
  intoEnvelope(): Envelope;
  equals(other: Parameter): boolean;
  hashCode(): number;
  toString(): string;
  static blank(value: EnvelopeEncodableValue): Parameter;
  static lhs(value: EnvelopeEncodableValue): Parameter;
  static rhs(value: EnvelopeEncodableValue): Parameter;
}
declare class ParametersStore {
  private readonly _dict;
  constructor(parameters?: Iterable<Parameter>);
  insert(param: Parameter): void;
  assignedName(param: Parameter): string | undefined;
  name(param: Parameter): string;
  static nameForParameter(param: Parameter, store?: ParametersStore): string;
}
declare const ADD: Function;
declare const SUB: Function;
declare const MUL: Function;
declare const DIV: Function;
declare const NEG: Function;
declare const LT: Function;
declare const LE: Function;
declare const GT: Function;
declare const GE: Function;
declare const EQ: Function;
declare const NE: Function;
declare const AND: Function;
declare const OR: Function;
declare const XOR: Function;
declare const NOT: Function;
declare const ADD_VALUE: number;
declare const SUB_VALUE: number;
declare const MUL_VALUE: number;
declare const DIV_VALUE: number;
declare const NEG_VALUE: number;
declare const LT_VALUE: number;
declare const LE_VALUE: number;
declare const GT_VALUE: number;
declare const GE_VALUE: number;
declare const EQ_VALUE: number;
declare const NE_VALUE: number;
declare const AND_VALUE: number;
declare const OR_VALUE: number;
declare const XOR_VALUE: number;
declare const NOT_VALUE: number;
declare const BLANK: Parameter;
declare const LHS: Parameter;
declare const RHS: Parameter;
declare const BLANK_VALUE: number;
declare const LHS_VALUE: number;
declare const RHS_VALUE: number;
declare class LazyStore<T> {
  private _store;
  private readonly _initializer;
  constructor(initializer: () => T);
  get(): T;
}
declare const GLOBAL_FUNCTIONS: LazyStore<FunctionsStore>;
declare const GLOBAL_PARAMETERS: LazyStore<ParametersStore>;
declare class Expression implements EnvelopeEncodable {
  private readonly _function;
  private readonly _parameters;
  private _envelope;
  constructor(func: Function);
  function(): Function;
  parameters(): Parameter[];
  withParameter(param: ParameterID, value: EnvelopeEncodableValue): Expression;
  withParameters(params: Record<string, EnvelopeEncodableValue>): Expression;
  private static parameterIdMatches;
  getParameter(param: ParameterID): Envelope | undefined;
  objectsForParameter(param: ParameterID): Envelope[];
  hasParameter(param: ParameterID): boolean;
  envelope(): Envelope;
  intoEnvelope(): Envelope;
  static fromEnvelope(envelope: Envelope): Expression;
  toString(): string;
}
declare function add(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression;
declare function sub(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression;
declare function mul(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression;
declare function div(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression;
declare function neg(value: EnvelopeEncodableValue): Expression;
declare function lt(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression;
declare function le(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression;
declare function gt(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression;
declare function ge(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression;
declare function eq(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression;
declare function ne(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression;
declare function and(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression;
declare function or(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression;
declare function xor(lhs: EnvelopeEncodableValue, rhs: EnvelopeEncodableValue): Expression;
declare function not(value: EnvelopeEncodableValue): Expression;
//#endregion
//#region src/extension/proof.d.ts
declare function registerProofExtension(): void;
//#endregion
//#region src/extension/secret.d.ts
declare const registerSecretExtension: () => void;
//#endregion
//#region src/extension/sskr.d.ts
declare const registerSskrExtension: () => void;
//#endregion
//#region src/extension/request.d.ts
/**
 * Interface that defines the behavior of a request.
 *
 * This interface extends expression behavior to add methods specific to requests,
 * including metadata management and access to request properties.
 */
interface RequestBehavior {
  /**
   * Adds a parameter to the request.
   */
  withParameter(param: ParameterID, value: EnvelopeEncodableValue): Request;
  /**
   * Adds a note to the request.
   */
  withNote(note: string): Request;
  /**
   * Adds a date to the request.
   */
  withDate(date: Date): Request;
  /**
   * Returns the body of the request (the expression to be evaluated).
   */
  body(): Expression;
  /**
   * Returns the unique identifier (ARID) of the request.
   */
  id(): ARID;
  /**
   * Returns the note attached to the request, or an empty string if none exists.
   */
  note(): string;
  /**
   * Returns the date attached to the request, if any.
   */
  date(): Date | undefined;
  /**
   * Returns the function of the request.
   */
  function(): Function;
  /**
   * Returns the expression envelope of the request.
   */
  expressionEnvelope(): Envelope;
  /**
   * Converts the request to an envelope.
   */
  toEnvelope(): Envelope;
}
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
 * const request = Request.new("getBalance", requestId)
 *   .withParameter("account", "alice")
 *   .withParameter("currency", "USD")
 *   .withNote("Monthly balance check");
 *
 * // Convert to an envelope
 * const envelope = request.toEnvelope();
 * ```
 */
declare class Request implements RequestBehavior, EnvelopeEncodable {
  private readonly _body;
  private readonly _id;
  private _note;
  private _date;
  private constructor();
  /**
   * Creates a new request with the specified expression body and ID.
   */
  static newWithBody(body: Expression, id: ARID): Request;
  /**
   * Creates a new request with a function and ID.
   *
   * This is a convenience method that creates an expression from the
   * function and then creates a request with that expression.
   */
  static new(func: Function | string | number, id: ARID): Request;
  /**
   * Returns a human-readable summary of the request.
   */
  summary(): string;
  withParameter(param: ParameterID, value: EnvelopeEncodableValue): Request;
  withNote(note: string): Request;
  withDate(date: Date): Request;
  body(): Expression;
  id(): ARID;
  note(): string;
  date(): Date | undefined;
  function(): Function;
  expressionEnvelope(): Envelope;
  /**
   * Converts the request to an envelope.
   *
   * The envelope's subject is the request's ID tagged with TAG_REQUEST,
   * and assertions include the request's body, note (if not empty), and date (if present).
   */
  toEnvelope(): Envelope;
  /**
   * Converts this request into an envelope (EnvelopeEncodable implementation).
   */
  intoEnvelope(): Envelope;
  /**
   * Creates a request from an envelope.
   */
  static fromEnvelope(envelope: Envelope, expectedFunction?: Function): Request;
  /**
   * Returns a string representation of the request.
   */
  toString(): string;
  /**
   * Checks equality with another request.
   */
  equals(other: Request): boolean;
}
//#endregion
//#region src/extension/response.d.ts
/**
 * Interface that defines the behavior of a response.
 */
interface ResponseBehavior {
  /**
   * Sets the result value for a successful response.
   * @throws Error if called on a failure response.
   */
  withResult(result: EnvelopeEncodableValue): Response;
  /**
   * Sets the error value for a failure response.
   * @throws Error if called on a successful response.
   */
  withError(error: EnvelopeEncodableValue): Response;
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
  id(): ARID | undefined;
  /**
   * Returns the result envelope if this is a successful response.
   * @throws Error if this is a failure response.
   */
  result(): Envelope;
  /**
   * Returns the error envelope if this is a failure response.
   * @throws Error if this is a successful response.
   */
  error(): Envelope;
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
 * const successResponse = Response.newSuccess(requestId)
 *   .withResult("Transaction completed");
 *
 * // Create an error response
 * const errorResponse = Response.newFailure(requestId)
 *   .withError("Insufficient funds");
 *
 * // Convert to envelopes
 * const successEnvelope = successResponse.toEnvelope();
 * const errorEnvelope = errorResponse.toEnvelope();
 * ```
 */
declare class Response implements ResponseBehavior, EnvelopeEncodable {
  private _result;
  private constructor();
  /**
   * Creates a new successful response with the specified request ID.
   *
   * By default, the result will be the 'OK' known value. Use `withResult`
   * to set a specific result value.
   */
  static newSuccess(id: ARID): Response;
  /**
   * Creates a new failure response with the specified request ID.
   *
   * By default, the error will be the 'Unknown' known value. Use
   * `withError` to set a specific error message.
   */
  static newFailure(id: ARID): Response;
  /**
   * Creates a new early failure response without a request ID.
   *
   * An early failure occurs when the error happens before the request
   * has been fully processed, so the request ID is not known.
   */
  static newEarlyFailure(): Response;
  /**
   * Creates an envelope containing the 'Unknown' known value.
   */
  static unknown(): Envelope;
  /**
   * Creates an envelope containing the 'OK' known value.
   */
  static ok(): Envelope;
  /**
   * Returns a human-readable summary of the response.
   */
  summary(): string;
  withResult(result: EnvelopeEncodableValue): Response;
  withOptionalResult(result: EnvelopeEncodableValue | undefined): Response;
  withError(error: EnvelopeEncodableValue): Response;
  withOptionalError(error: EnvelopeEncodableValue | undefined): Response;
  isOk(): boolean;
  isErr(): boolean;
  id(): ARID | undefined;
  expectId(): ARID;
  result(): Envelope;
  error(): Envelope;
  /**
   * Extracts a typed result value from a successful response.
   */
  extractResult<T>(decoder: (cbor: unknown) => T): T;
  /**
   * Extracts a typed error value from a failure response.
   */
  extractError<T>(decoder: (cbor: unknown) => T): T;
  /**
   * Converts the response to an envelope.
   *
   * Successful responses have the request ID as the subject and a 'result'
   * assertion. Failure responses have the request ID (or 'Unknown' if not known)
   * as the subject and an 'error' assertion.
   */
  toEnvelope(): Envelope;
  /**
   * Converts this response into an envelope (EnvelopeEncodable implementation).
   */
  intoEnvelope(): Envelope;
  /**
   * Creates a response from an envelope.
   */
  static fromEnvelope(envelope: Envelope): Response;
  /**
   * Returns a string representation of the response.
   */
  toString(): string;
  /**
   * Checks equality with another response.
   */
  equals(other: Response): boolean;
}
//#endregion
//#region src/extension/event.d.ts
/**
 * Interface that defines the behavior of an event.
 */
interface EventBehavior<T extends EnvelopeEncodableValue> {
  /**
   * Adds a note to the event.
   */
  withNote(note: string): Event<T>;
  /**
   * Adds a date to the event.
   */
  withDate(date: Date): Event<T>;
  /**
   * Returns the content of the event.
   */
  content(): T;
  /**
   * Returns the unique identifier (ARID) of the event.
   */
  id(): ARID;
  /**
   * Returns the note attached to the event, or an empty string if none exists.
   */
  note(): string;
  /**
   * Returns the date attached to the event, if any.
   */
  date(): Date | undefined;
  /**
   * Converts the event to an envelope.
   */
  toEnvelope(): Envelope;
}
/**
 * An Event represents a notification or message that doesn't expect a response.
 *
 * @example
 * ```typescript
 * import { Event, ARID } from '@blockchaincommons/envelope';
 *
 * // Create a status update event
 * const eventId = ARID.new();
 * const timestamp = new Date("2024-08-15T13:45:30Z");
 *
 * const statusEvent = Event.new("System online", eventId)
 *   .withNote("Regular status update")
 *   .withDate(timestamp);
 *
 * // Convert to an envelope for transmission
 * const envelope = statusEvent.toEnvelope();
 * ```
 *
 * @typeParam T - The type of content this event carries
 */
declare class Event<T extends EnvelopeEncodableValue> implements EventBehavior<T>, EnvelopeEncodable {
  private readonly _content;
  private readonly _id;
  private _note;
  private _date;
  private constructor();
  /**
   * Creates a new event with the specified content and ID.
   */
  static new<T extends EnvelopeEncodableValue>(content: T, id: ARID): Event<T>;
  /**
   * Returns a human-readable summary of the event.
   */
  summary(): string;
  withNote(note: string): Event<T>;
  withDate(date: Date): Event<T>;
  content(): T;
  id(): ARID;
  note(): string;
  date(): Date | undefined;
  /**
   * Converts the event to an envelope.
   *
   * The envelope's subject is the event's ID tagged with TAG_EVENT,
   * and assertions include the event's content, note (if not empty), and date
   * (if present).
   */
  toEnvelope(): Envelope;
  /**
   * Converts this event into an envelope (EnvelopeEncodable implementation).
   */
  intoEnvelope(): Envelope;
  /**
   * Creates an event from an envelope.
   *
   * @typeParam T - The type to extract the content as
   */
  static fromEnvelope<T extends EnvelopeEncodableValue>(envelope: Envelope, contentExtractor: (env: Envelope) => T): Event<T>;
  /**
   * Creates a string event from an envelope.
   */
  static stringFromEnvelope(envelope: Envelope): Event<string>;
  /**
   * Returns a string representation of the event.
   */
  toString(): string;
  /**
   * Checks equality with another event.
   */
  equals(other: Event<T>): boolean;
}
//#endregion
//#region src/format/format-context.d.ts
type FormatContextOpt = {
  type: "none";
} | {
  type: "global";
} | {
  type: "custom";
  context: FormatContext;
};
declare const formatContextNone: () => FormatContextOpt;
declare const formatContextGlobal: () => FormatContextOpt;
declare const formatContextCustom: (context: FormatContext) => FormatContextOpt;
declare class FormatContext implements TagsStoreTrait {
  private readonly _tags;
  private readonly _knownValues;
  constructor(tags?: TagsStore, knownValues?: KnownValuesStore);
  tags(): TagsStore;
  knownValues(): KnownValuesStore;
  assignedNameForTag(tag: Tag): string | undefined;
  nameForTag(tag: Tag): string;
  tagForValue(value: CborNumber): Tag | undefined;
  tagForName(name: string): Tag | undefined;
  nameForValue(value: CborNumber): string;
  summarizer(tag: CborNumber): CborSummarizer | undefined;
  registerTag(value: number | bigint, name: string): void;
  clone(): FormatContext;
}
declare const getGlobalFormatContext: () => FormatContext;
declare const withFormatContext: <T>(action: (context: FormatContext) => T) => T;
declare const withFormatContextMut: <T>(action: (context: FormatContext) => T) => T;
declare const registerTagsIn: (context: FormatContext) => void;
declare const registerTags: () => void;
declare const globalFormatContext: () => FormatContext;
declare const GLOBAL_FORMAT_CONTEXT: {
  get: () => FormatContext;
};
//#endregion
//#region src/format/tree.d.ts
/**
 * Specifies the format for displaying envelope digests in tree output.
 *
 * Ported from bc-envelope-rust/src/format/tree/format/digest.rs
 */
declare enum DigestDisplayFormat {
  /**
   * Short format: hex-encoded first 4 bytes of the digest (8 chars),
   * matching Rust `Digest::short_description`.
   * This is the default format.
   */
  Short = "short",
  /**
   * Full format: complete 64 hex character digest.
   */
  Full = "full",
  /**
   * UR format: digest encoded as a UR string.
   */
  UR = "ur"
}
interface TreeFormatOptions {
  hideNodes?: boolean;
  highlightDigests?: Set<string>;
  digestDisplay?: DigestDisplayFormat | "short" | "full" | "ur";
  context?: FormatContext;
}
//#endregion
//#region src/format/notation.d.ts
interface EnvelopeFormatOpts {
  flat: boolean;
  context: FormatContextOpt;
}
declare const defaultFormatOpts: () => EnvelopeFormatOpts;
declare const flatFormatOpts: () => EnvelopeFormatOpts;
type EnvelopeFormatItem = {
  type: "begin";
  value: string;
} | {
  type: "end";
  value: string;
} | {
  type: "item";
  value: string;
} | {
  type: "separator";
} | {
  type: "list";
  items: EnvelopeFormatItem[];
};
declare const formatBegin: (value: string) => EnvelopeFormatItem;
declare const formatEnd: (value: string) => EnvelopeFormatItem;
declare const formatItem: (value: string) => EnvelopeFormatItem;
declare const formatSeparator: () => EnvelopeFormatItem;
declare const formatList: (items: EnvelopeFormatItem[]) => EnvelopeFormatItem;
declare const formatCbor: (cbor: Cbor, opts: EnvelopeFormatOpts) => EnvelopeFormatItem;
declare const formatAssertion: (assertion: Assertion, opts: EnvelopeFormatOpts) => EnvelopeFormatItem;
declare const formatEnvelope: (envelope: Envelope, opts: EnvelopeFormatOpts) => EnvelopeFormatItem;
//#endregion
//#region src/format/mermaid.d.ts
declare enum MermaidOrientation {
  LeftToRight = "LR",
  TopToBottom = "TB",
  RightToLeft = "RL",
  BottomToTop = "BT"
}
declare enum MermaidTheme {
  Default = "default",
  Neutral = "neutral",
  Dark = "dark",
  Forest = "forest",
  Base = "base"
}
interface MermaidFormatOpts {
  hideNodes?: boolean;
  monochrome?: boolean;
  theme?: MermaidTheme;
  orientation?: MermaidOrientation;
  highlightingTarget?: Set<Digest>;
}
declare const defaultMermaidOpts: () => MermaidFormatOpts;
declare const registerMermaidExtension: () => void;
//#endregion
//#region src/base/envelope.d.ts
type EnvelopeCase = {
  type: "node";
  subject: Envelope;
  assertions: Envelope[];
  digest: Digest;
} | {
  type: "leaf";
  cbor: Cbor;
  digest: Digest;
} | {
  type: "wrapped";
  envelope: Envelope;
  digest: Digest;
} | {
  type: "assertion";
  assertion: Assertion;
} | {
  type: "elided";
  digest: Digest;
} | {
  type: "knownValue";
  value: KnownValue;
  digest: Digest;
} | {
  type: "encrypted";
  message: EncryptedMessage;
} | {
  type: "compressed";
  value: Compressed;
};
declare class Envelope implements DigestProvider {
  private readonly _case;
  private constructor();
  case(): EnvelopeCase;
  static new(subject: EnvelopeEncodableValue): Envelope;
  static newOrNull(subject: EnvelopeEncodableValue | undefined): Envelope;
  static newOrNone(subject: EnvelopeEncodableValue | undefined): Envelope | undefined;
  static fromCase(envelopeCase: EnvelopeCase): Envelope;
  static newAssertion(predicate: EnvelopeEncodableValue, object: EnvelopeEncodableValue): Envelope;
  static null(): Envelope;
  static newWithUncheckedAssertions(subject: Envelope, uncheckedAssertions: Envelope[]): Envelope;
  static newWithAssertions(subject: Envelope, assertions: Envelope[]): Envelope;
  static newWithAssertion(assertion: Assertion): Envelope;
  static newWithKnownValue(value: KnownValue | number | bigint): Envelope;
  static newWithEncrypted(encryptedMessage: EncryptedMessage): Envelope;
  static newWithCompressed(compressed: Compressed): Envelope;
  static newElided(digest: Digest): Envelope;
  static newLeaf(value: unknown): Envelope;
  static newWrapped(envelope: Envelope): Envelope;
  digest(): Digest;
  subject(): Envelope;
  isSubjectAssertion(): boolean;
  isSubjectObscured(): boolean;
  private static valueToCbor;
  private static cborToBytes;
  untaggedCbor(): Cbor;
  taggedCbor(): Cbor;
  static fromUntaggedCbor(cbor: Cbor): Envelope;
  static fromTaggedCbor(cbor: Cbor): Envelope;
  addAssertion(predicate: EnvelopeEncodableValue, object: EnvelopeEncodableValue): Envelope;
  addAssertionEnvelope(assertion: Envelope): Envelope;
  toString(): string;
  clone(): Envelope;
  treeFormat: (options?: TreeFormatOptions) => string;
  shortId: (format?: "short" | "full" | "ur") => string;
  summary: (maxLength?: number) => string;
  hex: () => string;
  cborBytes: () => Uint8Array;
  hexOpt: (annotate: boolean, context?: FormatContext) => string;
  diagnostic: () => string;
  diagnosticAnnotated: (context?: FormatContext) => string;
  addAssertionEnvelopes: (assertions: Envelope[]) => Envelope;
  addOptionalAssertionEnvelope: (assertion: Envelope | undefined) => Envelope;
  addOptionalAssertion: (predicate: EnvelopeEncodableValue, object: EnvelopeEncodableValue | undefined) => Envelope;
  addNonemptyStringAssertion: (predicate: EnvelopeEncodableValue, str: string) => Envelope;
  addAssertions: (envelopes: Envelope[]) => Envelope;
  addAssertionIf: (condition: boolean, predicate: EnvelopeEncodableValue, object: EnvelopeEncodableValue) => Envelope;
  addAssertionEnvelopeIf: (condition: boolean, assertionEnvelope: Envelope) => Envelope;
  removeAssertion: (target: Envelope) => Envelope;
  replaceAssertion: (assertion: Envelope, newAssertion: Envelope) => Envelope;
  replaceSubject: (subject: Envelope) => Envelope;
  addAssertionSalted: (predicate: EnvelopeEncodableValue, object: EnvelopeEncodableValue, salted: boolean) => Envelope;
  addAssertionEnvelopeSalted: (assertionEnvelope: Envelope, salted: boolean) => Envelope;
  addOptionalAssertionEnvelopeSalted: (assertionEnvelope: Envelope | undefined, salted: boolean) => Envelope;
  elide: () => Envelope;
  elideRemovingSetWithAction: (target: Set<Digest>, action: ObscureAction) => Envelope;
  elideRemovingSet: (target: Set<Digest>) => Envelope;
  elideRemovingArrayWithAction: (target: DigestProvider[], action: ObscureAction) => Envelope;
  elideRemovingArray: (target: DigestProvider[]) => Envelope;
  elideRemovingTargetWithAction: (target: DigestProvider, action: ObscureAction) => Envelope;
  elideRemovingTarget: (target: DigestProvider) => Envelope;
  elideRevealingSetWithAction: (target: Set<Digest>, action: ObscureAction) => Envelope;
  elideRevealingSet: (target: Set<Digest>) => Envelope;
  elideRevealingArrayWithAction: (target: DigestProvider[], action: ObscureAction) => Envelope;
  elideRevealingArray: (target: DigestProvider[]) => Envelope;
  elideRevealingTargetWithAction: (target: DigestProvider, action: ObscureAction) => Envelope;
  elideRevealingTarget: (target: DigestProvider) => Envelope;
  unelide: (envelope: Envelope) => Envelope;
  nodesMatching: (targetDigests: Set<Digest> | undefined, obscureTypes: ObscureType[]) => Set<Digest>;
  walkUnelide: (envelopes: Envelope[]) => Envelope;
  walkReplace: (target: Set<Digest>, replacement: Envelope) => Envelope;
  walkDecrypt: (keys: SymmetricKey[]) => Envelope;
  walkDecompress: (targetDigests?: Set<Digest>) => Envelope;
  isEquivalentTo: (other: Envelope) => boolean;
  isIdenticalTo: (other: Envelope) => boolean;
  tryLeaf: () => Cbor;
  extractString: () => string;
  extractNumber: () => number;
  extractBoolean: () => boolean;
  extractBytes: () => Uint8Array;
  extractNull: () => null;
  extractSubject: <T>(decoder: (cbor: Cbor) => T) => T;
  tryObjectForPredicate: <T>(predicate: EnvelopeEncodableValue, decoder: (cbor: Cbor) => T) => T;
  tryOptionalObjectForPredicate: <T>(predicate: EnvelopeEncodableValue, decoder: (cbor: Cbor) => T) => T | undefined;
  extractObjectForPredicateWithDefault: <T>(predicate: EnvelopeEncodableValue, decoder: (cbor: Cbor) => T, defaultValue: T) => T;
  extractObjectsForPredicate: <T>(predicate: EnvelopeEncodableValue, decoder: (cbor: Cbor) => T) => T[];
  tryObjectsForPredicate: <T>(predicate: EnvelopeEncodableValue, decoder: (cbor: Cbor) => T) => T[];
  isFalse: () => boolean;
  isTrue: () => boolean;
  isBool: () => boolean;
  isNumber: () => boolean;
  isSubjectNumber: () => boolean;
  isNaN: () => boolean;
  isSubjectNaN: () => boolean;
  isNull: () => boolean;
  tryByteString: () => Uint8Array;
  asByteString: () => Uint8Array | undefined;
  asArray: () => readonly Cbor[] | undefined;
  asMap: () => CborMap | undefined;
  asText: () => string | undefined;
  asLeaf: () => Cbor | undefined;
  asKnownValue: () => KnownValue | undefined;
  tryKnownValue: () => KnownValue;
  isKnownValue: () => boolean;
  isSubjectUnit: () => boolean;
  checkSubjectUnit: () => Envelope;
  hasAssertions: () => boolean;
  asAssertion: () => Envelope | undefined;
  tryAssertion: () => Envelope;
  asPredicate: () => Envelope | undefined;
  tryPredicate: () => Envelope;
  asObject: () => Envelope | undefined;
  tryObject: () => Envelope;
  isAssertion: () => boolean;
  isElided: () => boolean;
  isLeaf: () => boolean;
  isNode: () => boolean;
  isWrapped: () => boolean;
  isInternal: () => boolean;
  isObscured: () => boolean;
  assertions: () => Envelope[];
  assertionsWithPredicate: (predicate: EnvelopeEncodableValue) => Envelope[];
  assertionWithPredicate: (predicate: EnvelopeEncodableValue) => Envelope;
  optionalAssertionWithPredicate: (predicate: EnvelopeEncodableValue) => Envelope | undefined;
  objectForPredicate: (predicate: EnvelopeEncodableValue) => Envelope;
  optionalObjectForPredicate: (predicate: EnvelopeEncodableValue) => Envelope | undefined;
  objectsForPredicate: (predicate: EnvelopeEncodableValue) => Envelope[];
  elementsCount: () => number;
  isSubjectEncrypted: () => boolean;
  isSubjectCompressed: () => boolean;
  isSubjectElided: () => boolean;
  setPosition: (position: number) => Envelope;
  position: () => number;
  removePosition: () => Envelope;
  walk: <State>(hideNodes: boolean, state: State, visit: Visitor<State>) => void;
  digests: (levelLimit: number) => Set<Digest>;
  shallowDigests: () => Set<Digest>;
  deepDigests: () => Set<Digest>;
  structuralDigest: () => Digest;
  object: () => Envelope;
  predicate: () => Envelope;
  elideSetWithAction: (target: Set<Digest>, action: ObscureAction) => Envelope;
  urString: () => string;
  ur: () => UR;
  taggedCborData: () => Uint8Array;
  static fromUrString: (urString: string) => Envelope;
  static fromURString: (urString: string) => Envelope;
  static fromUR: (ur: UR) => Envelope;
  wrap: () => Envelope;
  tryUnwrap: () => Envelope;
  unwrap: () => Envelope;
  addAttachment: (payload: EnvelopeEncodableValue, vendor: string, conformsTo?: string) => Envelope;
  attachmentPayload: () => Envelope;
  attachmentVendor: () => string;
  attachmentConformsTo: () => string | undefined;
  attachments: () => Envelope[];
  attachmentsWithVendorAndConformsTo: (vendor?: string, conformsTo?: string) => Envelope[];
  attachmentWithVendorAndConformsTo: (vendor?: string, conformsTo?: string) => Envelope;
  validateAttachment: () => void;
  addEdgeEnvelope: (edge: Envelope) => Envelope;
  edges: () => Envelope[];
  validateEdge: () => void;
  edgeIsA: () => Envelope;
  edgeSource: () => Envelope;
  edgeTarget: () => Envelope;
  edgeSubject: () => Envelope;
  edgesMatching: (isA?: Envelope, source?: Envelope, target?: Envelope, subject?: Envelope) => Envelope[];
  compress: () => Envelope;
  decompress: () => Envelope;
  compressSubject: () => Envelope;
  decompressSubject: () => Envelope;
  isCompressed: () => boolean;
  encryptSubject: (key: SymmetricKey) => Envelope;
  decryptSubject: (key: SymmetricKey) => Envelope;
  encrypt: (key: SymmetricKey) => Envelope;
  decrypt: (key: SymmetricKey) => Envelope;
  isEncrypted: () => boolean;
  proofContainsSet: (target: Set<Digest>) => Envelope | undefined;
  proofContainsTarget: (target: Envelope) => Envelope | undefined;
  confirmContainsSet: (target: Set<Digest>, proof: Envelope) => boolean;
  confirmContainsTarget: (target: Envelope, proof: Envelope) => boolean;
  encryptSubjectToRecipient: (recipient: Encrypter$1) => Envelope;
  encryptSubjectToRecipients: (recipients: Encrypter$1[]) => Envelope;
  addRecipient: (recipient: Encrypter$1, contentKey: SymmetricKey, testNonce?: Nonce) => Envelope;
  decryptSubjectToRecipient: (recipient: Decrypter$1) => Envelope;
  decryptToRecipient: (recipient: Decrypter$1) => Envelope;
  encryptToRecipients: (recipients: Encrypter$1[]) => Envelope;
  recipients: () => SealedMessage[];
  encryptToRecipient: (recipient: Encrypter$1) => Envelope;
  seal: (sender: Signer, recipient: Encrypter$1) => Envelope;
  sealOpt: (sender: Signer, recipient: Encrypter$1, options?: SigningOptions) => Envelope;
  unseal: (senderPublicKey: Verifier, recipient: Decrypter$1) => Envelope;
  addSalt: () => Envelope;
  addSaltInstance: (salt: Salt) => Envelope;
  addSaltWithLength: (count: number) => Envelope;
  addSaltWithLen: (count: number) => Envelope;
  addSaltBytes: (saltBytes: Uint8Array) => Envelope;
  addSaltInRange: (min: number, max: number) => Envelope;
  addSaltUsing: (rng: RandomNumberGenerator) => Envelope;
  addSaltWithLenUsing: (count: number, rng: RandomNumberGenerator) => Envelope;
  addSaltInRangeUsing: (min: number, max: number, rng: RandomNumberGenerator) => Envelope;
  addSignature: (signer: Signer) => Envelope;
  addSignatureOpt: (signer: Signer, options?: SigningOptions, metadata?: SignatureMetadata) => Envelope;
  addSignatureWithMetadata: (signer: Signer, metadata?: SignatureMetadata) => Envelope;
  addSignatures: (signers: Signer[]) => Envelope;
  addSignaturesOpt: (signersWithOptions: {
    signer: Signer;
    options?: SigningOptions;
    metadata?: SignatureMetadata;
  }[]) => Envelope;
  addSignaturesWithMetadata: (signersWithMetadata: {
    signer: Signer;
    metadata?: SignatureMetadata;
  }[]) => Envelope;
  makeSignedAssertion: (signature: Signature, note?: string) => Envelope;
  isVerifiedSignature: (signature: Signature, verifier: Verifier) => boolean;
  verifySignature: (signature: Signature, verifier: Verifier) => Envelope;
  hasSignatureFrom: (verifier: Verifier) => boolean;
  hasSignatureFromReturningMetadata: (verifier: Verifier) => Envelope | undefined;
  verifySignatureFrom: (verifier: Verifier) => Envelope;
  verifySignatureFromReturningMetadata: (verifier: Verifier) => Envelope;
  hasSignaturesFrom: (verifiers: Verifier[]) => boolean;
  hasSignaturesFromThreshold: (verifiers: Verifier[], threshold?: number) => boolean;
  verifySignaturesFrom: (verifiers: Verifier[]) => Envelope;
  verifySignaturesFromThreshold: (verifiers: Verifier[], threshold?: number) => Envelope;
  signatures: () => Envelope[];
  sign: (signer: Signer) => Envelope;
  signOpt: (signer: Signer, options?: SigningOptions) => Envelope;
  signWithMetadata: (signer: Signer, metadata?: SignatureMetadata) => Envelope;
  verify: (verifier: Verifier) => Envelope;
  verifyReturningMetadata: (verifier: Verifier) => {
    envelope: Envelope;
    metadata: Envelope;
  };
  addType: (object: EnvelopeEncodableValue) => Envelope;
  types: () => Envelope[];
  getType: () => Envelope;
  hasType: (t: EnvelopeEncodableValue) => boolean;
  checkType: (t: EnvelopeEncodableValue) => void;
  hasTypeValue: (t: KnownValue) => boolean;
  static newAttachment: (payload: EnvelopeEncodableValue, vendor: string, conformsTo?: string) => Envelope;
  static unit: () => Envelope;
  format: () => string;
  formatOpt: (opts: EnvelopeFormatOpts) => string;
  formatFlat: () => string;
  mermaidFormat: () => string;
  mermaidFormatOpt: (opts: MermaidFormatOpts) => string;
  summaryWithContext: (maxLength: number, context: FormatContext) => string;
  lockSubject: (method: KeyDerivationMethod, secret: Uint8Array) => Envelope;
  unlockSubject: (secret: Uint8Array) => Envelope;
  isLockedWithPassword: () => boolean;
  isLockedWithSshAgent: () => boolean;
  addSecret: (method: KeyDerivationMethod, secret: Uint8Array, contentKey: SymmetricKey) => Envelope;
  lock: (method: KeyDerivationMethod, secret: Uint8Array) => Envelope;
  unlock: (secret: Uint8Array) => Envelope;
  sskrSplit: (spec: SSKRSpec, contentKey: SymmetricKey) => Envelope[][];
  sskrSplitFlattened: (spec: SSKRSpec, contentKey: SymmetricKey) => Envelope[];
  sskrSplitUsing: (spec: SSKRSpec, contentKey: SymmetricKey, rng: RandomNumberGenerator) => Envelope[][];
  static sskrJoin: (envelopes: Envelope[]) => Envelope;
  toCbor: () => unknown;
  expectLeaf: () => unknown;
  checkTypeValue: (t: KnownValue) => void;
}
//#endregion
//#region src/base/error.d.ts
/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 */
declare enum ErrorCode {
  ALREADY_ELIDED = "ALREADY_ELIDED",
  AMBIGUOUS_PREDICATE = "AMBIGUOUS_PREDICATE",
  INVALID_DIGEST = "INVALID_DIGEST",
  INVALID_FORMAT = "INVALID_FORMAT",
  MISSING_DIGEST = "MISSING_DIGEST",
  NONEXISTENT_PREDICATE = "NONEXISTENT_PREDICATE",
  NOT_WRAPPED = "NOT_WRAPPED",
  NOT_LEAF = "NOT_LEAF",
  NOT_ASSERTION = "NOT_ASSERTION",
  INVALID_ASSERTION = "INVALID_ASSERTION",
  INVALID_ATTACHMENT = "INVALID_ATTACHMENT",
  NONEXISTENT_ATTACHMENT = "NONEXISTENT_ATTACHMENT",
  AMBIGUOUS_ATTACHMENT = "AMBIGUOUS_ATTACHMENT",
  EDGE_MISSING_IS_A = "EDGE_MISSING_IS_A",
  EDGE_MISSING_SOURCE = "EDGE_MISSING_SOURCE",
  EDGE_MISSING_TARGET = "EDGE_MISSING_TARGET",
  EDGE_DUPLICATE_IS_A = "EDGE_DUPLICATE_IS_A",
  EDGE_DUPLICATE_SOURCE = "EDGE_DUPLICATE_SOURCE",
  EDGE_DUPLICATE_TARGET = "EDGE_DUPLICATE_TARGET",
  EDGE_UNEXPECTED_ASSERTION = "EDGE_UNEXPECTED_ASSERTION",
  NONEXISTENT_EDGE = "NONEXISTENT_EDGE",
  AMBIGUOUS_EDGE = "AMBIGUOUS_EDGE",
  ALREADY_COMPRESSED = "ALREADY_COMPRESSED",
  NOT_COMPRESSED = "NOT_COMPRESSED",
  ALREADY_ENCRYPTED = "ALREADY_ENCRYPTED",
  NOT_ENCRYPTED = "NOT_ENCRYPTED",
  NOT_KNOWN_VALUE = "NOT_KNOWN_VALUE",
  UNKNOWN_RECIPIENT = "UNKNOWN_RECIPIENT",
  UNKNOWN_SECRET = "UNKNOWN_SECRET",
  UNVERIFIED_SIGNATURE = "UNVERIFIED_SIGNATURE",
  INVALID_OUTER_SIGNATURE_TYPE = "INVALID_OUTER_SIGNATURE_TYPE",
  INVALID_INNER_SIGNATURE_TYPE = "INVALID_INNER_SIGNATURE_TYPE",
  UNVERIFIED_INNER_SIGNATURE = "UNVERIFIED_INNER_SIGNATURE",
  INVALID_SIGNATURE_TYPE = "INVALID_SIGNATURE_TYPE",
  INVALID_SHARES = "INVALID_SHARES",
  SSKR = "SSKR",
  INVALID_TYPE = "INVALID_TYPE",
  AMBIGUOUS_TYPE = "AMBIGUOUS_TYPE",
  SUBJECT_NOT_UNIT = "SUBJECT_NOT_UNIT",
  UNEXPECTED_RESPONSE_ID = "UNEXPECTED_RESPONSE_ID",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  CBOR = "CBOR",
  COMPONENTS = "COMPONENTS",
  GENERAL = "GENERAL"
}
declare class EnvelopeError extends Error {
  readonly code: ErrorCode;
  readonly cause?: Error;
  constructor(code: ErrorCode, message: string, cause?: Error);
  static alreadyElided(): EnvelopeError;
  static ambiguousPredicate(): EnvelopeError;
  static invalidDigest(): EnvelopeError;
  static invalidFormat(): EnvelopeError;
  static missingDigest(): EnvelopeError;
  static nonexistentPredicate(): EnvelopeError;
  static notWrapped(): EnvelopeError;
  static notLeaf(): EnvelopeError;
  static notAssertion(): EnvelopeError;
  static invalidAssertion(): EnvelopeError;
  static invalidAttachment(message?: string): EnvelopeError;
  static nonexistentAttachment(): EnvelopeError;
  static ambiguousAttachment(): EnvelopeError;
  static edgeMissingIsA(): EnvelopeError;
  static edgeMissingSource(): EnvelopeError;
  static edgeMissingTarget(): EnvelopeError;
  static edgeDuplicateIsA(): EnvelopeError;
  static edgeDuplicateSource(): EnvelopeError;
  static edgeDuplicateTarget(): EnvelopeError;
  static edgeUnexpectedAssertion(): EnvelopeError;
  static nonexistentEdge(): EnvelopeError;
  static ambiguousEdge(): EnvelopeError;
  static alreadyCompressed(): EnvelopeError;
  static notCompressed(): EnvelopeError;
  static alreadyEncrypted(): EnvelopeError;
  static notEncrypted(): EnvelopeError;
  static notKnownValue(): EnvelopeError;
  static unknownRecipient(): EnvelopeError;
  static unknownSecret(): EnvelopeError;
  static unverifiedSignature(): EnvelopeError;
  static invalidOuterSignatureType(): EnvelopeError;
  static invalidInnerSignatureType(): EnvelopeError;
  static unverifiedInnerSignature(): EnvelopeError;
  static invalidSignatureType(): EnvelopeError;
  static invalidShares(): EnvelopeError;
  static sskr(message: string, cause?: Error): EnvelopeError;
  static invalidType(): EnvelopeError;
  static ambiguousType(): EnvelopeError;
  static subjectNotUnit(): EnvelopeError;
  static unexpectedResponseId(): EnvelopeError;
  static invalidResponse(): EnvelopeError;
  static cbor(message: string, cause?: Error): EnvelopeError;
  static components(message: string, cause?: Error): EnvelopeError;
  static general(message: string, cause?: Error): EnvelopeError;
  static msg(message: string): EnvelopeError;
}
//#endregion
//#region src/base/cbor.d.ts
declare class EnvelopeCBORTagged implements CborTagged {
  cborTags(): ReturnType<typeof tagsForValues>;
  static cborTags(): number[];
}
declare class EnvelopeCBORTaggedEncodable implements CborTaggedEncodable {
  private readonly envelope;
  constructor(envelope: Envelope);
  cborTags(): ReturnType<typeof tagsForValues>;
  untaggedCbor(): Cbor;
  taggedCbor(): Cbor;
}
declare class EnvelopeCBORTaggedDecodable<T = Envelope> implements CborTaggedDecodable<T> {
  cborTags(): ReturnType<typeof tagsForValues>;
  static fromUntaggedCbor(cbor: Cbor): Envelope;
  static fromTaggedCbor(cbor: Cbor): Envelope;
  fromUntaggedCbor(cbor: Cbor): T;
  fromTaggedCbor(cbor: Cbor): T;
}
declare function envelopeToCbor(envelope: Envelope): Cbor;
declare function envelopeFromCbor(cbor: Cbor): Envelope;
declare function envelopeToBytes(envelope: Envelope): Uint8Array;
declare function envelopeFromBytes(bytes: Uint8Array): Envelope;
//#endregion
//#region src/base/envelope-decodable.d.ts
declare function extractString(envelope: Envelope): string;
declare function extractNumber(envelope: Envelope): number;
declare function extractBoolean(envelope: Envelope): boolean;
declare function extractBytes(envelope: Envelope): Uint8Array;
declare function extractNull(envelope: Envelope): null;
declare class EnvelopeDecoder {
  static tryFromCbor(cbor: Cbor): Envelope;
  static tryFromCborData(data: Uint8Array): Envelope;
}
type CborDecoder<T> = (cbor: Cbor) => T;
declare function extractSubject<T>(envelope: Envelope, decoder: CborDecoder<T>): T;
declare function tryObjectForPredicate<T>(envelope: Envelope, predicate: EnvelopeEncodableValue, decoder: CborDecoder<T>): T;
declare function tryOptionalObjectForPredicate<T>(envelope: Envelope, predicate: EnvelopeEncodableValue, decoder: CborDecoder<T>): T | undefined;
declare function extractObjectForPredicateWithDefault<T>(envelope: Envelope, predicate: EnvelopeEncodableValue, decoder: CborDecoder<T>, defaultValue: T): T;
declare function extractObjectsForPredicate<T>(envelope: Envelope, predicate: EnvelopeEncodableValue, decoder: CborDecoder<T>): T[];
declare function tryObjectsForPredicate<T>(envelope: Envelope, predicate: EnvelopeEncodableValue, decoder: CborDecoder<T>): T[];
//#endregion
//#region src/format/envelope-summary.d.ts
interface EnvelopeSummary {
  envelopeSummary(maxLength: number, context: FormatContextOpt): string;
}
declare const cborEnvelopeSummary: (cbor: Cbor, maxLength: number, context: FormatContextOpt) => string;
//#endregion
//#region src/seal.d.ts
declare const registerSealExtension: () => void;
//#endregion
//#region src/utils/string.d.ts
/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 *
 * String utility functions used throughout the envelope library.
 *
 * Provides helper methods for string formatting and manipulation.
 */
/**
 * Flanks a string with specified left and right delimiters.
 *
 * @param str - The string to flank
 * @param left - The left delimiter
 * @param right - The right delimiter
 * @returns The flanked string
 *
 * @example
 * ```typescript
 * flanked('hello', '"', '"')  // Returns: "hello"
 * flanked('name', "'", "'")   // Returns: 'name'
 * flanked('item', '[', ']')   // Returns: [item]
 * ```
 */
declare function flanked(str: string, left: string, right: string): string;
/**
 * Extension methods for String objects to support fluent API style.
 */
declare global {
  interface String {
    /**
     * Flanks this string with specified left and right delimiters.
     *
     * @param left - The left delimiter
     * @param right - The right delimiter
     * @returns The flanked string
     */
    flankedBy(left: string, right: string): string;
  }
}
//#endregion
//#region src/index.d.ts
declare const VERSION = "0.37.0";
//#endregion
export { ADD, ADD_VALUE, AND, AND_VALUE, ATTACHMENT, Assertion, Attachments, BLANK, BLANK_VALUE, CBOR_TAG_FUNCTION, CBOR_TAG_PARAMETER, CBOR_TAG_PLACEHOLDER, CBOR_TAG_REPLACEMENT, CONFORMS_TO, type CborDecoder, ComponentsSealedMessage, Compressed, DIV, DIV_VALUE, type Decrypter, Digest, DigestDisplayFormat, type DigestProvider, EDGE, EQ, EQ_VALUE, EdgeType, type Edgeable, Edges, EncryptedMessage, type Encrypter, Envelope, EnvelopeCBORTagged, EnvelopeCBORTaggedDecodable, EnvelopeCBORTaggedEncodable, type EnvelopeCase, EnvelopeDecoder, type EnvelopeEncodable, type EnvelopeEncodableValue, EnvelopeError, type EnvelopeFormatItem, type EnvelopeFormatOpts, type EnvelopeSummary, ErrorCode, Event, type EventBehavior, Expression, FUNCTION_IDS, FormatContext, type FormatContextOpt, Function, type FunctionID, FunctionsStore, GE, GE_VALUE, GLOBAL_FORMAT_CONTEXT, GLOBAL_FUNCTIONS, GLOBAL_PARAMETERS, GT, GT_VALUE, HAS_RECIPIENT, IS_A, LE, LE_VALUE, LHS, LHS_VALUE, LT, LT_VALUE, LazyStore, MUL, MUL_VALUE, type MermaidFormatOpts, MermaidOrientation, MermaidTheme, NE, NEG, NEG_VALUE, NE_VALUE, NOT, NOTE, NOT_VALUE, OR, OR_VALUE, type ObscureAction, ObscureType, PARAMETER_IDS, Parameter, type ParameterID, ParametersStore, PrivateKeyBase, PublicKeyBase, RHS, RHS_VALUE, Request, type RequestBehavior, Response, type ResponseBehavior, SALT, SIGNED, SOURCE, SUB, SUB_VALUE, SealedMessage, Signature, SignatureMetadata, type Signer, type SigningOptions, SigningPrivateKey, SigningPublicKey, SymmetricKey, TARGET, type TreeFormatOptions, VENDOR, VERSION, type Verifier, type Visitor, XOR, XOR_VALUE, add, and, cborEnvelopeSummary, cborEnvelopeSummary as envelopeSummary, defaultFormatOpts, defaultMermaidOpts, div, edgeLabel, elideAction, envelopeFromBytes, envelopeFromCbor, envelopeToBytes, envelopeToCbor, eq, extractBoolean, extractBytes, extractNull, extractNumber, extractObjectForPredicateWithDefault, extractObjectsForPredicate, extractString, extractSubject, flanked, flatFormatOpts, formatAssertion, formatBegin, formatCbor, formatContextCustom, formatContextGlobal, formatContextNone, formatEnd, formatEnvelope, formatItem, formatList, formatSeparator, ge, getGlobalFormatContext, globalFormatContext, gt, isEnvelopeEncodable, le, lt, mul, ne, neg, not, or, registerCompressExtension, registerEncryptExtension, registerMermaidExtension, registerProofExtension, registerSealExtension, registerSecretExtension, registerSskrExtension, registerTags, registerTagsIn, sub, tryObjectForPredicate, tryObjectsForPredicate, tryOptionalObjectForPredicate, withFormatContext, withFormatContextMut, xor };
//# sourceMappingURL=index.d.mts.map