import { Cbor } from '@blockchaincommons/dcbor';
import { CborCodec } from '@blockchaincommons/dcbor';
import { CborMap } from '@blockchaincommons/dcbor';
import { Compressed } from '@blockchaincommons/components';
import { Digest } from '@blockchaincommons/components';
import { EncryptedMessage } from '@blockchaincommons/components';
import { KnownValue } from '@blockchaincommons/known-values';
import { Nonce } from '@blockchaincommons/components';
import { RandomNumberGenerator } from '@blockchaincommons/rand';
import { RngOptions } from '@blockchaincommons/rand';
import { Salt } from '@blockchaincommons/components';
import { Signature } from '@blockchaincommons/components';
import { Signer } from '@blockchaincommons/components';
import { SigningOptions } from '@blockchaincommons/components';
import { SymmetricKey } from '@blockchaincommons/components';
import { Tag } from '@blockchaincommons/dcbor';
import { ToCbor } from '@blockchaincommons/dcbor';
import { UR } from '@blockchaincommons/uniform-resources';
import { Verifier } from '@blockchaincommons/components';

/** Options for `Envelope.addAssertion` and friends. */
declare interface AddAssertionOptions {
    /** Also salt the assertion (see `addSalt`) so its digest is not correlatable. */
    salt?: boolean;
}

/**
 * Adds a `signed` assertion: a signature over the subject's digest, with
 * `metadata` bound to it when given.
 */
export declare function addSignature(envelope: Envelope, signer: Signer, { signing: options, metadata }?: SignOptions): Envelope;

