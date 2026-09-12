import { Cbor } from '@blockchaincommons/dcbor';
import { CborCodec } from '@blockchaincommons/dcbor';
import { CborMap } from '@blockchaincommons/dcbor';
import { Compressed } from '@blockchaincommons/components';
import { Decrypter } from '@blockchaincommons/components';
import { Digest } from '@blockchaincommons/components';
import { EncryptedMessage } from '@blockchaincommons/components';
import { Encrypter } from '@blockchaincommons/components';
import { KnownValue } from '@blockchaincommons/known-values';
import { Nonce } from '@blockchaincommons/components';
import { RandomNumberGenerator } from '@blockchaincommons/rand';
import { RngOptions } from '@blockchaincommons/rand';
import { Salt } from '@blockchaincommons/components';
import { SealedMessage } from '@blockchaincommons/components';
import { SymmetricKey } from '@blockchaincommons/components';
import { Tag } from '@blockchaincommons/dcbor';
import { ToCbor } from '@blockchaincommons/dcbor';
import { UR } from '@blockchaincommons/uniform-resources';

/** Options for `Envelope.addAssertion` and friends. */
declare interface AddAssertionOptions {
    /** Also salt the assertion (see `addSalt`) so its digest is not correlatable. */
    salt?: boolean;
}

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
declare class Assertion implements DigestProvider {
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

/** Type for CBOR decoder functions */
declare type CborDecoder<T> = (cbor: Cbor) => T;

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

/**
 * Trait for types that can provide a digest.
 *
 * This is equivalent to the reference's `DigestProvider` trait. Types that
 * implement this interface can be used in contexts where a digest
 * is needed for identity or integrity verification.
 */
declare interface DigestProvider {
    /**
     * Returns the digest of this object.
     *
     * The digest uniquely identifies the semantic content of the object,
     * regardless of whether parts of it are elided, encrypted, or compressed.
     */
    digest(): Digest;
}

/**
 * The type of incoming edge provided to the visitor.
 *
 * This enum identifies how an envelope element is connected to its parent in
 * the hierarchy during traversal. It helps the visitor function understand the
 * semantic relationship between elements.
 */
declare const EdgeType: {
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
declare type EdgeType = (typeof EdgeType)[keyof typeof EdgeType];

/** Options for `Envelope.elide`. */
declare interface ElideOptions {
    /** Obscure these elements (by digest). */
    removing?: Iterable<DigestProvider | Digest>;
    /** Obscure everything except these elements and their ancestors. */
    revealing?: Iterable<DigestProvider | Digest>;
    /** What to do to the targeted elements; `"elide"` by default. */
    action?: ObscureAction;
}

/** Options for `Envelope.encryptSubject` and `encrypt`. */
declare interface EncryptOptions extends RngOptions {
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
declare class Envelope implements DigestProvider {
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
declare type EnvelopeCase = {
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
declare type EnvelopeInput = ToEnvelope | string | number | boolean | bigint | Uint8Array | Date | null | Envelope | KnownValue | ToCbor;

/**
 * Actions that can be performed on parts of an envelope to obscure them.
 *
 * Gordian Envelope supports several ways to obscure parts of an envelope while
 * maintaining its semantic integrity and digest tree.
 */
declare type ObscureAction = "elide" | "compress" | {
    /** Encrypt with this key instead of eliding. */
    encrypt: SymmetricKey;
};

/** How an obscured element was obscured. */
declare const ObscureType: {
    /** Replaced by its digest. */
    readonly Elided: "elided";
    /** Replaced by an `EncryptedMessage` of its CBOR. */
    readonly Encrypted: "encrypted";
    /** Replaced by a `Compressed` of its CBOR. */
    readonly Compressed: "compressed";
};

/** One of the `ObscureType` values. */
declare type ObscureType = (typeof ObscureType)[keyof typeof ObscureType];

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

/** Options for `Envelope.addSalt`. */
declare interface SaltOptions {
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

export declare namespace t {
    export { RecipientOptions, addRecipient, decryptSubjectToRecipient, decryptToRecipient, encryptSubjectToRecipient, encryptSubjectToRecipients, encryptToRecipients, recipients };
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
declare interface ToEnvelope {
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
declare type Visitor<State> = (envelope: Envelope, level: number, incomingEdge: EdgeType, state: State) => [State, boolean];

export { }
