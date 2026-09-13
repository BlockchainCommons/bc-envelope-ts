import { ARID } from '@blockchaincommons/components';
import { Cbor } from '@blockchaincommons/dcbor';
import { CborCodec } from '@blockchaincommons/dcbor';
import { CborMap } from '@blockchaincommons/dcbor';
import { CborNumber } from '@blockchaincommons/dcbor';
import { CborSummarizer } from '@blockchaincommons/dcbor';
import { Compressed } from '@blockchaincommons/components';
import { Decrypter } from '@blockchaincommons/components';
import { Digest } from '@blockchaincommons/components';
import { EncryptedMessage } from '@blockchaincommons/components';
import { Encrypter } from '@blockchaincommons/components';
import { KeyDerivationMethod } from '@blockchaincommons/components/kdf';
import { KnownValue } from '@blockchaincommons/known-values';
import { KnownValuesStore } from '@blockchaincommons/known-values';
import { Nonce } from '@blockchaincommons/components';
import { RandomNumberGenerator } from '@blockchaincommons/rand';
import { ReadonlyTagsStore } from '@blockchaincommons/dcbor';
import { RngOptions } from '@blockchaincommons/rand';
import { Salt } from '@blockchaincommons/components';
import { SealedMessage } from '@blockchaincommons/components';
import { Signature } from '@blockchaincommons/components';
import { Signer } from '@blockchaincommons/components';
import { SigningOptions } from '@blockchaincommons/components';
import { Spec } from '@blockchaincommons/sskr';
import { SymmetricKey } from '@blockchaincommons/components';
import { Tag } from '@blockchaincommons/dcbor';
import { TagsStore } from '@blockchaincommons/dcbor';
import { ToCbor } from '@blockchaincommons/dcbor';
import { UR } from '@blockchaincommons/uniform-resources';
import { Verifier } from '@blockchaincommons/components';

/** Well-known function `add` (1). */
export declare const ADD: Function_2;