/** `addSignature` for each signer, each with its own options when given as `{ signer, ...options }`. */
export declare function addSignatures(envelope: Envelope, signers: readonly (Signer | ({
    signer: Signer;
} & SignOptions))[]): Envelope;

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
     * @throws EnvelopeError with code `InvalidAssertion` when the CBOR is not
     *   a single-element map; `Cbor` (`dcbor error: <Display>`) when the key
     *   or the value is not an envelope
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
     * @throws EnvelopeError with code `InvalidAssertion` when the map does not
     *   have exactly one entry; `Cbor` (`dcbor error: <Display>`) when the key
     *   or the value is not an envelope
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
    /** Tagged-CBOR codec; `decode` requires tag 200 (`fromCbor`), like every codec in the stack. */
    static get codec(): CborCodec<Envelope>;
    /** The envelope tag (200). */
    cborTags(): Tag[];
    /** As `ur:envelope/…`. */
    toUR(): UR;
    /**
     * Decodes an envelope from its tagged CBOR (tag 200): the reference's
     * `TryFrom<CBOR>` / `from_tagged_cbor`.
     *
     * @throws EnvelopeError with code `Cbor` whose message is the dcbor
     *   Display and whose `cause` is the `CborError`: `WrongType` for an
     *   untagged value, `WrongTag` for another tag (the expected tag named as
     *   the global tags store names it), else what `fromUntaggedCbor` reports.
     */
    static fromCbor(cbor: Cbor): Envelope;
    /**
     * Decodes an envelope from tagged CBOR bytes: the reference's
     * `try_from_cbor_data`.
     *
     * @throws EnvelopeError with code `Cbor` whose message is the dcbor Display
     *   of the byte-level failure (`early end of CBOR data`, `the decoded CBOR
     *   had 1 extra bytes at the end`, `a CBOR numeric value was encoded in
     *   non-canonical form`, …) and whose `cause` is the `CborError`; then as
     *   `fromCbor`.
     */
    static fromBytes(data: Uint8Array): Envelope;
    /**
     * Decodes an envelope from its untagged CBOR (the content of tag 200): the
     * reference's `from_untagged_cbor`. A tag-24 or tag-201 value is a leaf, a
     * tag-200 value a wrapped envelope, tag 40002 an encrypted message, tag
     * 40003 a compressed value, a 32-byte string an elided envelope, an array
     * a node, a single-element map an assertion and an unsigned integer a
     * known value.
     *
     * @throws EnvelopeError with code `Cbor` whose message is the dcbor Display
     *   the reference returns and whose `cause` is the `CborError`: the dcbor
     *   error of a malformed component as it is, else `Custom` with the
     *   reference's text (`unknown envelope tag: <n>`, `invalid digest size:
     *   expected 32, got <n>`, `node must have at least two elements`,
     *   `invalid format`, `assertion must be a map with exactly one element`,
     *   `a digest was expected but not found`, `invalid envelope`). A failure
     *   inside an assertion's key or value nests as `dcbor error: <message>`.
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
     * (5–25 %, at least 8 bytes; the reference's `add_salt_using`); give
     * `length` (`add_salt_with_len_using`), a `range`
     * (`add_salt_in_range_using`), or the exact `salt` (`add_salt_instance`)
     * instead. `rng` overrides the secure default. The salt itself comes from
     * components' `Salt`, whose checks the reference's `Salt::new_*` make.
     *
     * @throws EnvelopeError with code `InvalidParameter` for a length or bound
     *   that is not a non-negative integer; `Components` (the components
     *   message, e.g. `data too short: salt expected at least 8, got 7`) for a
     *   length below 8 or a bound the reference rejects.
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
    /** The subject extracted with `decoder` (`extract_subject`), or `undefined` when it cannot be. */
    private trySubject;
    /** `true` when the subject is the boolean `false` (the reference's `is_false`: subject extraction, so a node whose subject is `false` qualifies). */
    isFalse(): boolean;
    /** `true` when the subject is the boolean `true` (the reference's `is_true`). */
    isTrue(): boolean;
    /** `true` when the subject is a boolean (the reference's `is_bool`). */
    isBool(): boolean;
    /** `true` when the envelope is a number leaf. */
    isNumber(): boolean;
    /** `true` when the envelope is a node whose subject is a number. */
    isSubjectNumber(): boolean;
    /** `true` when the envelope is the `NaN` leaf. */
    isNaN(): boolean;
    /** `true` when the envelope is a node whose subject is `NaN`. */
    isSubjectNaN(): boolean;
    /** `true` when the subject is `null` (the reference's `is_null`: subject extraction). */
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
     * Adds a `'position'` assertion with the given ordinal (the reference's
     * `set_position(usize)`): a non-negative safe integer `number`, or a
     * `bigint` in `0 ..= 2⁶⁴ − 1` for the exact form.
     *
     * @throws EnvelopeError with code `InvalidParameter` for any other value;
     *   `InvalidFormat` when the envelope already has several positions.
     */
    setPosition(position: number | bigint): Envelope;
    /**
     * The value of the `'position'` assertion (the reference's `position()`,
     * `extract_subject::<usize>()`): a `number` when at most `2⁵³ − 1`, a
     * `bigint` otherwise. A negative integer wraps to `2⁶⁴ + n`, as the
     * reference's `usize::try_from(CBOR)` wraps it.
     *
     * @throws EnvelopeError with code `NonexistentPredicate` /
     *   `AmbiguousPredicate` when there is not exactly one position; `Cbor`
     *   (`dcbor error: <Display>`) when its object is not an integer in range.
     */
    position(): number | bigint;
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
     * The leaf's CBOR: the reference's `try_leaf()`.
     *
     * @throws EnvelopeError with code `NotLeaf` when the envelope is not a leaf.
     */
    expectLeaf(): Cbor;
    /**
     * The leaf's text: the reference's `String::try_from(envelope)`.
     *
     * @throws EnvelopeError with code `NotLeaf` when the envelope is not a leaf;
     *   `Cbor` (`dcbor error: <Display>`, cause the `CborError`) when the leaf
     *   is not text.
     */
    expectString(): string;
    /**
     * The leaf's number as dcbor's `expectFloat` reads it: the reference's
     * `f64::try_from(envelope)`. An integer the `f64` cannot represent exactly
     * is rejected (`OutOfRange`), as the reference rejects it.
     *
     * @throws EnvelopeError with code `NotLeaf` when the envelope is not a leaf;
     *   `Cbor` (`dcbor error: <Display>`, cause the `CborError`) when the leaf
     *   is not a representable number.
     */
    expectNumber(): number;
    /**
     * The leaf's boolean: the reference's `bool::try_from(envelope)`.
     *
     * @throws EnvelopeError with code `NotLeaf` / `Cbor` as `expectString`.
     */
    expectBoolean(): boolean;
    /**
     * A copy of the leaf's bytes: the reference's `ByteString::try_from(envelope)`.
     *
     * @throws EnvelopeError with code `NotLeaf` / `Cbor` as `expectString`.
     */
    expectBytes(): Uint8Array<ArrayBuffer>;
    /**
     * `null` when the leaf is the `null` value.
     *
     * @throws EnvelopeError with code `NotLeaf` / `Cbor` as `expectString`.
     */
    expectNull(): null;
    /**
     * The subject's tag-1 date as a `Date` (millisecond precision): the
     * reference's `extract_subject::<Date>()` viewed as a `Date`; use
     * `expectSubject(CborDate.fromTaggedCbor)` for the exact value.
     *
     * @throws EnvelopeError as `expectSubject`.
     */
    expectDate(): Date;
    /** `extractSubject` as a method: the reference's `extract_subject::<T>()`. */
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
     * subject's CBOR, the digest as AAD): the reference's `encrypt_subject`.
     *
     * @throws EnvelopeError with code `AlreadyEncrypted` when the subject is
     *   encrypted or compressed; `AlreadyElided` when it is elided.
     */
    encryptSubject(key: SymmetricKey, options?: EncryptOptions): Envelope;
    /**
     * A copy with the subject decrypted by `key` (the reference's
     * `decrypt_subject`).
     *
     * @throws EnvelopeError with code `NotEncrypted` when the subject is not
     *   encrypted; `Components` (`components error: <Display>`) when the key
     *   does not open it; `Cbor` (`dcbor error: <Display>`) when the plaintext
     *   is not an envelope; `MissingDigest` / `InvalidDigest` on a digest
     *   mismatch.
     */
    decryptSubject(key: SymmetricKey): Envelope;
    /** Wraps this envelope and encrypts the wrapper's subject, so the whole envelope is hidden. */
    encrypt(key: SymmetricKey, options?: EncryptOptions): Envelope;
    /** Decrypts a subject encrypted with `encrypt` and unwraps it. */
    decrypt(key: SymmetricKey): Envelope;
    /** `true` when the envelope is encrypted. */
    isEncrypted(): boolean;
    /**
     * A copy compressed (deflate over its CBOR): the reference's `compress`;
     * this envelope when already compressed.
     *
     * @throws EnvelopeError with code `AlreadyEncrypted` when the envelope is
     *   encrypted; `AlreadyElided` when it is elided.
     */
    compress(): Envelope;
    /**
     * A copy decompressed (the reference's `decompress`).
     *
     * @throws EnvelopeError with code `NotCompressed` when the envelope is not
     *   compressed; `Components` (`components error: <Display>`) for a corrupt
     *   stream; `Cbor` (`dcbor error: <Display>`) when the data is not an
     *   envelope; `MissingDigest` / `InvalidDigest` on a digest mismatch.
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

/** Returns whether the given signature is valid. */
export declare function isVerifiedSignature(envelope: Envelope, signature: Signature, verifier: Verifier): boolean;