/** Creates an addition expression: lhs + rhs */
export declare function add(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

/** Options for `Envelope.addAssertion` and friends. */
export declare interface AddAssertionOptions {
    /** Also salt the assertion (see `addSalt`) so its digest is not correlatable. */
    salt?: boolean;
}

/**
 * Adds an attachment to an envelope.
 */
export declare function addAttachment(envelope: Envelope, payload: EnvelopeInput, vendor: string, conformsTo?: string): Envelope;

/**
 * Returns a new envelope with an added `'edge': <edge>` assertion.
 *
 */
export declare function addEdgeEnvelope(envelope: Envelope, edge: Envelope): Envelope;

/**
 * Adds a recipient assertion to this envelope.
 *
 * This method adds a `hasRecipient` assertion containing a `SealedMessage`
 * that holds the content key encrypted to the recipient's public key.
 *
 * @param recipient - The recipient's public key (implements Encrypter)
 * @param contentKey - The symmetric key used to encrypt the envelope's subject
 * @param options - A fixed `nonce` or an `rng` for the ephemeral key and nonce
 * @returns A new envelope with the recipient assertion added
 */
export declare function addRecipient(envelope: Envelope, recipient: Encrypter, contentKey: SymmetricKey, options?: RecipientOptions): Envelope;

/** Adds a `hasSecret` assertion holding `contentKey` locked by `secret` via `method`. */
export declare function addSecret(envelope: Envelope, method: KeyDerivationMethod, secret: Uint8Array, contentKey: SymmetricKey): Envelope;

/**
 * Adds a `signed` assertion: a signature over the subject's digest, with
 * `metadata` bound to it when given.
 */
export declare function addSignature(envelope: Envelope, signer: Signer, { signing: options, metadata }?: SignOptions): Envelope;

/** `addSignature` for each signer, each with its own options when given as `{ signer, ...options }`. */
export declare function addSignatures(envelope: Envelope, signers: readonly (Signer | ({
    signer: Signer;
} & SignOptions))[]): Envelope;

/** Adds an `isA` assertion with `object`. */
export declare function addType(envelope: Envelope, object: EnvelopeInput): Envelope;

/** Well-known function `and` ({@link FUNCTION_IDS}.AND). */
export declare const AND: Function_2;

/** Creates a logical AND expression: lhs && rhs */
export declare function and(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

/**
 * A predicate-object relationship representing an assertion about a subject.
 *
 * In Gordian Envelope, assertions are the basic building blocks for attaching
 * information to a subject. An assertion consists of a predicate (which states
 * what is being asserted) and an object (which provides the assertion's
 * value).
 *
 * Assertions can be attached to envelope subjects to form semantic statements
 * like: "subject hasAttribute value" or "document signedBy signature".
 *
 * Assertions are equivalent to RDF (Resource Description Framework) triples,
 * where:
 * - The envelope's subject is the subject of the triple
 * - The assertion's predicate is the predicate of the triple
 * - The assertion's object is the object of the triple
 *
 * Generally you do not create an instance of this type directly, but
 * instead use `Envelope.assertion()`, or the various functions
 * on `Envelope` that create assertions.
 */
export declare class Assertion implements DigestProvider {
    private readonly _predicate;
    private readonly _object;
    private readonly _digest;
    /**
     * Creates a new assertion and calculates its digest.
     *
     * This constructor takes a predicate and object, both of which are
     * converted to envelopes using the `ToEnvelope` trait. It then
     * calculates the assertion's digest by combining the digests of the
     * predicate and object.
     *
     * The digest is calculated according to the Gordian Envelope
     * specification, which ensures that semantically equivalent assertions
     * always produce the same digest.
     *
     * @param predicate - The predicate of the assertion, which states what is
     *   being asserted
     * @param object - The object of the assertion, which provides the assertion's
     *   value
     *
     * @returns A new assertion with the specified predicate, object, and calculated
     * digest.
     *
     * @example
     * ```typescript
     * // Direct method - create an assertion envelope
     * const assertionEnvelope = Envelope.assertion("name", "Alice");
     *
     * // Or create and add an assertion to a subject
     * const person = Envelope.from("person").addAssertion("name", "Alice");
     * ```
     */
    constructor(predicate: ToEnvelope | Envelope, object: ToEnvelope | Envelope);
    /**
     * Returns the predicate of the assertion.
     *
     * The predicate states what is being asserted about the subject. It is
     * typically a string or known value, but can be any envelope.
     *
     * @returns A clone of the assertion's predicate envelope.
     */
    predicate(): Envelope;
    /**
     * Returns the object of the assertion.
     *
     * The object provides the value or content of the assertion. It can be any
     * type that can be represented as an envelope.
     *
     * @returns A clone of the assertion's object envelope.
     */
    object(): Envelope;
    /**
     * Returns the digest of this assertion.
     *
     *
     * @returns The assertion's digest
     */
    digest(): Digest;
    /**
     * Checks if two assertions are equal based on digest equality.
     *
     * Two assertions are considered equal if they have the same digest,
     * regardless of how they were constructed.
     *
     * @param other - The other assertion to compare with
     * @returns `true` if the assertions are equal, `false` otherwise
     */
    equals(other: Assertion): boolean;
    /**
     * Converts this assertion to CBOR.
     *
     * The CBOR representation of an assertion is a map with a single key-value
     * pair, where the key is the predicate's CBOR and the value is the object's
     * CBOR.
     *
     * @returns A CBOR representation of this assertion
     */
    toCbor(): Cbor;
    /**
     * Attempts to create an assertion from a CBOR value.
     *
     * The CBOR must be a map with exactly one entry, where the key represents
     * the predicate and the value represents the object.
     *
     * @param cbor - The CBOR value to convert
     * @returns A new Assertion instance
     * @throws {EnvelopeError} If the CBOR is not a valid assertion
     */
    static fromCbor(cbor: Cbor): Assertion;
    /**
     * Attempts to create an assertion from a CBOR map.
     *
     * The map must have exactly one entry, where the key represents the
     * predicate and the value represents the object. This is used in
     * the deserialization process.
     *
     * @param map - The CBOR map to convert
     * @returns A new Assertion instance
     * @throws {EnvelopeError} If the map doesn't have exactly one entry
     */
    static fromCborMap(map: CborMap): Assertion;
    /**
     * Creates a string representation of this assertion for debugging.
     *
     * @returns A string representation
     */
    toString(): string;
}

/**
 * Creates a new attachment envelope.
 */
export declare function attachment(payload: EnvelopeInput, vendor: string, conformsTo?: string): Envelope;

/**
 * Returns the conformsTo of an attachment envelope.
 *
 * @throws EnvelopeError with code `General`.
 */
export declare function attachmentConformsTo(envelope: Envelope): string | undefined;

/** Which attachments `attachments` and `expectAttachment` select. */
export declare interface AttachmentFilter {
    /** Only attachments from this vendor. */
    vendor?: string;
    /** Only attachments whose `conformsTo` equals this. */
    conformsTo?: string;
}

/**
 * Returns the payload of an attachment envelope.
 *
 * @throws EnvelopeError with code `General`.
 */
export declare function attachmentPayload(envelope: Envelope): Envelope;

/**
 * A container for vendor-specific metadata attachments.
 *
 * Attachments provides a flexible mechanism for attaching arbitrary metadata
 * to envelopes without modifying their core structure.
 */
export declare class Attachments {
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
    add(payload: EnvelopeInput, vendor: string, conformsTo?: string): void;
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
    /** How many attachments are stored. */
    get size(): number;
    /** The stored attachment envelopes. */
    [Symbol.iterator](): IterableIterator<Envelope>;
    /**
     * Check equality with another Attachments container.
     */
    equals(other: Attachments): boolean;
    /**
     * Adds all attachments from this container to an envelope, each stored
     * `'attachment'` assertion as it is (they are assertion envelopes already).
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

/**
 * The envelope's `attachment` assertions, optionally only those matching
 * `filter`; read each with `attachmentPayload`, `attachmentVendor` and
 * `attachmentConformsTo`.
 */
export declare function attachments(envelope: Envelope, filter?: AttachmentFilter): Envelope[];

/**
 * Returns the vendor of an attachment envelope.
 *
 * @throws EnvelopeError with code `General`.
 */
export declare function attachmentVendor(envelope: Envelope): string;

/** Well-known parameter `_` (1). */
export declare const BLANK: Parameter;

/** Type for CBOR decoder functions */
export declare type CborDecoder<T> = (cbor: Cbor) => T;

/**
 * Decrypts the envelope's subject using the recipient's private key.
 *
 * This method:
 * 1. Finds all `hasRecipient` assertions
 * 2. Tries to decrypt each sealed message until one succeeds
 * 3. Uses the recovered content key to decrypt the subject
 *
 * @param recipient - The recipient's private key (implements Decrypter)
 * @returns A new envelope with decrypted subject
 *
 * @throws EnvelopeError with code `General`.
 */
export declare function decryptSubjectToRecipient(envelope: Envelope, recipient: Decrypter): Envelope;

/**
 * Decrypts an envelope that was encrypted to a recipient and unwraps it.
 *
 * This is a convenience method that:
 * 1. Decrypts the subject using the recipient's private key
 * 2. Unwraps the resulting envelope
 *
 * @param recipient - The recipient's private key (implements Decrypter)
 * @returns The unwrapped, decrypted envelope
 */
export declare function decryptToRecipient(envelope: Envelope, recipient: Decrypter): Envelope;

/** The envelope's CBOR in diagnostic notation. */
export declare function diagnostic(envelope: Envelope, { annotate, context }?: DiagnosticOptions): string;

/** Options for `diagnostic`. */
export declare interface DiagnosticOptions {
    /** Comment each item with its tag name and summary (off by default). */
    annotate?: boolean;
    /** Names for tags; the global context by default. */
    context?: FormatContextOpt;
}

/**
 * Specifies the format for displaying envelope digests in tree output.
 *
 */
export declare const DigestDisplayFormat: {
    /**
     * Short format: hex-encoded first 4 bytes of the digest (8 chars),
     * matching the reference `Digest::short_description`.
     * This is the default format.
     */
    readonly Short: "short";
    /**
     * Full format: complete 64 hex character digest.
     */
    readonly Full: "full";
    /**
     * UR format: digest encoded as a UR string.
     */
    readonly UR: "ur";
};

/** One of the `DigestDisplayFormat` values. */
export declare type DigestDisplayFormat = (typeof DigestDisplayFormat)[keyof typeof DigestDisplayFormat];

/**
 * Trait for types that can provide a digest.
 *
 * This is equivalent to the reference's `DigestProvider` trait. Types that
 * implement this interface can be used in contexts where a digest
 * is needed for identity or integrity verification.
 */
export declare interface DigestProvider {
    /**
     * Returns the digest of this object.
     *
     * The digest uniquely identifies the semantic content of the object,
     * regardless of whether parts of it are elided, encrypted, or compressed.
     */
    digest(): Digest;
}

/** Well-known function `div` ({@link FUNCTION_IDS}.DIV). */
export declare const DIV: Function_2;

/** Creates a division expression: lhs / rhs */
export declare function div(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

/**
 * A type that carries edges (the reference's `Edgeable` trait); XID
 * documents implement it.
 */
export declare interface Edgeable {
    /** The edges container. */
    edges(): Edges;
    /** The edges container, for mutation. */
    edgesMut(): Edges;
    /** Adds a pre-constructed edge envelope. */
    addEdge(edgeEnvelope: Envelope): void;
    /** The edge with `digest`, or `undefined`. */
    getEdge(digest: Digest): Envelope | undefined;
    /** Removes and returns the edge with `digest`, or `undefined`. */
    removeEdge(digest: Digest): Envelope | undefined;
    /** Removes every edge. */
    clearEdges(): void;
    /** `true` when there is at least one edge. */
    hasEdges(): boolean;
}

/** Which edges `edgesMatching` selects; every given field must match (by digest). */
export declare interface EdgeFilter {
    /** Only edges whose `'isA'` is equivalent to this. */
    isA?: Envelope;
    /** Only edges whose `'source'` is equivalent to this. */
    source?: Envelope;
    /** Only edges whose `'target'` is equivalent to this. */
    target?: Envelope;
    /** Only edges whose subject is equivalent to this. */
    subject?: Envelope;
}

/**
 * Extracts the `'isA'` assertion object from an edge envelope.
 *
 */
export declare function edgeIsA(envelope: Envelope): Envelope;

/**
 * Returns a short text label for the edge type, or undefined if no label is
 * needed.
 *
 * This is primarily used for tree formatting to identify relationships
 * between elements.
 *
 * @param edgeType - The edge type
 * @returns A short label or undefined
 */
export declare function edgeLabel(edgeType: EdgeType): string | undefined;

/**
 * A container for edge envelopes on a document.
 *
 * `Edges` stores pre-constructed edge envelopes keyed by their digest,
 * mirroring the `Attachments` container but for edges as defined in
 * BCR-2026-003.
 *
 */
export declare class Edges {
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
    /** How many edges are stored. */
    get size(): number;
    /** The stored edge envelopes. */
    [Symbol.iterator](): IterableIterator<Envelope>;
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
     * @param envelope - The envelope to extract edges from
     * @returns A new Edges container with the envelope's edges
     */
    static fromEnvelope(envelope: Envelope): Edges;
}

/**
 * Returns all edge object envelopes (assertions with predicate `'edge'`).
 *
 */
export declare function edges(envelope: Envelope): Envelope[];

/**
 * The edges matching every field of `filter` (all of them when it is empty).
 *
 * @param filter - The `'isA'`, `'source'`, `'target'` and subject to match
 * @returns Array of matching edge envelopes
 */
export declare function edgesMatching(envelope: Envelope, filter?: EdgeFilter): Envelope[];

/**
 * Extracts the `'source'` assertion object from an edge envelope.
 *
 */
export declare function edgeSource(envelope: Envelope): Envelope;

/**
 * Extracts the edge's subject identifier (the inner envelope's subject).
 *
 */
export declare function edgeSubject(envelope: Envelope): Envelope;

/**
 * Extracts the `'target'` assertion object from an edge envelope.
 *
 */
export declare function edgeTarget(envelope: Envelope): Envelope;

/**
 * The type of incoming edge provided to the visitor.
 *
 * This enum identifies how an envelope element is connected to its parent in
 * the hierarchy during traversal. It helps the visitor function understand the
 * semantic relationship between elements.
 */
export declare const EdgeType: {
    /** No incoming edge (root) */
    readonly None: "none";
    /** Element is the subject of a node */
    readonly Subject: "subject";
    /** Element is an assertion on a node */
    readonly Assertion: "assertion";
    /** Element is the predicate of an assertion */
    readonly Predicate: "predicate";
    /** Element is the object of an assertion */
    readonly Object: "object";
    /** Element is the content wrapped by another envelope */
    readonly Content: "content";
};

/** One of the `EdgeType` values. */
export declare type EdgeType = (typeof EdgeType)[keyof typeof EdgeType];

/** Options for `Envelope.elide`. */
export declare interface ElideOptions {
    /** Obscure these elements (by digest). */
    removing?: Iterable<DigestProvider | Digest>;
    /** Obscure everything except these elements and their ancestors. */
    revealing?: Iterable<DigestProvider | Digest>;
    /** What to do to the targeted elements; `"elide"` by default. */
    action?: ObscureAction;
}

/** Options for `Envelope.encryptSubject` and `encrypt`. */
export declare interface EncryptOptions extends RngOptions {
    /** Use exactly this nonce (12 bytes); tests and vectors only — never reuse one with a key. */
    nonce?: Nonce | undefined;
}

/**
 * Encrypts the envelope's subject and adds a recipient assertion.
 *
 * This is a convenience method that:
 * 1. Generates a random content key
 * 2. Encrypts the subject with the content key
 * 3. Adds a recipient assertion with the sealed content key
 *
 * @param recipient - The recipient's public key (implements Encrypter)
 * @returns A new envelope with encrypted subject and recipient assertion
 *
 * @throws EnvelopeError with code `General`.
 */
export declare function encryptSubjectToRecipient(envelope: Envelope, recipient: Encrypter, options?: RngOptions): Envelope;

/**
 * Encrypts the envelope's subject and adds recipient assertions for multiple recipients.
 *
 * @param recipients - Array of recipient public keys (each implements Encrypter)
 * @returns A new envelope with encrypted subject and recipient assertions
 *
 * @throws EnvelopeError with code `General`.
 */
export declare function encryptSubjectToRecipients(envelope: Envelope, recipients: Encrypter[], options?: RngOptions): Envelope;

/** Wraps the envelope and encrypts the wrapper's subject to `recipient`. */
export declare function encryptToRecipient(envelope: Envelope, recipient: Encrypter, options?: RngOptions): Envelope;

/**
 * Wraps and encrypts an envelope to multiple recipients.
 *
 * @param recipients - Array of recipient public keys (each implements Encrypter)
 * @returns A wrapped and encrypted envelope
 */
export declare function encryptToRecipients(envelope: Envelope, recipients: Encrypter[], options?: RngOptions): Envelope;

/**
 * A flexible container for structured data with built-in integrity
 * verification.
 *
 * Gordian Envelope is the primary data structure of this library. It provides a
 * way to encapsulate and organize data with cryptographic integrity, privacy
 * features, and selective disclosure capabilities.
 *
 * Key characteristics of envelopes:
 *
 * - **Immutability**: Envelopes are immutable. Operations that appear to
 *   "modify" an envelope actually create a new envelope. This immutability is
 *   fundamental to maintaining the integrity of the envelope's digest tree.
 *
 * - **Efficient Cloning**: Envelopes use shallow copying for efficient O(1)
 *   cloning. Since they're immutable, clones share the same underlying data.
 *
 * - **Semantic Structure**: Envelopes can represent various semantic
 *   relationships through subjects, predicates, and objects (similar to RDF
 *   triples).
 *
 * - **Digest Tree**: Each envelope maintains a Merkle-like digest tree that
 *   ensures the integrity of its contents and enables verification of
 *   individual parts.
 *
 * - **Privacy Features**: Envelopes support selective disclosure through
 *   elision, encryption, and compression of specific parts, while maintaining
 *   the overall integrity of the structure.
 *
 * - **Deterministic Representation**: Envelopes use deterministic CBOR
 *   encoding to ensure consistent serialization across platforms.
 *
 * The Gordian Envelope specification is defined in an IETF Internet Draft, and
 * this implementation closely follows that specification.
 *
 * @example
 * ```typescript
 * // Create an envelope representing a person
 * const person = Envelope.from("person")
 *     .addAssertion("name", "Alice")
 *     .addAssertion("age", 30)
 *     .addAssertion("email", "alice@example.com");
 *
 * // Create a partially redacted version by eliding the email
 * const redacted = person.elide({ removing: [///     person.assertionWithPredicate("email")
 * ] });
 *
 * // The digest of both envelopes remains the same
 * assert(person.digest().equals(redacted.digest()));
 * ```
 */
export declare class Envelope implements DigestProvider {
    private readonly _case;
    /**
     * Private constructor. Use static factory methods to create envelopes.
     *
     * @param envelopeCase - The envelope case variant
     */
    private constructor();
    /**
     * Returns a reference to the underlying envelope case.
     *
     * The `EnvelopeCase` enum represents the specific structural variant of
     * this envelope. This method provides access to that underlying
     * variant for operations that need to differentiate between the
     * different envelope types.
     *
     * @returns The `EnvelopeCase` that defines this envelope's structure.
     */
    get case(): EnvelopeCase;
    /**
     * Creates an envelope with a subject, which can be any value that
     * can be encoded as an envelope.
     *
     * @param subject - The subject value
     * @returns A new envelope containing the subject
     *
     * @example
     * ```typescript
     * const envelope = Envelope.from("Hello, world!");
     * const numberEnvelope = Envelope.from(42);
     * const binaryEnvelope = Envelope.from(new Uint8Array([1, 2, 3]));
     * ```
     */
    static from(subject: EnvelopeInput): Envelope;
    /**
     * Creates an envelope with a subject, or `undefined` if the subject is
     * **absent** (`undefined` *or* JS `null`).
     *
     * **port ↔ reference note**: the reference `Envelope::new_or_none` returns
     * `Option<Envelope>` — the `None` branch fires only on `None`. We
     * follow the same convention as `Envelope.from(x ?? null)` and treat
     * JS `null` and `undefined` interchangeably as the absent case.
     *
     * @param subject - The optional subject value (`undefined` *or* `null`
     *   triggers the absent branch).
     * @returns A new envelope or `undefined`
     */
    static fromOptional(subject: EnvelopeInput | undefined): Envelope | undefined;
    /**
     * Creates an envelope from an EnvelopeCase.
     *
     * This is an internal method used by extensions to create envelopes
     * from custom case types like compressed or encrypted.
     *
     * @param envelopeCase - The envelope case to wrap
     * @returns A new envelope with the given case
     */
    static fromCase(envelopeCase: EnvelopeCase): Envelope;
    /**
     * Creates an assertion envelope with a predicate and object.
     *
     * @param predicate - The predicate of the assertion
     * @param object - The object of the assertion
     * @returns A new assertion envelope
     *
     * @example
     * ```typescript
     * const assertion = Envelope.assertion("name", "Alice");
     * ```
     */
    static assertion(predicate: EnvelopeInput, object: EnvelopeInput): Envelope;
    /**
     * Creates a null envelope (containing CBOR null).
     *
     * @returns A null envelope
     */
    static get NULL(): Envelope;
    /**
     * Creates an envelope with a subject and unchecked assertions.
     *
     * The assertions are sorted by digest and the envelope's digest is calculated.
     *
     * @param subject - The subject envelope
     * @param uncheckedAssertions - The assertions to attach
     * @returns A new node envelope
     */
    private static nodeUnchecked;
    /**
     * Creates an envelope with a subject and validated assertions.
     *
     * All assertions must be assertion or obscured envelopes.
     *
     * @param subject - The subject envelope
     * @param assertions - The assertions to attach
     * @returns A new node envelope
     * @throws {EnvelopeError} If any assertion is not valid
     */
    static node(subject: Envelope, assertions: readonly Envelope[], { unchecked }?: {
        unchecked?: boolean;
    }): Envelope;
    /**
     * Creates an envelope with an assertion as its subject.
     *
     * @param assertion - The assertion
     * @returns A new assertion envelope
     */
    static fromAssertion(assertion: Assertion): Envelope;
    /**
     * Creates an envelope with a known value.
     *
     * @param value - The known value (can be a KnownValue instance or a number/bigint)
     * @returns A new known value envelope
     */
    static knownValue(value: KnownValue | number | bigint): Envelope;
    /**
     * Creates an envelope with encrypted content.
     *
     * `Err(Error::MissingDigest)` when the message has no AAD digest.
     *
     * @param encryptedMessage - The encrypted message
     * @returns A new encrypted envelope
     * @throws {EnvelopeError} If the encrypted message doesn't have a digest
     */
    static encrypted(encryptedMessage: EncryptedMessage): Envelope;
    /**
     * Creates an envelope with compressed content.
     *
     * `Err(Error::MissingDigest)` when the compressed value has no digest.
     *
     * @param compressed - The compressed data
     * @returns A new compressed envelope
     * @throws {EnvelopeError} If the compressed data doesn't have a digest
     */
    static compressed(compressed: Compressed): Envelope;
    /**
     * Creates an elided envelope containing only a digest.
     *
     * @param digest - The digest of the elided content
     * @returns A new elided envelope
     */
    static elided(digest: Digest): Envelope;
    /**
     * Creates a leaf envelope containing a CBOR value.
     *
     * @param value - The value to encode as CBOR
     * @returns A new leaf envelope
     */
    static leaf(value: unknown): Envelope;
    /**
     * Creates a wrapped envelope.
     *
     * @param subject - The envelope (or value) to wrap
     * @returns A new wrapped envelope
     */
    static wrap(subject: EnvelopeInput): Envelope;
    /**
     * Returns the digest of this envelope.
     *
     *
     * @returns The envelope's digest
     */
    digest(): Digest;
    /**
     * Returns the subject of this envelope.
     *
     * For different envelope cases:
     * - Node: Returns the subject envelope
     * - Other cases: Returns the envelope itself
     *
     * @returns The subject envelope
     */
    subject(): Envelope;
    /**
     * Checks if the envelope's subject is an assertion.
     *
     * @returns `true` if the subject is an assertion, `false` otherwise
     */
    isSubjectAssertion(): boolean;
    /**
     * Checks if the envelope's subject is obscured (elided, encrypted, or compressed).
     *
     * @returns `true` if the subject is obscured, `false` otherwise
     */
    isSubjectObscured(): boolean;
    /**
     * Converts a value to CBOR.
     *
     * @param value - The value to convert
     * @returns A CBOR representation
     */
    private static valueToCbor;
    /**
     * Converts CBOR to bytes.
     *
     * @param cbor - The CBOR value
     * @returns Byte representation
     */
    private static cborToBytes;
    /**
     * Returns the untagged CBOR representation of this envelope.
     *
     * @returns The untagged CBOR
     */
    untaggedCbor(): Cbor;
    /**
     * Returns the tagged CBOR representation of this envelope.
     *
     * All envelopes are tagged with TAG_ENVELOPE (200).
     *
     * @returns The tagged CBOR
     */
    toCbor(): Cbor;
    /** Tagged-CBOR codec; `decode` also accepts the untagged form. */
    static get codec(): CborCodec<Envelope>;
    /** The envelope tag (200). */
    cborTags(): Tag[];
    /** As `ur:envelope/…`. */
    toUR(): UR;
    /**
     * Decodes an envelope from its tagged CBOR (tag 200).
     *
     * @throws {EnvelopeError} If the CBOR is not a tagged envelope
     */
    static fromCbor(cbor: Cbor): Envelope;
    /**
     * Decodes an envelope from tagged CBOR bytes.
     *
     * @throws {EnvelopeError} If the data is not valid CBOR or not an envelope
     */
    static fromBytes(data: Uint8Array): Envelope;
    /**
     * Creates an envelope from untagged CBOR.
     *
     * Every failure is `Cbor` (the reference decodes through `dcbor`, whose
     * error is what `try_from_cbor_data` returns); the message names the
     * structural fault (`node must have at least two elements`, `assertion
     * must be a map with exactly one element`, …) and `cause` keeps the
     * original.
     *
     * @param cbor - The untagged CBOR value
     * @returns A new envelope
     *
     * @throws EnvelopeError with code `Cbor`.
     */
    static fromUntaggedCbor(cbor: Cbor): Envelope;
    private static decodeUntagged;
    /**
     * Adds an assertion to this envelope.
     *
     * @param predicate - The assertion predicate
     * @param object - The assertion object
     * @returns A new envelope with the assertion added
     *
     * @example
     * ```typescript
     * const person = Envelope.from("Alice")
     *     .addAssertion("age", 30)
     *     .addAssertion("city", "Boston");
     * ```
     */
    addAssertion(predicate: EnvelopeInput, object: EnvelopeInput, options?: AddAssertionOptions): Envelope;
    /**
     * Adds an assertion envelope to this envelope.
     *
     * @param assertion - The assertion envelope
     * @returns A new envelope with the assertion added
     */
    addAssertionEnvelope(assertion: Envelope, { salt }?: AddAssertionOptions): Envelope;
    /**
     * Creates a string representation of this envelope.
     *
     * @returns A string representation
     */
    toString(): string;
    /** The `false` leaf. */
    static get FALSE(): Envelope;
    /** The `true` leaf. */
    static get TRUE(): Envelope;
    /**
     * Unit envelopes have the known value ''. They represent a position
     * where no meaningful data *can* exist. In this sense they make a
     * semantically stronger assertion than `null`, which represents a
     * position where no meaningful data currently exists, but could exist in
     * the future.
     */
    static get UNIT(): Envelope;
    /** Adds every assertion envelope in turn. */
    addAssertionEnvelopes(assertions: Envelope[]): Envelope;
    /**
     * Adds `assertion` when given (deduplicated by digest); this envelope otherwise.
     *
     * @throws EnvelopeError with code `InvalidFormat`.
     */
    addOptionalAssertionEnvelope(assertion: Envelope | undefined, { salt }?: AddAssertionOptions): Envelope;
    /** Adds `predicate: object` when `object` is given; this envelope otherwise. */
    addOptionalAssertion(predicate: EnvelopeInput, object: EnvelopeInput | undefined, options?: AddAssertionOptions): Envelope;
    /**
     * Adds a `salt` assertion of random bytes so that this envelope's digest
     * cannot be correlated with another envelope of the same content.
     *
     * By default the salt length is proportional to the envelope's size
     * (5–25 %, at least 8 bytes); give `length`, a `range`, or the exact
     * `salt` instead. `rng` overrides the secure default.
     *
     * @throws EnvelopeError with code `General`.
     */
    addSalt({ salt, length, range, rng }?: SaltOptions): Envelope;
    /**
     * Applies `fn` to this envelope: `e.pipe(sign, key).pipe(encryptSubject, k)`
     * chains the subpath functions without the `/all` facade.
     */
    pipe<A extends unknown[], R>(fn: (envelope: Envelope, ...args: A) => R, ...args: A): R;
    /** Adds `predicate: text` when `text` is not empty; this envelope otherwise. */
    addNonemptyStringAssertion(predicate: EnvelopeInput, str: string): Envelope;
    /** Adds every assertion envelope in turn. */
    addAssertions(envelopes: Envelope[]): Envelope;
    /** Adds `predicate: object` when `condition` holds; this envelope otherwise. */
    addAssertionIf(condition: boolean, predicate: EnvelopeInput, object: EnvelopeInput): Envelope;
    /** Adds `assertion` when `condition` holds; this envelope otherwise. */
    addAssertionEnvelopeIf(condition: boolean, assertionEnvelope: Envelope): Envelope;
    /** A copy without `assertion` (matched by digest); this envelope when it was not present. */
    removeAssertion(target: Envelope): Envelope;
    /** A copy with `assertion` replaced by `newAssertion`; `NonexistentPredicate` when absent. */
    replaceAssertion(assertion: Envelope, newAssertion: Envelope): Envelope;
    /** A copy with the subject replaced and every assertion kept. */
    replaceSubject(subject: Envelope): Envelope;
    /** The assertions of a node (a frozen array); empty for every other case. */
    assertions(): readonly Envelope[];
    /** `true` when the envelope is the boolean leaf `false`. */
    isFalse(): boolean;
    /** `true` when the envelope is the boolean leaf `true`. */
    isTrue(): boolean;
    /** `true` when the envelope is a boolean leaf. */
    isBool(): boolean;
    /** `true` when the envelope is a number leaf. */
    isNumber(): boolean;
    /** `true` when the envelope is a node whose subject is a number. */
    isSubjectNumber(): boolean;
    /** `true` when the envelope is the `NaN` leaf. */
    isNaN(): boolean;
    /** `true` when the envelope is a node whose subject is `NaN`. */
    isSubjectNaN(): boolean;
    /** `true` when the envelope is the `null` leaf. */
    isNull(): boolean;
    /** A copy of the subject's bytes, or `undefined` when it is not a byte-string leaf. */
    asBytes(): Uint8Array<ArrayBuffer> | undefined;
    /** A copy of the subject's array, or `undefined` when it is not an array leaf. */
    asArray(): readonly Cbor[] | undefined;
    /** A copy of the subject's map, or `undefined` when it is not a map leaf. */
    asMap(): CborMap | undefined;
    /** The subject's text, or `undefined` when it is not a text leaf. */
    asText(): string | undefined;
    /** The subject's CBOR, or `undefined` when it is not a leaf. */
    asLeaf(): Cbor | undefined;
    /** The known value, or `undefined` when the subject is not one. */
    asKnownValue(): KnownValue | undefined;
    /**
     * The known value, or `undefined` when the subject is not one.
     *
     * @throws EnvelopeError with code `NotKnownValue`.
     */
    expectKnownValue(): KnownValue;
    /** `true` when the envelope is a known value. */
    isKnownValue(): boolean;
    /** `true` when the envelope is a node whose subject is the unit known value. */
    isSubjectUnit(): boolean;
    /**
     * Throws `SubjectNotUnit` unless the subject is the unit known value.
     *
     * @throws EnvelopeError with code `SubjectNotUnit`.
     */
    checkSubjectUnit(): Envelope;
    /** `true` when the envelope is a node with at least one assertion. */
    hasAssertions(): boolean;
    /** The assertion, or `undefined` when this envelope is not one. */
    asAssertion(): Envelope | undefined;
    /**
     * The assertion, or `undefined` when this envelope is not one.
     *
     * @throws EnvelopeError with code `NotAssertion`.
     */
    expectAssertion(): Envelope;
    /** The predicate, or `undefined` when this envelope is not an assertion. */
    asPredicate(): Envelope | undefined;
    /**
     * The predicate, or `undefined` when this envelope is not an assertion.
     *
     * @throws EnvelopeError with code `NotAssertion`.
     */
    expectPredicate(): Envelope;
    /** The object, or `undefined` when this envelope is not an assertion. */
    asObject(): Envelope | undefined;
    /**
     * The object, or `undefined` when this envelope is not an assertion.
     *
     * @throws EnvelopeError with code `NotAssertion`.
     */
    expectObject(): Envelope;
    /** `true` when the envelope is an assertion. */
    isAssertion(): boolean;
    /** `true` when the envelope is elided. */
    isElided(): boolean;
    /** `true` when the envelope is a leaf. */
    isLeaf(): boolean;
    /** `true` when the envelope is a node (a subject with assertions). */
    isNode(): boolean;
    /** `true` when the envelope is a wrapped envelope. */
    isWrapped(): boolean;
    /** `true` when the envelope is internal (a node, a wrapped envelope or an assertion, never a leaf or known value). */
    isInternal(): boolean;
    /** `true` when the envelope is obscured (elided, encrypted or compressed). */
    isObscured(): boolean;
    /** Every assertion with `predicate`. */
    assertionsWithPredicate(predicate: EnvelopeInput): Envelope[];
    /**
     * The single assertion with `predicate`; `NonexistentPredicate` / `AmbiguousPredicate` otherwise.
     *
     * @throws EnvelopeError with code `NonexistentPredicate`, `AmbiguousPredicate`.
     */
    assertionWithPredicate(predicate: EnvelopeInput): Envelope;
    /**
     * The single assertion with `predicate`, or `undefined`; `AmbiguousPredicate` when there are several.
     *
     * @throws EnvelopeError with code `AmbiguousPredicate`.
     */
    optionalAssertionWithPredicate(predicate: EnvelopeInput): Envelope | undefined;
    /**
     * The object of the single assertion with `predicate`; `NonexistentPredicate` / `AmbiguousPredicate` otherwise.
     *
     * @throws EnvelopeError with code `NotAssertion`.
     */
    objectForPredicate(predicate: EnvelopeInput): Envelope;
    /**
     * The object of the single assertion with `predicate`, or `undefined`; `AmbiguousPredicate` when there are several.
     *
     * @throws EnvelopeError with code `AmbiguousPredicate`.
     */
    optionalObjectForPredicate(predicate: EnvelopeInput): Envelope | undefined;
    /**
     * The objects of every assertion with `predicate`.
     *
     * @throws EnvelopeError with code `NotAssertion`.
     */
    objectsForPredicate(predicate: EnvelopeInput): Envelope[];
    /** The number of elements in the tree (the subject, the assertions and their parts). */
    elementsCount(): number;
    /** `true` when the envelope is encrypted or a node whose subject is (recursively). */
    isSubjectEncrypted(): boolean;
    /** `true` when the envelope is compressed or a node whose subject is (recursively). */
    isSubjectCompressed(): boolean;
    /** `true` when the envelope is elided or a node whose subject is (recursively). */
    isSubjectElided(): boolean;
    /**
     * Adds a `'position'` assertion with the given ordinal.
     *
     * @throws EnvelopeError with code `InvalidFormat`.
     */
    setPosition(position: number): Envelope;
    /** The value of the `'position'` assertion, or `undefined`. */
    position(): number;
    /**
     * A copy without the `'position'` assertion.
     *
     * @throws EnvelopeError with code `InvalidFormat`.
     */
    removePosition(): Envelope;
    /** Wraps this envelope as the subject of a new one, so assertions can be attached to it as a whole. */
    wrap(): Envelope;
    /**
     * The wrapped envelope, or `undefined` when this envelope is not a wrapper.
     *
     * @throws EnvelopeError with code `NotWrapped`.
     */
    unwrap(): Envelope;
    /** Visits every node of the tree depth-first, threading `state`; `hideNodes` visits only the leaves' structure. */
    walk<State>(hideNodes: boolean, state: State, visit: Visitor<State>): void;
    /**
     * Returns the set of digests in the envelope, down to the specified level.
     *
     * the reference uses `HashSet<Digest>` which dedupes by content; native JS `Set`
     * dedupes by reference, so we route inserts through a hex-keyed `Map`
     * before materialising the final `Set`. That keeps the public signature
     * (`Set<Digest>`) while guaranteeing each *value* appears at most once,
     * which is what every consumer of these methods actually wants.
     */
    digests(levelLimit: number): Set<Digest>;
    /**
     * Returns all digests in the envelope at all levels.
     */
    deepDigests(): Set<Digest>;
    /**
     * Returns the digests in the envelope down to its second level.
     */
    shallowDigests(): Set<Digest>;
    /**
     * structure mode, building an image:
     *
     * - Each obscured case prepends a 1-byte discriminator: `0` for Encrypted,
     * `1` for Elided, `2` for Compressed (matching the the reference order).
     * - Every node — obscured or not — appends its 32-byte digest bytes.
     *
     * The full image is then SHA-256-hashed via `Digest.fromImage`.
     *
     * Unlike {@link Envelope.digest} (which captures *semantic* identity),
     * `structuralDigest` captures the envelope's structural form too, including
     * where elision / encryption / compression has been applied. Two
     * envelopes whose `digest()`s match are semantically equivalent; their
     * `structuralDigest()`s match only if the structures themselves are
     * identical.
     */
    structuralDigest(): Digest;
    /** The object, or `undefined` when this envelope is not an assertion (alias of `tryObject`). */
    object(): Envelope;
    /** The predicate, or `undefined` when this envelope is not an assertion (alias of `tryPredicate`). */
    predicate(): Envelope;
    /**
     * Elide this envelope, or with options elide (or encrypt or compress)
     * parts of it: `removing` obscures the elements whose digests are listed,
     * `revealing` obscures everything but the listed elements and their
     * ancestors. `action` defaults to `"elide"`.
     */
    elide(options?: ElideOptions): Envelope;
    /** The whole envelope elided to its digest. */
    private elideAll;
    /** Elides everything whose digest is in `target`, with `action` (elide, compress or encrypt). */
    private elideRemovingWith;
    /** Elides everything whose digest is not in `target` (revealing mode) with `action`. */
    elideSetWithAction(target: Set<Digest>, action: ObscureAction): Envelope;
    /** Elides everything whose digest is not in `target`, with `action` (elide, compress or encrypt). */
    private elideRevealingWith;
    /**
     * Restores this envelope from `revealed` when their digests match; otherwise returns this envelope.
     *
     * @throws EnvelopeError with code `InvalidDigest`.
     */
    unelide(envelope: Envelope): Envelope;
    /**
     * `Set<Digest>` for backward compatibility with callers, but the
     * underlying dedup is by **hex content** (via a hex-keyed Map) so two
     * `Digest` instances that represent the same hash bytes count once,
     * matching the reference's `HashSet<Digest>` semantics.
     */
    nodesMatching(targetDigests: Set<Digest> | undefined, obscureTypes: ObscureType[]): Set<Digest>;
    /** Restores every elided part whose original is in `revealed`, by digest. */
    walkUnelide(envelopes: Envelope[]): Envelope;
    /** Replaces every part whose digest is in `replacements` with the given envelope. */
    walkReplace(target: Set<Digest>, replacement: Envelope): Envelope;
    /**
     * Two envelopes are equivalent if they have the same digest (semantic equivalence).
     * This is a weaker comparison than `isIdenticalTo` which also checks the case type.
     *
     */
    isEquivalentTo(other: Envelope): boolean;
    /**
     * short-circuit on a *semantic* mismatch (different `digest()`), then fall
     * through to a {@link Envelope.structuralDigest} comparison. Two envelopes
     * whose digests match but whose structures differ — e.g. an envelope and a
     * version of it with one assertion elided — are **not** identical.
     */
    isIdenticalTo(other: Envelope): boolean;
    /**
     * Recursively walks the envelope and decrypts every encrypted node it
     * can. For an Encrypted node, each provided key is tried in order; the
     * first one that successfully decrypts wins, and the recursion continues
     * into the result so chains of nested encryption peel off one layer per
     * matching key. Nodes whose decryption fails for every key are returned
     * unchanged — matching the reference's `if let Ok(decrypted) = ...` pattern.
     *
     * Structural sharing: if a recursion produces an envelope that is
     * {@link Envelope.isIdenticalTo} the original, the original instance is
     * reused instead of allocating a new node.
     */
    walkDecrypt(keys: SymmetricKey[]): Envelope;
    /**
     * Recursively walks the envelope and decompresses any compressed node
     * whose digest is in `targetDigests` (or every compressed node if
     * `targetDigests` is undefined). Decompression failures are tolerated —
     * the original node is returned in that case, mirroring the reference's
     * `if let Ok(decompressed) = ...` pattern.
     */
    walkDecompress(targetDigests?: Set<Digest>): Envelope;
    /**
     * Add the tryLeaf method to Envelope prototype.
     *
     * This extracts the leaf CBOR value from an envelope.
     *
     * @throws EnvelopeError with code `NotLeaf`.
     */
    expectLeaf(): Cbor;
    /** The subject's text; `NotLeaf` / `Cbor` when it is not a text leaf. */
    expectString(): string;
    /** The subject's number; `NotLeaf` / `Cbor` when it is not a number leaf. */
    expectNumber(): number;
    /** The subject's boolean; `NotLeaf` / `Cbor` when it is not a boolean leaf. */
    expectBoolean(): boolean;
    /** A copy of the subject's bytes; `NotLeaf` / `Cbor` when it is not a byte-string leaf. */
    expectBytes(): Uint8Array<ArrayBuffer>;
    /** `null`; `NotLeaf` / `Cbor` when the subject is not the `null` leaf. */
    expectNull(): null;
    /** The subject's tag-1 date as a `Date`; `NotLeaf` / `Cbor` when it is not a date leaf. */
    expectDate(): Date;
    /** `extractSubject` as a method. */
    expectSubject<T>(decoder: CborDecoder<T>): T;
    /**
     * Add tryObjectForPredicate method to Envelope prototype
     */
    expectObjectForPredicate<T>(predicate: EnvelopeInput, decoder: CborDecoder<T>): T;
    /**
     * Add tryOptionalObjectForPredicate method to Envelope prototype
     */
    optionalObjectForPredicateAs<T>(predicate: EnvelopeInput, decoder: CborDecoder<T>): T | undefined;
    /** `extractObjectForPredicateWithDefault` as a method. */
    objectForPredicateOr<T>(predicate: EnvelopeInput, decoder: CborDecoder<T>, defaultValue: T): T;
    /** `extractObjectsForPredicate` as a method. */
    expectObjectsForPredicate<T>(predicate: EnvelopeInput, decoder: CborDecoder<T>): T[];
    /**
     * A copy with the subject encrypted by `key` (ChaCha20-Poly1305 over the
     * subject's CBOR, the digest as AAD); `AlreadyEncrypted` / `AlreadyElided`
     * when it cannot be.
     *
     * @throws EnvelopeError with code `General`.
     */
    encryptSubject(key: SymmetricKey, options?: EncryptOptions): Envelope;
    /**
     * A copy with the subject decrypted by `key`; `NotEncrypted` / `Components` on failure.
     *
     * @throws EnvelopeError with code `General`.
     */
    decryptSubject(key: SymmetricKey): Envelope;
    /** Wraps this envelope and encrypts the wrapper's subject, so the whole envelope is hidden. */
    encrypt(key: SymmetricKey, options?: EncryptOptions): Envelope;
    /** Decrypts a subject encrypted with `encrypt` and unwraps it. */
    decrypt(key: SymmetricKey): Envelope;
    /** `true` when the envelope is encrypted. */
    isEncrypted(): boolean;
    /**
     * A copy compressed (deflate over its CBOR); this envelope when already compressed.
     *
     * @throws EnvelopeError with code `General`.
     */
    compress(): Envelope;
    /**
     * A copy decompressed; this envelope when it is not compressed.
     *
     * @throws EnvelopeError with code `General`.
     */
    decompress(): Envelope;
    /** A copy with the subject compressed; `AlreadyEncrypted` / `AlreadyElided` when it cannot be. */
    compressSubject(): Envelope;
    /** A copy with the subject decompressed; `NotCompressed` when it is not. */
    decompressSubject(): Envelope;
    /** `true` when the envelope is compressed. */
    isCompressed(): boolean;
}

/**
 * The core structural variants of a Gordian Envelope.
 *
 * Each variant represents a different structural form that an
 * envelope can take, as defined in the Gordian Envelope IETF Internet Draft.
 * The different cases provide different capabilities and serve different
 * purposes in the envelope ecosystem.
 *
 * The `EnvelopeCase` is the internal representation of an envelope's
 * structure. While each case has unique properties, they all maintain a digest
 * that ensures the integrity of the envelope.
 *
 * It is advised to use the other Envelope APIs for most uses. Please see the
 * queries module for more information on how to interact with envelopes.
 */
export declare type EnvelopeCase = {
    /** Discriminant. */
    type: "node";
    /** The subject of the node */
    subject: Envelope;
    /** The assertions attached to the subject (frozen; sorted by digest) */
    assertions: readonly Envelope[];
    /** The digest of the node */
    digest: Digest;
} | {
    /** Discriminant. */
    type: "leaf";
    /** The CBOR value contained in the leaf */
    cbor: Cbor;
    /** The digest of the leaf */
    digest: Digest;
} | {
    /** Discriminant. */
    type: "wrapped";
    /** The envelope being wrapped */
    envelope: Envelope;
    /** The digest of the wrapped envelope */
    digest: Digest;
} | {
    /** Discriminant. */
    type: "assertion";
    /** The assertion */
    assertion: Assertion;
} | {
    /** Discriminant. */
    type: "elided";
    /** The digest of the elided content */
    digest: Digest;
} | {
    /** Discriminant. */
    type: "knownValue";
    /** The known value instance */
    value: KnownValue;
    /** The digest of the known value */
    digest: Digest;
} | {
    /** Discriminant. */
    type: "encrypted";
    /** The encrypted message */
    message: EncryptedMessage;
} | {
    /** Discriminant. */
    type: "compressed";
    /** The compressed data */
    value: Compressed;
};

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
export declare class EnvelopeError extends Error {
    /** Always `"EnvelopeError"`; what `isEnvelopeError` checks across module graphs. */
    override readonly name = "EnvelopeError";
    /** Which condition was raised. */
    readonly code: EnvelopeErrorCode;
    /** Structured information, discriminated by `code`. */
    readonly details: EnvelopeErrorDetails;
    /** The lower-layer error this one wraps, when any. */
    readonly cause?: Error;
    private constructor();
    /** `true` when `value` is an `EnvelopeError` (across module graphs). */
    static isEnvelopeError(value: unknown): value is EnvelopeError;
    /** `true` when this error carries `code`. */
    is(code: EnvelopeErrorCode): boolean;
    /** An error with `code` and `message` (the `details` are `{ code, message }`). */
    private static make;
    /**
     * Returned when attempting to compress or encrypt an envelope that has
     * already been elided.
     *
     * This error occurs because an elided envelope only contains a digest
     * reference and no longer has a subject that can be compressed or
     * encrypted.
     */
    static alreadyElided(): EnvelopeError;
    /**
     * Returned when attempting to retrieve an assertion by predicate, but
     * multiple matching assertions exist.
     *
     * For queries that expect a single result (like `objectForPredicate`),
     * having multiple matching assertions is ambiguous and requires more
     * specific targeting.
     */
    static ambiguousPredicate(): EnvelopeError;
    /**
     * Returned when a digest validation fails.
     *
     * This can occur when unwrapping an envelope, verifying signatures, or
     * other operations that rely on the integrity of envelope digests.
     */
    static invalidDigest(): EnvelopeError;
    /**
     * Returned when an envelope's format is invalid.
     *
     * This typically occurs during parsing or decoding of an envelope from
     * CBOR.
     */
    static invalidFormat(): EnvelopeError;
    /**
     * Returned when a digest is expected but not found.
     *
     * This can occur when working with envelope structures that require digest
     * information, such as when working with elided envelopes.
     */
    static missingDigest(): EnvelopeError;
    /**
     * Returned when attempting to retrieve an assertion by predicate, but no
     * matching assertion exists.
     *
     * This error occurs with functions like `objectForPredicate` when the
     * specified predicate doesn't match any assertion in the envelope.
     */
    static nonexistentPredicate(): EnvelopeError;
    /**
     * Returned when attempting to unwrap an envelope that wasn't wrapped.
     *
     * This error occurs when calling `Envelope.tryUnwrap` on an
     * envelope that doesn't have the wrapped format.
     */
    static notWrapped(): EnvelopeError;
    /**
     * Returned when expecting an envelope's subject to be a leaf, but it
     * isn't.
     *
     * This error occurs when calling methods that require access to a leaf
     * value but the envelope's subject is an assertion, node, or elided.
     */
    static notLeaf(): EnvelopeError;
    /**
     * Returned when expecting an envelope's subject to be an assertion, but it
     * isn't.
     *
     * This error occurs when calling methods that require an assertion
     * structure but the envelope's subject has a different format.
     */
    static notAssertion(): EnvelopeError;
    /** Returned when assertion is invalid */
    static invalidAssertion(): EnvelopeError;
    /**
     * Returned when an attachment's format is invalid.
     *
     * This error occurs when an envelope contains an attachment with an
     * invalid structure according to the Envelope Attachment specification
     * (BCR-2023-006).
     */
    static invalidAttachment(message?: string): EnvelopeError;
    /**
     * Returned when an attachment is requested but does not exist.
     *
     * This error occurs when attempting to retrieve an attachment by ID that
     * doesn't exist in the envelope.
     */
    static nonexistentAttachment(): EnvelopeError;
    /**
     * Returned when multiple attachments match a single query.
     *
     * This error occurs when multiple attachments have the same ID, making
     * it ambiguous which attachment should be returned.
     */
    static ambiguousAttachment(): EnvelopeError;
    /** Returned when an edge is missing the required `'isA'` assertion. */
    static edgeMissingIsA(): EnvelopeError;
    /** Returned when an edge is missing the required `'source'` assertion. */
    static edgeMissingSource(): EnvelopeError;
    /** Returned when an edge is missing the required `'target'` assertion. */
    static edgeMissingTarget(): EnvelopeError;
    /** Returned when an edge has duplicate `'isA'` assertions. */
    static edgeDuplicateIsA(): EnvelopeError;
    /** Returned when an edge has duplicate `'source'` assertions. */
    static edgeDuplicateSource(): EnvelopeError;
    /** Returned when an edge has duplicate `'target'` assertions. */
    static edgeDuplicateTarget(): EnvelopeError;
    /** Returned when an edge has an unexpected assertion (per BCR-2026-003). */
    static edgeUnexpectedAssertion(): EnvelopeError;
    /** Returned when an edge is requested but does not exist. */
    static nonexistentEdge(): EnvelopeError;
    /** Returned when multiple edges match a single query. */
    static ambiguousEdge(): EnvelopeError;
    /**
     * Returned when attempting to compress an envelope that is already
     * compressed.
     *
     * This error occurs when calling compression functions on an envelope that
     * already has compressed content, as defined in BCR-2023-005.
     */
    static alreadyCompressed(): EnvelopeError;
    /**
     * Returned when attempting to decompress an envelope that is not
     * compressed.
     *
     * This error occurs when calling decompression functions on an envelope
     * that doesn't contain compressed content.
     */
    static notCompressed(): EnvelopeError;
    /**
     * Returned when attempting to encrypt an envelope that is already
     * encrypted or compressed.
     *
     * This error occurs to prevent multiple layers of encryption or encryption
     * of compressed data, which could reduce security, as defined in
     * BCR-2023-004.
     */
    static alreadyEncrypted(): EnvelopeError;
    /**
     * Returned when attempting to decrypt an envelope that is not encrypted.
     *
     * This error occurs when calling decryption functions on an envelope that
     * doesn't contain encrypted content.
     */
    static notEncrypted(): EnvelopeError;
    /**
     * Returned when expecting an envelope's subject to be a known value, but
     * it isn't.
     *
     * This error occurs when calling methods that require a known value (as
     * defined in BCR-2023-003) but the envelope's subject is a different
     * type.
     */
    static notKnownValue(): EnvelopeError;
    /**
     * Returned when attempting to decrypt an envelope with a recipient that
     * doesn't match.
     *
     * This error occurs when trying to use a private key to decrypt an
     * envelope that wasn't encrypted for the corresponding public key.
     */
    static unknownRecipient(): EnvelopeError;
    /**
     * Returned when attempting to decrypt an envelope with a secret that
     * doesn't match.
     *
     * This error occurs when trying to use a secret that does not correspond
     * to the expected recipient, preventing successful decryption.
     */
    static unknownSecret(): EnvelopeError;
    /**
     * Returned when a signature verification fails.
     *
     * This error occurs when a signature does not validate against its
     * purported public key.
     */
    static unverifiedSignature(): EnvelopeError;
    /** Returned when the outer signature object type is not `Signature`. */
    static invalidOuterSignatureType(): EnvelopeError;
    /** Returned when the inner signature object type is not `Signature`. */
    static invalidInnerSignatureType(): EnvelopeError;
    /**
     * Returned when the inner signature is not made with the same key as the
     * outer signature.
     */
    static unverifiedInnerSignature(): EnvelopeError;
    /** Returned when the signature object is not a `Signature`. */
    static invalidSignatureType(): EnvelopeError;
    /**
     * Returned when SSKR shares are invalid or insufficient for
     * reconstruction.
     *
     * This error occurs when attempting to join SSKR shares that are
     * malformed, from different splits, or insufficient to meet the
     * recovery threshold.
     */
    static invalidShares(): EnvelopeError;
    /** SSKR error wrapper */
    static sskr(message: string, cause?: Error): EnvelopeError;
    /**
     * Returned when an envelope contains an invalid type.
     *
     * This error occurs when an envelope's type information doesn't match
     * the expected format or value.
     */
    static invalidType(): EnvelopeError;
    /**
     * Returned when an envelope contains ambiguous type information.
     *
     * This error occurs when multiple type assertions exist that conflict
     * with each other or create ambiguity about the envelope's type.
     */
    static ambiguousType(): EnvelopeError;
    /** Returned when the subject is expected to be the unit value but isn't. */
    static subjectNotUnit(): EnvelopeError;
    /**
     * Returned when a response envelope has an unexpected ID.
     *
     * This error occurs when processing a response envelope and the ID doesn't
     * match the expected request ID, as defined in BCR-2023-012.
     */
    static unexpectedResponseId(): EnvelopeError;
    /** Returned when a response envelope is invalid. */
    static invalidResponse(): EnvelopeError;
    /** dcbor error wrapper */
    static cbor(message: string, cause?: Error): EnvelopeError;
    /** Components error wrapper */
    static components(message: string, cause?: Error): EnvelopeError;
    /**
     * `InvalidParameter`: `parameter` did not meet `expected` (the JS-only
     * input domain: a fractional position, an invalid `Date`, `undefined`).
     */
    static invalidParameter(parameter: string, expected: string, value?: unknown, cause?: Error): EnvelopeError;
    /** General error wrapper */
    static general(message: string, cause?: Error): EnvelopeError;
}

/** Every code an `EnvelopeError` can carry; see each member for when it is raised. */
export declare const EnvelopeErrorCode: {
    /** The part is already elided. */
    readonly AlreadyElided: "AlreadyElided";
    /** More than one assertion has the predicate. */
    readonly AmbiguousPredicate: "AmbiguousPredicate";
    /** A digest in the wire form does not match the recomputed one. */
    readonly InvalidDigest: "InvalidDigest";
    /** The CBOR is not a well-formed envelope. */
    readonly InvalidFormat: "InvalidFormat";
    /** An expected digest is absent. */
    readonly MissingDigest: "MissingDigest";
    /** No assertion has the predicate. */
    readonly NonexistentPredicate: "NonexistentPredicate";
    /** The envelope is not a wrapper. */
    readonly NotWrapped: "NotWrapped";
    /** The subject is not a leaf. */
    readonly NotLeaf: "NotLeaf";
    /** The envelope is not an assertion. */
    readonly NotAssertion: "NotAssertion";
    /** The assertion's wire form is malformed. */
    readonly InvalidAssertion: "InvalidAssertion";
    /** The attachment's structure is malformed. */
    readonly InvalidAttachment: "InvalidAttachment";
    /** No attachment matches. */
    readonly NonexistentAttachment: "NonexistentAttachment";
    /** More than one attachment matches. */
    readonly AmbiguousAttachment: "AmbiguousAttachment";
    /** The edge has no `isA` assertion. */
    readonly EdgeMissingIsA: "EdgeMissingIsA";
    /** The edge has no `source` assertion. */
    readonly EdgeMissingSource: "EdgeMissingSource";
    /** The edge has no `target` assertion. */
    readonly EdgeMissingTarget: "EdgeMissingTarget";
    /** The edge has more than one `isA` assertion. */
    readonly EdgeDuplicateIsA: "EdgeDuplicateIsA";
    /** The edge has more than one `source` assertion. */
    readonly EdgeDuplicateSource: "EdgeDuplicateSource";
    /** The edge has more than one `target` assertion. */
    readonly EdgeDuplicateTarget: "EdgeDuplicateTarget";
    /** The edge carries an assertion that is not `isA`, `source` or `target`. */
    readonly EdgeUnexpectedAssertion: "EdgeUnexpectedAssertion";
    /** No edge matches. */
    readonly NonexistentEdge: "NonexistentEdge";
    /** More than one edge matches. */
    readonly AmbiguousEdge: "AmbiguousEdge";
    /** The part is already compressed. */
    readonly AlreadyCompressed: "AlreadyCompressed";
    /** The part is not compressed. */
    readonly NotCompressed: "NotCompressed";
    /** The part is already encrypted. */
    readonly AlreadyEncrypted: "AlreadyEncrypted";
    /** The part is not encrypted. */
    readonly NotEncrypted: "NotEncrypted";
    /** The subject is not a known value. */
    readonly NotKnownValue: "NotKnownValue";
    /** No `hasRecipient` assertion opens with the given key. */
    readonly UnknownRecipient: "UnknownRecipient";
    /** No `hasSecret` assertion opens with the given secret. */
    readonly UnknownSecret: "UnknownSecret";
    /** No signature verifies for the given key. */
    readonly UnverifiedSignature: "UnverifiedSignature";
    /** The outer signature of a signed-with-metadata assertion is not a `Signature`. */
    readonly InvalidOuterSignatureType: "InvalidOuterSignatureType";
    /** The inner signature of a signed-with-metadata assertion is not a `Signature`. */
    readonly InvalidInnerSignatureType: "InvalidInnerSignatureType";
    /** The inner signature of a signed-with-metadata assertion does not verify. */
    readonly UnverifiedInnerSignature: "UnverifiedInnerSignature";
    /** The `signed` object is not a `Signature`. */
    readonly InvalidSignatureType: "InvalidSignatureType";
    /** The SSKR shares are empty or not all from the same split. */
    readonly InvalidShares: "InvalidShares";
    /** The SSKR library rejected the shares. */
    readonly Sskr: "Sskr";
    /** The envelope does not carry the expected `isA` type. */
    readonly InvalidType: "InvalidType";
    /** The envelope has zero or several `isA` types where exactly one was required. */
    readonly AmbiguousType: "AmbiguousType";
    /** The subject is not the unit known value. */
    readonly SubjectNotUnit: "SubjectNotUnit";
    /** The response's id does not match the request's. */
    readonly UnexpectedResponseId: "UnexpectedResponseId";
    /** The response's structure is malformed. */
    readonly InvalidResponse: "InvalidResponse";
    /** The CBOR layer rejected the bytes (wrapped `CborError`). */
    readonly Cbor: "Cbor";
    /** The components layer rejected the input (wrapped `ComponentsError`). */
    readonly Components: "Components";
    /** A JavaScript-only input the reference's types make impossible (a fractional index, a `NaN` date, an empty name). */
    readonly InvalidParameter: "InvalidParameter";
    /** Any other failure; see the message. */
    readonly General: "General";
};

/** One of the `EnvelopeErrorCode` values. */
export declare type EnvelopeErrorCode = (typeof EnvelopeErrorCode)[keyof typeof EnvelopeErrorCode];

/** `details` is discriminated by `code`. */
export declare type EnvelopeErrorDetails = InvalidParameterDetails | MessageDetails;

/**
 * Helper type for values that can be encoded as envelopes.
 *
 * This includes:
 * - Types that directly implement ToEnvelope
 * - Primitive types (string, number, boolean)
 * - Uint8Array (for binary data)
 * - null and undefined
 *
 * The Envelope class will handle conversion of these types automatically.
 */
export declare type EnvelopeInput = ToEnvelope | string | number | boolean | bigint | Uint8Array | Date | null | Envelope | KnownValue | ToCbor;

/** Well-known function `eq` ({@link FUNCTION_IDS}.EQ). */
export declare const EQ: Function_2;

/** Creates an equality expression: lhs == rhs */
export declare function eq(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

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
 * const statusEvent = Event.from("System online", eventId)
 *   .withNote("Regular status update")
 *   .withDate(timestamp);
 *
 * // Convert to an envelope for transmission
 * const envelope = statusEvent.toEnvelope();
 * ```
 *
 * @typeParam T - The type of content this event carries
 */
declare class Event_2<T extends EnvelopeInput> implements ToEnvelope {
    private readonly _content;
    private readonly _id;
    private readonly _note;
    private readonly _date;
    private constructor();
    /**
     * Creates a new event with the specified content and ID.
     */
    static from<T extends EnvelopeInput>(content: T, id: ARID): Event_2<T>;
    /**
     * Returns a human-readable summary of the event.
     */
    summary(): string;
    /**
     * Adds a note to the event.
     */
    withNote(note: string): Event_2<T>;
    /**
     * Adds a date to the event.
     */
    withDate(date: Date): Event_2<T>;
    /**
     * Returns the content of the event.
     */
    get content(): T;
    /**
     * Returns the unique identifier (ARID) of the event.
     */
    get id(): ARID;
    /**
     * Returns the note attached to the event, or an empty string if none exists.
     */
    get note(): string;
    /**
     * Returns the date attached to the event, if any.
     */
    get date(): Date | undefined;
    /**
     * Converts the event to an envelope.
     *
     * The envelope's subject is the event's ID tagged with TAG_EVENT,
     * and assertions include the event's content, note (if not empty), and date
     * (if present).
     */
    toEnvelope(): Envelope;
    /**
     * Creates an event from an envelope.
     *
     * @typeParam T - The type to extract the content as
     *
     * @throws EnvelopeError with code `General`.
     */
    static fromEnvelope<T extends EnvelopeInput>(envelope: Envelope, contentExtractor: (env: Envelope) => T): Event_2<T>;
    /**
     * Returns a string representation of the event.
     */
    toString(): string;
    /**
     * Checks equality with another event.
     */
    equals(other: Event_2<T>): boolean;
}
export { Event_2 as Event }

/**
 * Finds a single attachment matching the given vendor and conformsTo.
 *
 * Unlike `attachments` which returns an array,
 * this method requires exactly one attachment to match.
 *
 * @param filter - Optional `vendor` and `conformsTo` to match
 * @returns The matching attachment envelope
 * @throws EnvelopeError if not exactly one attachment matches
 */
export declare function expectAttachment(envelope: Envelope, filter?: AttachmentFilter): Envelope;

/**
 * Throws `InvalidType` unless some `isA` assertion has `t` as object.
 *
 * @throws EnvelopeError with code `InvalidType`.
 */
export declare function expectType(envelope: Envelope, t: EnvelopeInput): void;

/**
 * Throws {@link EnvelopeError.invalidType} if the envelope does not
 * carry the supplied KnownValue as its type.
 *
 * @throws EnvelopeError with code `InvalidType`.
 */
export declare function expectTypeValue(envelope: Envelope, t: KnownValue): void;

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
export declare class Expression implements ToEnvelope {
    private readonly _function;
    private readonly _parameters;
    private _envelope;
    constructor(func: Function_2);
    /** Returns the function. */
    get function(): Function_2;
    /** Returns all parameters. */
    get parameters(): Parameter[];
    /** Adds a parameter to the expression. */
    withParameter(param: ParameterID, value: EnvelopeInput): Expression;
    /** Adds multiple parameters at once; returns a new expression. */
    withParameters(params: Record<string, EnvelopeInput>): Expression;
    /** Returns true if the parameter ID matches the one stored on a Parameter. */
    private static parameterIdMatches;
    /**
     * Gets the first parameter value with the given ID.
     *
     * For multi-valued parameters (e.g. several `participant` assertions),
     * use {@link objectsForParameter} to retrieve all matching values.
     */
    parameter(param: ParameterID): Envelope | undefined;
    /**
     * Returns all parameter values matching the given ID.
     *
     * to `Envelope::objects_for_predicate` and returns a `Vec<Envelope>`.
     */
    objectsForParameter(param: ParameterID): Envelope[];
    /** Checks if a parameter exists. */
    hasParameter(param: ParameterID): boolean;
    /** Converts the expression to an envelope. */
    toEnvelope(): Envelope;
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
    static fromEnvelope(envelope: Envelope, expectedFunction?: Function_2): Expression;
    /**
     * The reference's `Display`: the expression's format string, quoted and
     * escaped (`write!(f, "{:?}", self.envelope.format())`); `JSON.stringify`
     * produces the same text for the characters a format string contains.
     */
    toString(): string;
}

/**
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
export declare function flanked(str: string, left: string, right: string): string;

/**
 * Envelope notation: the subject followed by its assertions in brackets,
 * nested and indented (or on one line with `flat`).
 */
export declare function format(envelope: Envelope, options?: FormatOptions): string;

/**
 * Context object for formatting Gordian Envelopes with annotations.
 *
 * The FormatContext provides information about CBOR tags, known values,
 * functions, and parameters that are used to annotate the output of envelope
 * formatting functions.
 */
export declare class FormatContext implements ReadonlyTagsStore {
    private readonly _tags;
    private readonly _knownValues;
    private readonly _functions;
    private readonly _parameters;
    constructor({ tags, knownValues, functions, parameters }?: {
        tags?: TagsStore;
        knownValues?: KnownValuesStore;
        functions?: FunctionsStore;
        parameters?: ParametersStore;
    });
    /** Names for well-known expression functions (`«add»`). */
    get functions(): FunctionsStore;
    /** Names for well-known expression parameters (`❰lhs❱`). */
    get parameters(): ParametersStore;
    /** The CBOR tags registry (names and summarisers). */
    get tags(): TagsStore;
    /** The known values registry. */
    get knownValues(): KnownValuesStore;
    assignedNameForTag(tag: Tag): string | undefined;
    nameForTag(tag: Tag): string;
    tagForValue(value: CborNumber): Tag | undefined;
    tagForName(name: string): Tag | undefined;
    nameForValue(value: CborNumber): string;
    summarizer(tag: CborNumber): CborSummarizer | undefined;
    /** Create a clone of this context */
    clone(): FormatContext;
}

/**
 * Which format context a formatter uses: a specific one, the global one
 * (`"global"`, the default), or none (`"none"`: no tag names, no known-value
 * names).
 */
export declare type FormatContextOpt = FormatContext | "global" | "none";

/** `format` on one line. */
export declare function formatFlat(envelope: Envelope, options?: Omit<FormatOptions, "flat">): string;

/** Options for envelope notation formatting. */
export declare interface FormatOptions {
    /** Format as a single line without indentation. */
    flat?: boolean;
    /** Names for tags and known values; the global context by default. */
    context?: FormatContextOpt;
}

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
declare class Function_2 implements ToEnvelope {
    private readonly _variant;
    private readonly _value;
    private readonly _name;
    private constructor();
    /** A function by known id (number) or name (string). */
    static from(id: FunctionID): Function_2;
    /** A known function with a numeric id and an optional display name. */
    static known(value: number, name?: string): Function_2;
    /** Creates a new named function identified by a string. */
    static named(name: string): Function_2;
    /** Returns true if this is a known (numeric) function. */
    isKnown(): boolean;
    /** Returns true if this is a named (string) function. */
    isNamed(): boolean;
    /** Returns the numeric value for known functions. */
    get value(): number | undefined;
    /** Returns the function identifier (number for known, string for named). */
    get id(): FunctionID;
    /**
     * Returns the display name of the function.
     *
     * For known functions with a name, returns the name.
     * For known functions without a name, returns the numeric ID as a string.
     * For named functions, returns the name enclosed in quotes.
     */
    get name(): string;
    /** Returns the raw name for named functions, or undefined for known functions. */
    get namedName(): string | undefined;
    /** Returns the assigned name if present (for known functions only). */
    get assignedName(): string | undefined;
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
    toEnvelope(): Envelope;
    /** Creates an expression with a parameter. */
    withParameter(param: ParameterID, value: EnvelopeInput): Expression;
    /** Checks equality based on value (for known) or name (for named). */
    equals(other: Function_2): boolean;
    /**
     * The reference's `Display`: the assigned name or the number for a known
     * function, the name in quotes for a named one (`add`, `99`, `"greet"`).
     * The `«…»` form belongs to the format strings, where the format context
     * prints it on both sides.
     */
    toString(): string;
}
export { Function_2 as Function }

/** Well-known function identifiers (numeric) */
export declare const FUNCTION_IDS: {
    /** Addition (`add`). */
    readonly ADD: 1;
    /** Subtraction (`sub`). */
    readonly SUB: 2;
    /** Multiplication (`mul`). */
    readonly MUL: 3;
    /** Division (`div`). */
    readonly DIV: 4;
    /** Unary negation (`neg`). */
    readonly NEG: 5;
    /** Less than (`lt`). */
    readonly LT: 6;
    /** Less than or equal (`le`). */
    readonly LE: 7;
    /** Greater than (`gt`). */
    readonly GT: 8;
    /** Greater than or equal (`ge`). */
    readonly GE: 9;
    /** Equal to (`eq`). */
    readonly EQ: 10;
    /** Not equal to (`ne`). */
    readonly NE: 11;
    /** Logical and (`and`). */
    readonly AND: 12;
    /** Logical or (`or`). */
    readonly OR: 13;
    /** Logical xor (`xor`). */
    readonly XOR: 14;
    /** Logical not (`not`). */
    readonly NOT: 15;
};

/** Type for function identifier (number or string) */
export declare type FunctionID = number | string;

/**
 * A store that maps functions to their assigned names.
 *
 * FunctionsStore maintains a registry of functions and their human-readable
 * names, which is useful for displaying and debugging expression functions.
 */
export declare class FunctionsStore {
    private readonly _dict;
    /** Creates a new FunctionsStore with the given functions. */
    constructor(functions?: Iterable<Function_2>);
    /** Inserts a function into the store. */
    register(func: Function_2): void;
    /** Returns the assigned name for a function, if it exists in the store. */
    assignedNameOf(func: Function_2): string | undefined;
    /** Returns the name for a function, either from this store or from the function itself. */
    nameOf(func: Function_2): string;
    /** The registered functions. */
    [Symbol.iterator](): IterableIterator<Function_2>;
    /** An independent copy (a format context takes one, as the reference does). */
    clone(): FunctionsStore;
    /** The function's name in `store` when registered there, else its own name. */
    static nameForFunction(func: Function_2, store?: FunctionsStore): string;
}

/** Well-known function `ge` ({@link FUNCTION_IDS}.GE). */
export declare const GE: Function_2;

/** Creates a greater-than-or-equal expression: lhs >= rhs */
export declare function ge(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

/** Get the global format context instance, initializing it if necessary. */
export declare const getGlobalFormatContext: () => FormatContext;

/**
 * returns the single type if there is exactly one, otherwise raises
 * `Error::AmbiguousType`. Earlier revisions of this port returned
 * `InvalidType` when the count was 0 — the reference uses the same
 * `AmbiguousType` variant for both 0 and >1 cases.
 *
 * @throws EnvelopeError with code `AmbiguousType`.
 */
export declare function getType(envelope: Envelope): Envelope;

/** The global shared store of known functions, built on first use. */
export declare function globalFunctions(): FunctionsStore;

/** The global shared store of known parameters, built on first use. */
export declare function globalParameters(): ParametersStore;

/** Well-known function `gt` ({@link FUNCTION_IDS}.GT). */
export declare const GT: Function_2;

/** Creates a greater-than expression: lhs > rhs */
export declare function gt(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

/**
 * Returns whether the envelope's subject has a valid signature from the
 * given public key.
 */
export declare function hasSignatureFrom(envelope: Envelope, verifier: Verifier): boolean;

/**
 * Returns the signature metadata envelope if the given verifier has signed
 * this envelope, or undefined if no matching signature is found.
 *
 * Handles both simple signatures and wrapped (double-signed) signatures
 * with metadata.
 *
 * @throws EnvelopeError with code `InvalidOuterSignatureType`, `UnverifiedInnerSignature`, `InvalidInnerSignatureType`, `InvalidSignatureType`.
 */
export declare function hasSignatureFromReturningMetadata(envelope: Envelope, verifier: Verifier): Envelope | undefined;

/**
 * Returns whether the envelope's subject has a valid signature from all
 * the given public keys.
 */
export declare function hasSignaturesFrom(envelope: Envelope, verifiers: Verifier[]): boolean;

/** Returns whether the envelope's subject has some threshold of signatures. */
export declare function hasSignaturesFromThreshold(envelope: Envelope, verifiers: Verifier[], threshold?: number): boolean;

/** `true` when some `isA` assertion has `t` as object. */
export declare function hasType(envelope: Envelope, t: EnvelopeInput): boolean;

/**
 * Specialised counterpart to {@link Envelope.hasType} for checking
 * against registered KnownValue types (e.g. `SEED_TYPE`).
 */
export declare function hasTypeValue(envelope: Envelope, t: KnownValue): boolean;

/** The envelope's CBOR as hex, annotated line by line unless `annotate` is false. */
export declare function hex(envelope: Envelope, { annotate, context }?: HexOptions): string;

/** Options for `hex`. */
export declare interface HexOptions {
    /** Annotate each CBOR item with its type and tag name (on by default). */
    annotate?: boolean;
    /** Names for tags; the global context by default. */
    context?: FormatContextOpt;
}

/** `details` of an `InvalidParameter` error. */
export declare interface InvalidParameterDetails {
    /** The discriminant. */
    code: "InvalidParameter";
    /** The parameter that was rejected. */
    parameter: string;
    /** What it had to be. */
    expected: string;
    /** What it was, when known. */
    value?: unknown;
}

/** `true` when some `hasSecret` assertion was locked by a password method. */
export declare function isLockedWithPassword(envelope: Envelope): boolean;

/** `true` when some `hasSecret` assertion was locked by the SSH-agent method. */
export declare function isLockedWithSshAgent(envelope: Envelope): boolean;

/**
 * Type guard to check if a value implements ToEnvelope.
 *
 * @param value - The value to check
 * @returns `true` if the value implements ToEnvelope, `false` otherwise
 */
export declare function isToEnvelope(value: unknown): value is ToEnvelope;

/** Returns whether the given signature is valid. */
export declare function isVerifiedSignature(envelope: Envelope, signature: Signature, verifier: Verifier): boolean;

/** Well-known function `le` ({@link FUNCTION_IDS}.LE). */
export declare const LE: Function_2;

/** Creates a less-than-or-equal expression: lhs <= rhs */
export declare function le(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

/** Well-known parameter `lhs` ({@link PARAMETER_IDS}.LHS). */
export declare const LHS: Parameter;

/** Wraps the envelope and locks the wrapper's subject (see `lockSubject`). */
export declare function lock(envelope: Envelope, method: KeyDerivationMethod, secret: Uint8Array, options?: RngOptions): Envelope;

/**
 * Encrypts the subject with a fresh content key and adds a `hasSecret`
 * assertion holding that key locked by `secret` via `method`.
 */
export declare function lockSubject(envelope: Envelope, method: KeyDerivationMethod, secret: Uint8Array, options?: RngOptions): Envelope;

/** Well-known function `lt` ({@link FUNCTION_IDS}.LT). */
export declare const LT: Function_2;

/** Creates a less-than expression: lhs < rhs */
export declare function lt(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

/** Convenience constructor for a `'signed': Signature` assertion envelope. */
export declare function makeSignedAssertion(_envelope: Envelope, signature: Signature, note?: string): Envelope;

/** A Mermaid flowchart of the envelope's digest tree. */
export declare function mermaidFormat(envelope: Envelope, opts?: MermaidFormatOptions): string;

/** Options for Mermaid diagram formatting. */
export declare interface MermaidFormatOptions {
    /** Omit the `NODE` elements (the subject and assertions attach to the parent). */
    hideNodes?: boolean;
    /** No colours on nodes and links. */
    monochrome?: boolean;
    /** The Mermaid theme (`default` by default). */
    theme?: MermaidTheme;
    /** The flowchart direction (`LR` by default). */
    orientation?: MermaidOrientation;
    /** Elements whose digest is in here get a thicker border. */
    highlightingTarget?: Iterable<Digest | DigestProvider>;
    /** Names for tags and known values; the global context by default, `"none"` for codepoints. */
    context?: FormatContextOpt;
}

/** The orientation of the Mermaid flowchart. */
export declare const MermaidOrientation: {
    /** `LR`. */
    readonly LeftToRight: "LR";
    /** `TB`. */
    readonly TopToBottom: "TB";
    /** `RL`. */
    readonly RightToLeft: "RL";
    /** `BT`. */
    readonly BottomToTop: "BT";
};

/** One of the `MermaidOrientation` values. */
export declare type MermaidOrientation = (typeof MermaidOrientation)[keyof typeof MermaidOrientation];

/** The theme for the Mermaid flowchart. */
export declare const MermaidTheme: {
    /** Mermaid's default theme. */
    readonly Default: "default";
    /** Greyscale. */
    readonly Neutral: "neutral";
    /** Dark background. */
    readonly Dark: "dark";
    /** Green tones. */
    readonly Forest: "forest";
    /** The customisable base theme. */
    readonly Base: "base";
};

/** One of the `MermaidTheme` values. */
export declare type MermaidTheme = (typeof MermaidTheme)[keyof typeof MermaidTheme];

/** `details` of every other code. */
export declare interface MessageDetails {
    /** The discriminant. */
    code: Exclude<EnvelopeErrorCode, "InvalidParameter">;
    /** The message without the code's prefix. */
    message: string;
}

/** Well-known function `mul` ({@link FUNCTION_IDS}.MUL). */
export declare const MUL: Function_2;

/** Creates a multiplication expression: lhs * rhs */
export declare function mul(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

/** Well-known function `ne` ({@link FUNCTION_IDS}.NE). */
export declare const NE: Function_2;

/** Creates a not-equal expression: lhs != rhs */
export declare function ne(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

/** Well-known function `neg` ({@link FUNCTION_IDS}.NEG). */
export declare const NEG: Function_2;

/** Creates a negation expression: -value */
export declare function neg(value: EnvelopeInput): Expression;

/** Well-known function `not` ({@link FUNCTION_IDS}.NOT). */
export declare const NOT: Function_2;

/** Creates a logical NOT expression: !value */
export declare function not(value: EnvelopeInput): Expression;

/**
 * Actions that can be performed on parts of an envelope to obscure them.
 *
 * Gordian Envelope supports several ways to obscure parts of an envelope while
 * maintaining its semantic integrity and digest tree.
 */
export declare type ObscureAction = "elide" | "compress" | {
    /** Encrypt with this key instead of eliding. */
    encrypt: SymmetricKey;
};

/** How an obscured element was obscured. */
export declare const ObscureType: {
    /** Replaced by its digest. */
    readonly Elided: "elided";
    /** Replaced by an `EncryptedMessage` of its CBOR. */
    readonly Encrypted: "encrypted";
    /** Replaced by a `Compressed` of its CBOR. */
    readonly Compressed: "compressed";
};

/** One of the `ObscureType` values. */
export declare type ObscureType = (typeof ObscureType)[keyof typeof ObscureType];

/** Well-known function `or` ({@link FUNCTION_IDS}.OR). */
export declare const OR: Function_2;

/** Creates a logical OR expression: lhs || rhs */
export declare function or(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

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
export declare class Parameter implements ToEnvelope {
    private readonly _variant;
    private readonly _value;
    private readonly _name;
    private readonly _paramValue;
    private constructor();
    /** Creates a new known parameter with a numeric ID and optional name. */
    static known(value: number, name?: string): Parameter;
    /** Creates a new named parameter identified by a string. */
    static named(name: string): Parameter;
    /** A parameter by known id or name, carrying `value` when given. */
    static from(id: ParameterID, value?: EnvelopeInput): Parameter;
    /** Returns true if this is a known (numeric) parameter. */
    isKnown(): boolean;
    /** Returns true if this is a named (string) parameter. */
    isNamed(): boolean;
    /** Returns the numeric value for known parameters. */
    get value(): number | undefined;
    /** Returns the parameter identifier (number for known, string for named). */
    get id(): ParameterID;
    /**
     * Returns the display name of the parameter.
     *
     * For known parameters with a name, returns the name.
     * For known parameters without a name, returns the numeric ID as a string.
     * For named parameters, returns the name enclosed in quotes.
     */
    get name(): string;
    /** Returns the raw name for named parameters, or undefined for known parameters. */
    get namedName(): string | undefined;
    /** Returns the assigned name if present (for known parameters only). */
    get assignedName(): string | undefined;
    /** Returns the parameter value as an envelope, if set. */
    get paramValue(): Envelope | undefined;
    /**
     * Creates a parameter envelope.
     *
     * Same encoding as `Function.toEnvelope` above: the parameter is stored
     * as `tag(40007, untagged)` where untagged is `uint(N)` (Known) or
     * `text(name)` (Named).
     */
    toEnvelope(): Envelope;
    /** Checks equality based on value (for known) or name (for named). */
    equals(other: Parameter): boolean;
    /**
     * The reference's `Display`: the assigned name or the number for a known
     * parameter, the name in quotes for a named one (`lhs`, `77`, `"x"`); a
     * parameter that carries a value appends `: value`. The `❰…❱` form belongs
     * to the format strings, where the format context prints it on both sides.
     */
    toString(): string;
    /** The `_` (blank) parameter with `value`. */
    static blank(value: EnvelopeInput): Parameter;
    /** The `lhs` parameter with `value`. */
    static lhs(value: EnvelopeInput): Parameter;
    /** The `rhs` parameter with `value`. */
    static rhs(value: EnvelopeInput): Parameter;
}

/** Well-known parameter identifiers (numeric) */
export declare const PARAMETER_IDS: {
    /** Blank/implicit parameter (`blank`). */
    readonly BLANK: 1;
    /** Left-hand side (`lhs`). */
    readonly LHS: 2;
    /** Right-hand side (`rhs`). */
    readonly RHS: 3;
};

/** Type for parameter identifier (number or string) */
export declare type ParameterID = number | string;

/**
 * A store that maps parameters to their assigned names.
 *
 * ParametersStore maintains a registry of parameters and their human-readable
 * names, which is useful for displaying and debugging expression parameters.
 */
export declare class ParametersStore {
    private readonly _dict;
    /** Creates a new ParametersStore with the given parameters. */
    constructor(parameters?: Iterable<Parameter>);
    /** Inserts a parameter into the store. */
    register(param: Parameter): void;
    /** Returns the assigned name for a parameter, if it exists in the store. */
    assignedNameOf(param: Parameter): string | undefined;
    /** Returns the name for a parameter, either from this store or from the parameter itself. */
    nameOf(param: Parameter): string;
    /** The registered parameters. */
    [Symbol.iterator](): IterableIterator<Parameter>;
    /** An independent copy (a format context takes one, as the reference does). */
    clone(): ParametersStore;
    /** The parameter's name in `store` when registered there, else its own name. */
    static nameForParameter(param: Parameter, store?: ParametersStore): string;
}

/** Options for `addRecipient` and the `encrypt*ToRecipient*` functions. */
export declare interface RecipientOptions extends RngOptions {
    /** Use exactly this nonce for the sealed content key; tests and vectors only. */
    nonce?: Nonce | undefined;
}

/**
 * Returns all SealedMessages from the envelope's `hasRecipient` assertions.
 *
 * @returns Array of SealedMessage objects
 *
 * @throws EnvelopeError with code `General`.
 */
export declare function recipients(envelope: Envelope): SealedMessage[];

/**
 * Registers dcbor's standard tags, every BC tag and the envelope
 * summarisers in `context` (a custom context; the global one is set up on
 * first use).
 */
export declare const registerTagsIn: (context: FormatContext) => void;

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
declare class Request_2 implements ToEnvelope {
    private readonly _body;
    private readonly _id;
    private readonly _note;
    private readonly _date;
    private constructor();
    /**
     * A request for `func` (a `Function`, a known-function number, a name, or
     * a ready `Expression`) identified by `id`.
     */
    static from(func: Function_2 | Expression | FunctionID, id: ARID): Request_2;
    /**
     * Returns a human-readable summary of the request.
     */
    summary(): string;
    /**
     * Adds a parameter to the request.
     */
    withParameter(param: ParameterID, value: EnvelopeInput): Request_2;
    /**
     * Adds a note to the request.
     */
    withNote(note: string): Request_2;
    /**
     * Adds a date to the request.
     */
    withDate(date: Date): Request_2;
    /**
     * Returns the body of the request (the expression to be evaluated).
     */
    get body(): Expression;
    /**
     * Returns the unique identifier (ARID) of the request.
     */
    get id(): ARID;
    /**
     * Returns the note attached to the request, or an empty string if none exists.
     */
    get note(): string;
    /**
     * Returns the date attached to the request, if any.
     */
    get date(): Date | undefined;
    /**
     * Returns the function of the request.
     */
    get function(): Function_2;
    /**
     * Returns the expression envelope of the request.
     */
    get expressionEnvelope(): Envelope;
    /**
     * Converts the request to an envelope.
     *
     * The envelope's subject is the request's ID tagged with TAG_REQUEST,
     * and assertions include the request's body, note (if not empty), and date (if present).
     */
    toEnvelope(): Envelope;
    /**
     * Creates a request from an envelope.
     *
     * @throws EnvelopeError with code `General`.
     */
    static fromEnvelope(envelope: Envelope, expectedFunction?: Function_2): Request_2;
    /**
     * Returns a string representation of the request.
     */
    toString(): string;
    /**
     * Checks equality with another request.
     */
    equals(other: Request_2): boolean;
}
export { Request_2 as Request }

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
declare class Response_2 implements ToEnvelope {
    private readonly _result;
    private constructor();
    /**
     * Creates a new successful response with the specified request ID.
     *
     * By default, the result will be the 'OK' known value. Use `withResult`
     * to set a specific result value.
     */
    static success(id: ARID): Response_2;
    /**
     * Creates a new failure response with the specified request ID.
     *
     * By default, the error will be the 'Unknown' known value. Use
     * `withError` to set a specific error message.
     */
    static failure(id: ARID): Response_2;
    /**
     * Creates a new early failure response without a request ID.
     *
     * An early failure occurs when the error happens before the request
     * has been fully processed, so the request ID is not known.
     */
    static earlyFailure(): Response_2;
    /**
     * Creates an envelope containing the 'Unknown' known value.
     */
    static get UNKNOWN(): Envelope;
    /**
     * Creates an envelope containing the 'OK' known value.
     */
    static get OK(): Envelope;
    /**
     * Returns a human-readable summary of the response.
     */
    summary(): string;
    /**
     * Sets the result value for a successful response.
     * @throws Error if called on a failure response.
     */
    withResult(result: EnvelopeInput): Response_2;
    /** A copy with `result` when given, with a `null` result otherwise (as the reference). */
    withOptionalResult(result: EnvelopeInput | undefined): Response_2;
    /**
     * Sets the error value for a failure response.
     * @throws Error if called on a successful response.
     */
    withError(error: EnvelopeInput): Response_2;
    /** A copy with `error` when given; this response otherwise. */
    withOptionalError(error: EnvelopeInput | undefined): Response_2;
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
    get id(): ARID | undefined;
    /**
     * The id; `General` when the response has none.
     *
     * @throws EnvelopeError with code `General`.
     */
    expectId(): ARID;
    /**
     * Returns the result envelope if this is a successful response.
     * @throws Error if this is a failure response.
     */
    get result(): Envelope;
    /**
     * Returns the error envelope if this is a failure response.
     * @throws Error if this is a successful response.
     */
    get error(): Envelope;
    /**
     * Extracts a typed result value from a successful response.
     */
    extractResult<T>(decoder: CborDecoder<T>): T;
    /**
     * Extracts a typed error value from a failure response.
     */
    extractError<T>(decoder: CborDecoder<T>): T;
    /**
     * Converts the response to an envelope.
     *
     * Successful responses have the request ID as the subject and a 'result'
     * assertion. Failure responses have the request ID (or 'Unknown' if not known)
     * as the subject and an 'error' assertion.
     */
    toEnvelope(): Envelope;
    /**
     * Creates a response from an envelope.
     *
     * @throws EnvelopeError with code `InvalidResponse`, `General`.
     */
    static fromEnvelope(envelope: Envelope): Response_2;
    /**
     * Returns a string representation of the response.
     */
    toString(): string;
    /**
     * Checks equality with another response.
     */
    equals(other: Response_2): boolean;
}
export { Response_2 as Response }

/** Well-known parameter `rhs` ({@link PARAMETER_IDS}.RHS). */
export declare const RHS: Parameter;

/** Options for `Envelope.addSalt`. */
export declare interface SaltOptions {
    /** Use exactly this salt (at least 8 bytes). */
    salt?: Salt | Uint8Array;
    /** Random salt of exactly this many bytes (at least 8). */
    length?: number;
    /** Random salt of a length in this inclusive range. */
    range?: {
        /** Smallest length (at least 8). */
        min: number;
        /** Largest length. */
        max: number;
    };
    /** Randomness source; secure by default. */
    rng?: RandomNumberGenerator;
}

/**
 * `sign(sender)` already wraps the envelope before signing, so the seal
 * pipeline is `wrap → addSignature → wrap → encryptToRecipient`. Earlier
 * revisions of this port called `addSignature(sender)` directly (no inner
 * wrap), which produced sealed envelopes one wrap layer shallower than
 * the reference's and broke cross-impl unseal.
 */
export declare function seal(envelope: Envelope, sender: Signer, recipient: Encrypter, options?: SignOptions): Envelope;

/** The digest as `short` (8 hex chars), `full` (64) or `ur` (`ur:digest/…`). */
export declare function shortId(envelope: Envelope, format?: "short" | "full" | "ur"): string;

/** Wraps the envelope and signs it: `envelope.wrap()` plus a `signed` assertion. */
export declare function sign(envelope: Envelope, signer: Signer, options?: SignOptions): Envelope;

/**
 * Metadata associated with a signature in a Gordian Envelope.
 *
 * `SignatureMetadata` provides a way to attach additional information to
 * signatures, such as the signer's identity, the signing date, or the purpose
 * of the signature. When used with the signature extension, this metadata is
 * included in a structured way that is also signed, ensuring the metadata
 * cannot be tampered with without invalidating the signature.
 *
 */
export declare class SignatureMetadata {
    private readonly _assertions;
    private constructor();
    /** Metadata with the given `[predicate, object]` assertions. */
    static from(assertions?: readonly [EnvelopeInput, unknown][]): SignatureMetadata;
    /**
     * Adds an assertion to the metadata.
     *
     * @param predicate - The predicate for the assertion (accepts KnownValue, string, etc.)
     * @param object - The object for the assertion
     * @returns A new SignatureMetadata with the assertion added
     */
    withAssertion(predicate: EnvelopeInput, object: unknown): SignatureMetadata;
    /**
     * Returns all assertions in this metadata.
     */
    get assertions(): readonly [EnvelopeInput, unknown][];
    /**
     * Returns whether this metadata contains any assertions.
     */
    hasAssertions(): boolean;
}

/** Returns all signature assertion objects. */
export declare function signatures(envelope: Envelope): Envelope[];

/** Options for `sign` and `addSignature`. */
export declare interface SignOptions {
    /** Scheme-specific signing options (Schnorr `rng`, SSH namespace and hash). */
    signing?: SigningOptions;
    /** Assertions to bind to the signature (a signed, wrapped signature envelope). */
    metadata?: SignatureMetadata;
}

/**
 * Recovers the envelope from a quorum of `sskrSplit` shares; `InvalidShares` / `Sskr` otherwise.
 *
 * @throws EnvelopeError with code `InvalidShares`.
 */
export declare function sskrJoin(envelopes: Envelope[]): Envelope;

/**
 * Splits `contentKey` into SSKR shares per `spec` and returns one copy of
 * the envelope per share, each carrying its share as an `sskrShare`
 * assertion, grouped as the spec groups them. `sskrJoin` recovers the
 * envelope from a quorum.
 */
export declare function sskrSplit(envelope: Envelope, spec: Spec, contentKey: SymmetricKey, { rng }?: RngOptions): Envelope[][];

/** Well-known function `sub` ({@link FUNCTION_IDS}.SUB). */
export declare const SUB: Function_2;

/** Creates a subtraction expression: lhs - rhs */
export declare function sub(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

/**
 * A one-line summary of an envelope: its leaf value (text truncated to
 * `maxLength`), a known value's name, or the case name (`NODE`, `WRAPPED`,
 * `ELIDED`, …) for structure.
 */
export declare function summary(envelope: Envelope, options?: SummaryOptions): string;

/** Options for `summary`. */
export declare interface SummaryOptions {
    /** Truncate text leaves beyond this many characters (40 by default). */
    maxLength?: number;
    /** Names for tags and known values; the global context by default. */
    context?: FormatContextOpt;
}

/**
 * A trait for types that can be encoded as a Gordian Envelope.
 *
 * This interface defines the contract for converting a value into an envelope.
 * Types implementing this interface can be used directly with envelope
 * construction functions without explicit conversion.
 *
 * There are numerous built-in implementations for common types including:
 * - Primitive types (numbers, strings, booleans)
 * - CBOR values
 * - Cryptographic types (digests, keys, etc.)
 * - Assertions
 * - Other envelopes
 *
 * @example
 * ```typescript
 * // String implements ToEnvelope
 * const e1 = Envelope.from("Hello");
 *
 * // Numbers implement ToEnvelope
 * const e2 = Envelope.from(42);
 *
 * // Using in envelope construction
 * const envelope = Envelope.from("subject")
 *     .addAssertion("name", "Alice")  // Uses ToEnvelope for both predicate and object
 *     .addAssertion("age", 30);       // Uses ToEnvelope for the numeric object
 * ```
 */
export declare interface ToEnvelope {
    /**
     * Converts this value into a Gordian Envelope.
     *
     * This is the core method of the interface, converting the implementing type
     * into an envelope representation. Most implementations will convert the
     * value to a leaf envelope containing the value.
     *
     * @returns A new envelope containing the value.
     */
    toEnvelope(): Envelope;
}

/**
 * The tree rendering: one line per element, indented by depth, as
 *
 *   `[*]<short_id> [edge_label] <summary>`
 *
 * Summaries are rendered with a format context, so known values appear
 * under their registered names (`'isA'`, `'note'`) rather than as raw
 * numbers. The context defaults to the global one (see
 * {@link getGlobalFormatContext}); override it per call with
 * {@link TreeFormatOptions.context}.
 */
export declare function treeFormat(envelope: Envelope, options?: TreeFormatOptions): string;

/** Options for tree formatting */
export declare interface TreeFormatOptions {
    /** Omit the `NODE` lines (the subject and assertions attach to the parent). */
    hideNodes?: boolean;
    /** Elements whose digest is in here are marked with `*`. */
    highlightingTarget?: Iterable<Digest | DigestProvider>;
    /** How each element's digest is shown: `short` (8 hex chars), `full` (64) or `ur`. */
    digestDisplay?: DigestDisplayFormat | "short" | "full" | "ur";
    /** Names for tags and known values; the global context by default, `"none"` for codepoints. */
    context?: FormatContextOpt;
}

/** The objects of every `isA` assertion. */
export declare function types(envelope: Envelope): Envelope[];

/** Unlocks a subject locked with `lock` and unwraps it. */
export declare function unlock(envelope: Envelope, secret: Uint8Array): Envelope;

/**
 * Decrypts the subject with the content key that `secret` unlocks; `UnknownSecret` when none does.
 *
 * @throws EnvelopeError with code `UnknownSecret`.
 */
export declare function unlockSubject(envelope: Envelope, secret: Uint8Array): Envelope;

/**
 * `decrypt_to_recipient(recipient)?.verify(sender)`. The `verify` step
 * performs `verifySignatureFrom(sender)` *and then* `tryUnwrap()` — the
 * extra unwrap undoes the inner wrap that `sign()` added during seal.
 */
export declare function unseal(envelope: Envelope, senderPublicKey: Verifier, recipient: Decrypter): Envelope;

/**
 * Validates that this envelope is a valid attachment.
 *
 * An attachment is valid if:
 * 1. The envelope is an assertion with 'attachment' as predicate
 * 2. The object contains a wrapped payload with vendor assertion
 * 3. Reconstructing the attachment yields an equivalent envelope
 *
 * @throws EnvelopeError if the envelope is not a valid attachment
 */
export declare function validateAttachment(envelope: Envelope): void;

/**
 * Validates an edge envelope's structure per BCR-2026-003.
 *
 * An edge may be wrapped (signed) or unwrapped. The inner envelope
 * must have exactly three assertion predicates: `'isA'`, `'source'`,
 * and `'target'`. No other assertions are permitted on the edge
 * subject. Mirrors the reference `Envelope::validate_edge`
 *
 * @throws {EnvelopeError} If a required predicate is missing or
 *   duplicated, or if any other assertion is present
 *   (`edgeUnexpectedAssertion`).
 */
export declare function validateEdge(envelope: Envelope): void;

/**
 * Verifies that the envelope has a valid signature from the specified
 * verifier, and unwraps it.
 */
export declare function verify(envelope: Envelope, verifier: Verifier): Envelope;

/**
 * Verifies the envelope's signature and returns both the unwrapped
 * envelope and signature metadata.
 */
export declare function verifyReturningMetadata(envelope: Envelope, verifier: Verifier): {
    /** The unwrapped envelope. */
    envelope: Envelope;
    /** The metadata bound to the signature (the unit envelope when there was none). */
    metadata: Envelope;
};

/**
 * Checks whether the given signature is valid for the given public key.
 *
 * @throws EnvelopeError with code `UnverifiedSignature`.
 */
export declare function verifySignature(envelope: Envelope, signature: Signature, verifier: Verifier): Envelope;

/**
 * Checks whether the envelope's subject has a valid signature from the
 * given public key.
 *
 * @throws EnvelopeError with code `UnverifiedSignature`.
 */
export declare function verifySignatureFrom(envelope: Envelope, verifier: Verifier): Envelope;

/**
 * Verifies signature and returns the metadata envelope.
 *
 * @throws EnvelopeError with code `UnverifiedSignature`.
 */
export declare function verifySignatureFromReturningMetadata(envelope: Envelope, verifier: Verifier): Envelope;

/**
 * Checks whether the envelope's subject has a set of signatures.
 *
 * @throws EnvelopeError with code `UnverifiedSignature`.
 */
export declare function verifySignaturesFrom(envelope: Envelope, verifiers: Verifier[]): Envelope;

/**
 * Checks whether the envelope's subject has some threshold of signatures.
 *
 * @throws EnvelopeError with code `UnverifiedSignature`.
 */
export declare function verifySignaturesFromThreshold(envelope: Envelope, verifiers: Verifier[], threshold?: number): Envelope;

/**
 * A visitor function that is called for each element in the envelope.
 *
 * The visitor function takes the following parameters:
 * - `envelope`: The current envelope element being visited
 * - `level`: The depth level in the hierarchy (0 for root)
 * - `incomingEdge`: The type of edge connecting this element to its parent
 * - `state`: Optional context passed down from the parent's visitor call
 *
 * The visitor returns a tuple of:
 * - The state that will be passed to child elements
 * - A boolean indicating whether to stop traversal (true = stop)
 *
 * This enables accumulating state or passing context during traversal.
 */
export declare type Visitor<State> = (envelope: Envelope, level: number, incomingEdge: EdgeType, state: State) => [State, boolean];

/** Execute a function with access to the global format context. */
export declare const withFormatContext: <T>(action: (context: FormatContext) => T) => T;

/** Well-known function `xor` ({@link FUNCTION_IDS}.XOR). */
export declare const XOR: Function_2;

/** Creates a logical XOR expression: lhs ^ rhs */
export declare function xor(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

export { }