/** Convenience constructor for a `'signed': Signature` assertion envelope. */
export declare function makeSignedAssertion(_envelope: Envelope, signature: Signature, note?: string): Envelope;

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

/** Options for `Envelope.addSalt`. */
declare interface SaltOptions {
    /** Use exactly this salt, whatever its length. */
    salt?: Salt | Uint8Array;
    /** Random salt of exactly this many bytes (the reference requires at least 8). */
    length?: number;
    /** Random salt of a length in this inclusive range (the reference requires `min` of at least 8 and `max` of at least `min`). */
    range?: {
        /** Smallest length. */
        min: number;
        /** Largest length. */
        max: number;
    };
    /** Randomness source; secure by default. */
    rng?: RandomNumberGenerator;
}

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

export declare namespace t {
    export { SignOptions, SignatureMetadata, addSignature, addSignatures, hasSignatureFrom, hasSignatureFromReturningMetadata, hasSignaturesFrom, hasSignaturesFromThreshold, isVerifiedSignature, makeSignedAssertion, sign, signatures, verify, verifyReturningMetadata, verifySignature, verifySignatureFrom, verifySignatureFromReturningMetadata, verifySignaturesFrom, verifySignaturesFromThreshold };
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
declare type Visitor<State> = (envelope: Envelope, level: number, incomingEdge: EdgeType, state: State) => [State, boolean];

export { }
