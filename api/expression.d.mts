import { ARID } from '@blockchaincommons/components';
import { Compressed } from '@blockchaincommons/components';
import { Digest } from '@blockchaincommons/components';
import { EncryptedMessage } from '@blockchaincommons/components';
import { KnownValue } from '@blockchaincommons/known-values';
import { RandomNumberGenerator } from '@blockchaincommons/rand';
import { Salt } from '@blockchaincommons/components';
import { SymmetricKey } from '@blockchaincommons/components';
import { UR } from '@blockchaincommons/uniform-resources';

/** Standard arithmetic and logical functions */
export declare const ADD: Function_2;

/** Creates an addition expression: lhs + rhs */
export declare function add(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

/** Raw value constants (matching Rust's _VALUE suffix constants) */
export declare const ADD_VALUE: number;

/** Options for `Envelope.addAssertion` and friends. */
declare interface AddAssertionOptions {
    /** Also salt the assertion (see `addSalt`) so its digest is not correlatable. */
    salt?: boolean;
}

export declare const AND: Function_2;

/** Creates a logical AND expression: lhs && rhs */
export declare function and(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

export declare const AND_VALUE: number;

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
    /**
     * Creates a copy of this assertion.
     *
     * Since assertions are immutable and envelopes are cheap to clone,
     * this returns the same instance.
     *
     * @returns This assertion instance
     */
    clone(): Assertion;
}

/** Standard parameters */
export declare const BLANK: Parameter;

/** Raw value constants */
export declare const BLANK_VALUE: number;

/**
 * Represents a CBOR byte string (major type 2).
 *
 * Use Cases:
 * - Binary data such as images, audio, or other non-text content
 * - Cryptographic values like hashes, signatures, and public keys
 * - Embedded CBOR (wrapped with tag 24)
 * - Other serialized data formats embedded in CBOR
 *
 * @example
 * ```typescript
 * // Creating a byte string from various sources
 * const bytes1 = new ByteString(new Uint8Array([1, 2, 3, 4]));
 * const bytes2 = ByteString.from([5, 6, 7, 8]);
 * const bytes3 = ByteString.from(new Uint8Array([9, 10, 11, 12]));
 *
 * // Converting to and from CBOR
 * const cborValue = bytes1.toCbor();
 *
 * // ByteString provides Uint8Array-like operations
 * const bytes = new ByteString(new Uint8Array([1, 2]));
 * bytes.extend(new Uint8Array([3, 4]));
 * assert(bytes.byteLength === 4);
 * assert.deepEqual(bytes.bytes, new Uint8Array([1, 2, 3, 4]));
 * ```
 */
declare class ByteString {
    /** Debug label: `Object.prototype.toString` reports `[object ByteString]`. */
    get [Symbol.toStringTag](): string;
    private _data;
    /**
     * Creates a new `ByteString` from a Uint8Array or array of bytes.
     *
     * @param data - The byte data
     *
     * @example
     * ```typescript
     * // From a Uint8Array
     * const bytes1 = new ByteString(new Uint8Array([1, 2, 3, 4]));
     *
     * // From a number array
     * const bytes2 = new ByteString(new Uint8Array([5, 6, 7, 8]));
     * ```
     */
    constructor(data: Uint8Array | number[]);
    /**
     * Creates a new `ByteString` from various input types.
     *
     * @param data - Uint8Array, number array, or string
     * @returns New ByteString instance
     *
     * @example
     * ```typescript
     * const bytes1 = ByteString.from([1, 2, 3, 4]);
     * const bytes2 = ByteString.from(new Uint8Array([5, 6, 7, 8]));
     * const bytes3 = ByteString.from("hello");
     * ```
     */
    static from(data: Uint8Array | number[] | string): ByteString;
    /**
     * Returns a reference to the underlying byte data.
     *
     * @returns The raw bytes
     *
     * @example
     * ```typescript
     * const bytes = new ByteString(new Uint8Array([1, 2, 3, 4]));
     * assert.deepEqual(bytes.bytes, new Uint8Array([1, 2, 3, 4]));
     *
     * // You can use standard slice operations on the result
     * assert.deepEqual(bytes.bytes.slice(1, 3), new Uint8Array([2, 3]));
     * ```
     */
    /**
     * The underlying byte data (LIVE reference - mutations are visible to the
     * ByteString; use `toUint8Array()` for a copy).
     */
    get bytes(): Uint8Array;
    /** The length of the byte string in bytes (typed-array vocabulary). */
    get byteLength(): number;
    /**
     * Extends the byte string with additional bytes.
     *
     * @param other - Bytes to append
     *
     * @example
     * ```typescript
     * const bytes = new ByteString(new Uint8Array([1, 2]));
     * bytes.extend(new Uint8Array([3, 4]));
     * assert.deepEqual(bytes.bytes, new Uint8Array([1, 2, 3, 4]));
     *
     * // You can extend with different types
     * bytes.extend([5, 6]);
     * assert.deepEqual(bytes.bytes, new Uint8Array([1, 2, 3, 4, 5, 6]));
     * ```
     */
    extend(other: Uint8Array | number[]): void;
    /**
     * Creates a new Uint8Array containing a copy of the byte string's data.
     *
     * @returns Copy of the data
     *
     * @example
     * ```typescript
     * const bytes = new ByteString(new Uint8Array([1, 2, 3, 4]));
     * const arr = bytes.toUint8Array();
     * assert.deepEqual(arr, new Uint8Array([1, 2, 3, 4]));
     *
     * // The returned array is a clone, so you can modify it independently
     * const arr2 = bytes.toUint8Array();
     * arr2[0] = 99;
     * assert.deepEqual(bytes.bytes, new Uint8Array([1, 2, 3, 4])); // original unchanged
     * ```
     */
    toUint8Array(): Uint8Array<ArrayBuffer>;
    /** Iterate the bytes. */
    [Symbol.iterator](): Iterator<number>;
    /**
     * Converts the ByteString to a CBOR value.
     *
     * @returns CBOR byte string
     *
     * @example
     * ```typescript
     * const bytes = new ByteString(new Uint8Array([1, 2, 3, 4]));
     * const cborValue = bytes.toCbor();
     * ```
     */
    toCbor(): Cbor;
    /**
     * Create a ByteString from a hex string. Inherits `hexToBytes`'s
     * validation: whitespace-tolerant, but throws `CborError` `Custom` on odd
     * length or non-hex characters.
     */
    static fromHex(hex: string): ByteString;
    /** Render the bytes as lowercase hex. */
    toHex(): string;
    /**
     * Attempts to convert a CBOR value into a ByteString.
     *
     * @param cbor - CBOR value
     * @returns ByteString if successful
     * @throws Error if the CBOR value is not a byte string
     *
     * @example
     * ```typescript
     * const cborValue = toCbor(new Uint8Array([1, 2, 3, 4]));
     * const bytes = ByteString.fromCbor(cborValue);
     * assert.deepEqual(bytes.bytes, new Uint8Array([1, 2, 3, 4]));
     *
     * // Converting from a different CBOR type throws
     * const cborInt = toCbor(42);
     * try {
     *   ByteString.fromCbor(cborInt); // throws
     * } catch(e) {
     *   // Error: Wrong type
     * }
     * ```
     */
    static fromCbor(cbor: Cbor): ByteString;
    /**
     * Get element at index.
     *
     * @param index - Index to access
     * @returns Byte at index or undefined
     */
    at(index: number): number | undefined;
    /**
     * Equality comparison.
     *
     * @param other - ByteString to compare with
     * @returns true if equal
     */
    equals(other: ByteString): boolean;
    /**
     * Clone this ByteString.
     *
     * @returns New ByteString with copied data
     */
    clone(): ByteString;
}

/**
 * A decoded/constructed CBOR value: one of the eight major-type shapes, with
 * the (deliberately tiny) instance-method set from {@link CborMethods}
 * attached. The constituent interfaces live in ./cbor-types.
 *
 * This is a TYPE-ONLY export. Construct values with `cbor(x)` and decode with
 * `decodeCbor(bytes)`.
 */
declare type Cbor = (CborUnsignedType | CborNegativeType | CborByteStringType | CborTextType | CborArrayType | CborMapType | CborTaggedType | CborSimpleType) & CborMethods;

/** CBOR tag for function identifiers */
export declare const CBOR_TAG_FUNCTION = 40006;

/** CBOR tag for parameter identifiers */
export declare const CBOR_TAG_PARAMETER = 40007;

/** CBOR tag for placeholder identifiers */
export declare const CBOR_TAG_PLACEHOLDER = 40008;

/** CBOR tag for replacement identifiers */
export declare const CBOR_TAG_REPLACEMENT = 40009;

declare interface CborArrayType {
    readonly isCbor: true;
    readonly type: typeof MajorType.Array;
    readonly value: readonly Cbor[];
}

declare interface CborByteStringType {
    readonly isCbor: true;
    readonly type: typeof MajorType.ByteString;
    /**
     * The byte-string content. For DECODED values this is a zero-copy view
     * aliasing the input buffer passed to `decodeCbor` - call `.slice()`
     * before mutating either side, since this deliberately does not copy.
     */
    readonly value: Uint8Array;
}

/**
 * A two-way codec binding a TypeScript type `T` to its CBOR representation.
 * The codec value is the runtime witness that justifies the generic in
 * {@link decodeWith} - no unwitnessed casts.
 *
 * Ship-with exemplar: `CborDate.codec`.
 *
 * @beta
 */
declare interface CborCodec<T> {
    /** The tags this codec's encoding carries, if any (informational). */
    readonly tags?: readonly Tag[] | undefined;
    /**
     * Convert a decoded CBOR value to `T`.
     * @throws {CborError} on shape/tag mismatch.
     */
    decode(cbor: Cbor): T;
    /** Convert a `T` back to CBOR. */
    encode(value: T): Cbor;
}

declare class CborDate implements CborTagged {
    /** Debug label: `Object.prototype.toString` reports `[object CborDate]`. */
    get [Symbol.toStringTag](): string;
    /**
     * Canonical timestamp in seconds since the Unix epoch as a JS `number`
     * (`f64`). dCBOR encodes Date (tag 1) as a numeric value in seconds, so
     * keeping `_seconds` as the source of truth avoids the millisecond-only
     * round-trip precision loss that going through a JS `Date` instance would
     * introduce.
     *
     * f64 bounds the achievable precision (~16 decimal digits, so roughly
     * microseconds for current epoch values), but the encode/decode round-trip
     * is byte-identical.
     */
    private _seconds;
    /**
     * Creates a new `CborDate` from the given JavaScript `Date`.
     *
     * This method creates a new `CborDate` instance by wrapping a
     * JavaScript `Date`.
     *
     * @param dateTime - A `Date` instance to wrap
     *
     * @returns A new `CborDate` instance
     *
     * @example
     * ```typescript
     * const datetime = new Date();
     * const date = CborDate.fromDate(datetime);
     * ```
     */
    static fromDate(dateTime: Date): CborDate;
    /**
     * Creates a new `CborDate` from year, month, and day components.
     *
     * This method creates a new `CborDate` with the time set to 00:00:00 UTC.
     *
     * @param year - The year component (e.g., 2023)
     * @param month - The month component (1-12)
     * @param day - The day component (1-31)
     *
     * @returns A new `CborDate` instance
     *
     * @example
     * ```typescript
     * // Create February 8, 2023
     * const date = CborDate.fromYmd(2023, 2, 8);
     * ```
     *
     * @throws Error if the provided components do not form a valid date.
     */
    static fromYmd(year: number, month: number, day: number): CborDate;
    /**
     * Creates a new `CborDate` from year, month, day, hour, minute, and second
     * components.
     *
     * @param year - The year component (e.g., 2023)
     * @param month - The month component (1-12)
     * @param day - The day component (1-31)
     * @param hour - The hour component (0-23)
     * @param minute - The minute component (0-59)
     * @param second - The second component (0-59)
     *
     * @returns A new `CborDate` instance
     *
     * @example
     * ```typescript
     * // Create February 8, 2023, 15:30:45 UTC
     * const date = CborDate.fromYmdHms(2023, 2, 8, 15, 30, 45);
     * ```
     *
     * @throws Error if the provided components do not form a valid date and time.
     */
    static fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): CborDate;
    /**
     * Creates a new `CborDate` from seconds since (or before) the Unix epoch.
     *
     * This method creates a new `CborDate` representing the specified number of
     * seconds since the Unix epoch (1970-01-01T00:00:00Z). Negative values
     * represent times before the epoch.
     *
     * @param secondsSinceUnixEpoch - Seconds from the Unix epoch (positive or
     *   negative), which can include a fractional part for sub-second
     *   precision
     *
     * @returns A new `CborDate` instance
     *
     * @example
     * ```typescript
     * // Create a date from a timestamp
     * const date = CborDate.fromEpochSeconds(1675854714.0);
     *
     * // Create a date one second before the Unix epoch
     * const beforeEpoch = CborDate.fromEpochSeconds(-1.0);
     *
     * // Create a date with fractional seconds
     * const withFraction = CborDate.fromEpochSeconds(1675854714.5);
     * ```
     */
    static fromEpochSeconds(secondsSinceUnixEpoch: number): CborDate;
    /**
     * Creates a new `CborDate` from a string containing an ISO-8601 (RFC-3339)
     * date (with or without time).
     *
     * This method parses a string representation of a date or date-time in
     * ISO-8601/RFC-3339 format and creates a new `CborDate` instance. It
     * supports both full date-time strings (e.g., "2023-02-08T15:30:45Z")
     * and date-only strings (e.g., "2023-02-08").
     *
     * @param value - A string containing a date or date-time in ISO-8601/RFC-3339
     *   format
     *
     * @returns A new `CborDate` instance if parsing succeeds
     *
     * @throws Error if the string cannot be parsed as a valid date or date-time
     *
     * @example
     * ```typescript
     * // Parse a date-time string
     * const date = CborDate.fromString("2023-02-08T15:30:45Z");
     *
     * // Parse a date-only string (time will be set to 00:00:00)
     * const date2 = CborDate.fromString("2023-02-08");
     * ```
     */
    static fromString(value: string): CborDate;
    /**
     * Creates a new `CborDate` containing the current date and time.
     *
     * @returns A new `CborDate` instance representing the current UTC date and time
     *
     * @example
     * ```typescript
     * const now = CborDate.now();
     * ```
     */
    static now(): CborDate;
    /**
     * Creates a new `CborDate` containing the current date and time plus the given
     * duration.
     *
     * @param durationMs - The duration in milliseconds to add to the current time
     *
     * @returns A new `CborDate` instance representing the current UTC date and time plus
     * the duration
     *
     * @example
     * ```typescript
     * // Get a date 1 hour from now
     * const oneHourLater = CborDate.withDurationFromNow(3600 * 1000);
     * ```
     */
    static withDurationFromNow(durationMs: number): CborDate;
    /**
     * Returns the underlying JavaScript `Date` object.
     *
     * This method provides access to the wrapped JavaScript `Date`
     * instance.
     *
     * @returns The wrapped `Date` instance
     *
     * @example
     * ```typescript
     * const date = CborDate.now();
     * const datetime = date.toDate();
     * const year = datetime.getFullYear();
     * ```
     */
    toDate(): Date;
    /**
     * The date as the number of seconds since the Unix epoch
     * (1970-01-01T00:00:00Z), as a floating-point `number`. Negative values
     * represent times before the epoch; the fractional part is sub-second
     * precision.
     *
     * @example
     * ```typescript
     * const date = CborDate.fromYmd(2023, 2, 8);
     * const timestamp = date.epochSeconds;
     * ```
     */
    get epochSeconds(): number;
    /**
     * Add seconds to this date.
     *
     * @param seconds - Seconds to add (can be fractional)
     * @returns New CborDate instance
     *
     * @example
     * ```typescript
     * const date = CborDate.fromYmd(2022, 3, 21);
     * const tomorrow = date.add(24 * 60 * 60);
     * ```
     */
    add(seconds: number): CborDate;
    /**
     * Subtract seconds from this date.
     *
     * @param seconds - Seconds to subtract (can be fractional)
     * @returns New CborDate instance
     *
     * @example
     * ```typescript
     * const date = CborDate.fromYmd(2022, 3, 21);
     * const yesterday = date.subtract(24 * 60 * 60);
     * ```
     */
    subtract(seconds: number): CborDate;
    /**
     * Get the difference in seconds between this date and another.
     *
     * @param other - Other CborDate to compare with
     * @returns Difference in seconds (this - other)
     *
     * @example
     * ```typescript
     * const date1 = CborDate.fromYmd(2022, 3, 22);
     * const date2 = CborDate.fromYmd(2022, 3, 21);
     * const diff = date1.difference(date2);
     * // Returns 86400 (one day in seconds)
     * ```
     */
    difference(other: CborDate): number;
    /**
     * Implementation of the `CborTagged` interface for `CborDate`.
     *
     * This implementation specifies that `CborDate` values are tagged with CBOR tag 1,
     * which is the standard CBOR tag for date/time values represented as seconds
     * since the Unix epoch per RFC 8949.
     *
     * @returns A vector containing tag 1
     */
    cborTags(): Tag[];
    /**
     * Converts this `CborDate` to its untagged CBOR content: the epoch-seconds
     * numeric value. It may be an integer or a floating-point number,
     * depending on whether the date has fractional seconds.
     *
     * @returns A CBOR value representing the timestamp
     */
    untaggedCbor(): Cbor;
    /**
     * Converts this `CborDate` to a tagged CBOR value with tag 1.
     *
     * @returns Tagged CBOR value
     */
    taggedCbor(): Cbor;
    /**
     * The `ToCbor` protocol: dates encode as their tagged form.
     */
    toCbor(): Cbor;
    /**
     * Populates this `CborDate` in place from an untagged CBOR value, which
     * must be a number (integer or floating-point) of seconds since the Unix
     * epoch. The static `CborDate.fromUntaggedCbor` is the usual entry point;
     * this instance form exists for reuse.
     *
     * @param cbor - The untagged CBOR value
     *
     * @returns this (populated in place)
     *
     * @throws Error if the CBOR value is not a valid timestamp
     */
    fromUntaggedCbor(cbor: Cbor): CborDate;
    /**
     * Populates this `CborDate` in place from a tag-1 CBOR value.
     *
     * @param cbor - Tagged CBOR value
     *
     * @returns this (populated in place)
     *
     * @throws Error if the CBOR value has the wrong tag or cannot be decoded
     */
    fromTaggedCbor(cbor: Cbor): CborDate;
    /**
     * Static method to create a CborDate from tagged CBOR.
     *
     * @param cbor - Tagged CBOR value
     * @returns New CborDate instance
     */
    static fromTaggedCbor(cbor: Cbor): CborDate;
    /**
     * The {@link CborCodec} exemplar: a runtime witness that binds
     * `T = CborDate` for `decodeWith(bytes, CborDate.codec)`.
     *
     * A lazy getter (memoized) rather than a static field: the date ↔ tags
     * module cycle makes an eager initializer hit the temporal dead zone.
     *
     * @beta
     */
    static get codec(): CborCodec<CborDate>;
    static fromUntaggedCbor(cbor: Cbor): CborDate;
    /**
     * Implementation of the `toString` method for `CborDate`.
     *
     * This implementation provides a string representation of a `CborDate` in ISO-8601
     * format. For dates with time exactly at midnight (00:00:00), only the date
     * part is shown. For other times, a full date-time string is shown.
     *
     * @returns String representation in ISO-8601 format
     *
     * @example
     * ```typescript
     * // A date at midnight will display as just the date
     * const date = CborDate.fromYmd(2023, 2, 8);
     * // Returns "2023-02-08"
     * console.log(date.toString());
     *
     * // A date with time will display as date and time
     * const date2 = CborDate.fromYmdHms(2023, 2, 8, 15, 30, 45);
     * // Returns "2023-02-08T15:30:45.000Z"
     * console.log(date2.toString());
     * ```
     */
    toString(): string;
    /**
     * Compare two dates for equality.
     *
     * @param other - Other CborDate to compare
     * @returns true if dates represent the same moment in time
     */
    equals(other: CborDate): boolean;
    /**
     * Compare two dates.
     *
     * @param other - Other CborDate to compare
     * @returns -1 if this < other, 0 if equal, 1 if this > other
     */
    compare(other: CborDate): number;
    /**
     * Convert to JSON (returns ISO 8601 string).
     *
     * @returns ISO 8601 string
     */
    toJSON(): string;
    private constructor();
}

/** Type for CBOR decoder functions */
declare type CborDecoder<T> = (cbor: Cbor) => T;

/**
 * Type for values that can be converted to CBOR.
 *
 * This is a comprehensive union type representing all values that can be encoded
 * as CBOR using the `cbor()` function. It includes:
 * - Already-encoded CBOR values (`Cbor`)
 * - Primitive types: numbers, bigints, strings, booleans, null, undefined
 * - Binary data: `Uint8Array`, `ByteString`
 * - Dates: `CborDate`
 * - Collections: `CborMap`, arrays, JavaScript `Map`, JavaScript `Set`
 * - Objects: Plain objects are converted to CBOR maps
 *
 * @example
 * ```typescript
 * cbor(42);                              // number
 * cbor("hello");                         // string
 * cbor([1, 2, 3]);                       // array
 * cbor(new Map([["key", "value"]]));     // Map
 * cbor({ name: "Alice", age: 30 });      // plain object -> CborMap
 * ```
 */
declare type CborInput = Cbor | CborNumber | string | boolean | null | undefined | Uint8Array | ByteString | CborDate | CborMap | readonly CborInput[] | ReadonlyMap<CborInput, CborInput> | ReadonlySet<CborInput> | ToCbor | {
    readonly [key: string]: CborInput;
};

/**
 * A deterministic CBOR map implementation.
 *
 * Maps are always encoded with keys sorted lexicographically by their
 * encoded CBOR representation, ensuring deterministic encoding.
 */
declare class CborMap {
    /** Debug label: `Object.prototype.toString` reports `[object CborMap]`. */
    get [Symbol.toStringTag](): string;
    private _dict;
    /**
     * Creates a new, empty CBOR Map.
     * Optionally initializes from a JavaScript Map (every key and value must
     * itself be encodable).
     */
    constructor(map?: ReadonlyMap<CborInput, CborInput>);
    /**
     * Inserts a key-value pair into the map (replacing any entry whose key has
     * the same canonical encoding). Any insertion order is accepted - entries
     * are kept in canonical ascending encoded-key order.
     *
     * @example
     * ```typescript
     * const m = new CborMap();
     * m.set("z", 1);
     * m.set(10, "ten"); // sorts before "z" in the encoding
     * encodeCbor(m);    // deterministic regardless of insertion order
     * ```
     * @public
     */
    set(key: CborInput, value: CborInput): void;
    private _makeKey;
    /**
     * Get the STORED `Cbor` node for a key, or `undefined` if absent.
     *
     * This is symmetric with `entries()` - no hidden native extraction, no
     * unwitnessed generics. To read a native value, compose explicitly:
     *
     * ```typescript
     * asNumber(map.get("age"));          // number | undefined, checked
     * extractCbor(map.getOrThrow("age")); // CborNative, throws if absent
     * ```
     * @public
     */
    get(key: CborInput): Cbor | undefined;
    /**
     * Get the stored `Cbor` node for a key.
     *
     * @throws {CborError} `MissingMapKey` - the key is not present.
     */
    getOrThrow(key: CborInput): Cbor;
    delete(key: CborInput): boolean;
    has(key: CborInput): boolean;
    clear(): void;
    /** The number of entries in the map. */
    get size(): number;
    /**
     * Get the entries of the map as an array, sorted in canonical ascending
     * encoded-key order.
     *
     * @internal Public because the encoder, diagnostic formatter, and hex
     * annotator consume it cross-module; not part of the supported surface.
     */
    get entriesArray(): MapEntry[];
    /** Iterate keys in canonical (sorted encoded-key) order. */
    keys(): Generator<Cbor, void, undefined>;
    /** Iterate values in canonical key order. */
    values(): Generator<Cbor, void, undefined>;
    /**
     * Iterate `[key, value]` tuples in canonical key order (the JS
     * `Map.entries()` shape).
     */
    entries(): Generator<[Cbor, Cbor], void, undefined>;
    /** JS `Map.forEach` mirror (value first, then key, then the map). */
    forEach(callback: (value: Cbor, key: Cbor, map: CborMap) => void, thisArg?: unknown): void;
    [Symbol.iterator](): Generator<[Cbor, Cbor], void, undefined>;
    /**
     * Inserts the next key-value pair into the map during decoding.
     * This is used for efficient map building during CBOR decoding.
     * Throws if the key is not in ascending order or is a duplicate.
     *
     * @internal The decoder's append path; not part of the supported surface.
     */
    setNext(key: CborInput, value: CborInput): void;
    /**
     * Convert to a plain JavaScript `Map` of extracted native values.
     * Tagged values come back as `Cbor` nodes and nested maps as `CborMap`
     * (the {@link CborNative} asymmetries).
     */
    toMap(): Map<CborNative, CborNative>;
}

declare interface CborMapType {
    readonly isCbor: true;
    readonly type: typeof MajorType.Map;
    readonly value: CborMap;
}

/**
 * The instance methods every `Cbor` value carries.
 *
 * Exactly three cheap conveniences; everything else is a free function.
 */
declare interface CborMethods {
    /** Encode to deterministic CBOR bytes (same as `encodeCbor(this)`). */
    toData(): Uint8Array<ArrayBuffer>;
    /** Encode and render as lowercase hex. */
    toHex(): string;
    /**
     * Cheap debug string: `Cbor(0x…)` with the encoded hex.
     *
     * For the flat diagnostic form use `diagnostic(c, { flat: true })` from
     * `@blockchaincommons/dcbor/diagnostic`, or `installDebugHooks()` from `@blockchaincommons/dcbor/debug`
     * for diag-flavored console output.
     */
    toString(): string;
}

/**
 * The closed set of values {@link extractCbor} can return.
 *
 * Two deliberate asymmetries are part of this contract:
 *
 * - **Maps stay `CborMap`** - map values are NOT recursively extracted into a
 *   plain object/Map; the stored container is returned as-is.
 * - **Tagged values stay `Cbor`** - a tagged value has no native equivalent,
 *   so the tagged node itself is returned.
 */
declare type CborNative = number | bigint | string | boolean | null | Uint8Array | CborNative[] | CborMap | Cbor;

declare interface CborNegativeType {
    readonly isCbor: true;
    readonly type: typeof MajorType.Negative;
    readonly value: CborNumber;
}

/**
 * Numeric type that can be encoded in CBOR.
 *
 * Supports both standard JavaScript numbers and BigInt for large integers.
 * Numbers are automatically encoded as either unsigned or negative integers
 * depending on their value, following dCBOR canonical encoding rules.
 *
 * @example
 * ```typescript
 * const smallNum: CborNumber = 42;
 * const largeNum: CborNumber = 9007199254740992n;
 * ```
 */
declare type CborNumber = number | bigint;

declare interface CborSimpleType {
    readonly isCbor: true;
    readonly type: typeof MajorType.Simple;
    readonly value: Simple;
}

/**
 * Interface for types that have associated CBOR tags.
 *
 * `cborTags()` returns tags in order of preference: the first is used when
 * encoding; all are accepted when decoding (backward compatibility).
 */
declare interface CborTagged {
    /**
     * Returns the CBOR tags associated with this type, most-preferred first.
     */
    cborTags(): Tag[];
}

declare interface CborTaggedType {
    readonly isCbor: true;
    readonly type: typeof MajorType.Tagged;
    readonly tag: CborNumber;
    readonly value: Cbor;
}

declare interface CborTextType {
    readonly isCbor: true;
    readonly type: typeof MajorType.Text;
    readonly value: string;
}

declare interface CborUnsignedType {
    readonly isCbor: true;
    readonly type: typeof MajorType.Unsigned;
    readonly value: CborNumber;
}

/**
 * Trait for types that can provide a digest.
 *
 * This is equivalent to Rust's `DigestProvider` trait. Types that
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

export declare const DIV: Function_2;

/** Creates a division expression: lhs / rhs */
export declare function div(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

export declare const DIV_VALUE: number;

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
     * **TS↔Rust note**: Rust `Envelope::new_or_none` returns
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
    static node(subject: Envelope, assertions: Envelope[], { unchecked }?: {
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
     * @param envelope - The envelope to wrap
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
     * @param cbor - The untagged CBOR value
     * @returns A new envelope
     */
    static fromUntaggedCbor(cbor: Cbor): Envelope;
    /**
     * Creates an envelope from tagged CBOR.
     *
     * @param cbor - The tagged CBOR value (should have TAG_ENVELOPE)
     * @returns A new envelope
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
    /**
     * Implementation of static false()
     */
    static get FALSE(): Envelope;
    /**
     * Implementation of static true()
     */
    static get TRUE(): Envelope;
    /**
     * Implementation of static unit()
     * Unit envelopes have the known value ''. They represent a position
     * where no meaningful data *can* exist. In this sense they make a
     * semantically stronger assertion than `null`, which represents a
     * position where no meaningful data currently exists, but could exist in
     * the future.
     */
    static get UNIT(): Envelope;
    /**
     * Implementation of addAssertionEnvelopes
     */
    addAssertionEnvelopes(assertions: Envelope[]): Envelope;
    /**
     * Implementation of addOptionalAssertionEnvelope
     */
    addOptionalAssertionEnvelope(assertion: Envelope | undefined, { salt }?: AddAssertionOptions): Envelope;
    /**
     * Implementation of addOptionalAssertion
     */
    addOptionalAssertion(predicate: EnvelopeInput, object: EnvelopeInput | undefined, options?: AddAssertionOptions): Envelope;
    /**
     * Adds a `salt` assertion of random bytes so that this envelope's digest
     * cannot be correlated with another envelope of the same content.
     *
     * By default the salt length is proportional to the envelope's size
     * (5–25 %, at least 8 bytes); give `length`, a `range`, or the exact
     * `salt` instead. `rng` overrides the secure default.
     */
    addSalt({ salt, length, range, rng }?: SaltOptions): Envelope;
    /**
     * Applies `fn` to this envelope: `e.pipe(sign, key).pipe(encryptSubject, k)`
     * chains the subpath functions without the `/all` facade.
     */
    pipe<A extends unknown[], R>(fn: (envelope: Envelope, ...args: A) => R, ...args: A): R;
    /**
     * Implementation of addNonemptyStringAssertion
     */
    addNonemptyStringAssertion(predicate: EnvelopeInput, str: string): Envelope;
    /**
     * Implementation of addAssertions
     */
    addAssertions(envelopes: Envelope[]): Envelope;
    /**
     * Implementation of addAssertionIf
     */
    addAssertionIf(condition: boolean, predicate: EnvelopeInput, object: EnvelopeInput): Envelope;
    /**
     * Implementation of addAssertionEnvelopeIf
     */
    addAssertionEnvelopeIf(condition: boolean, assertionEnvelope: Envelope): Envelope;
    /**
     * Implementation of removeAssertion
     */
    removeAssertion(target: Envelope): Envelope;
    /**
     * Implementation of replaceAssertion
     */
    replaceAssertion(assertion: Envelope, newAssertion: Envelope): Envelope;
    /**
     * Implementation of replaceSubject
     */
    replaceSubject(subject: Envelope): Envelope;
    /**
     * Implementation of assertions
     */
    assertions(): Envelope[];
    /**
     * Implementation of isFalse()
     */
    isFalse(): boolean;
    /**
     * Implementation of isTrue()
     */
    isTrue(): boolean;
    /**
     * Implementation of isBool()
     */
    isBool(): boolean;
    /**
     * Implementation of isNumber()
     */
    isNumber(): boolean;
    /**
     * Implementation of isSubjectNumber()
     */
    isSubjectNumber(): boolean;
    /**
     * Implementation of isCborNaN()
     */
    isNaN(): boolean;
    /**
     * Implementation of isSubjectNaN()
     */
    isSubjectNaN(): boolean;
    /**
     * Implementation of isNull()
     */
    isNull(): boolean;
    /**
     * Implementation of asBytes()
     */
    asBytes(): Uint8Array | undefined;
    /**
     * Implementation of asArray()
     */
    asArray(): readonly Cbor[] | undefined;
    /**
     * Implementation of asMap()
     */
    asMap(): CborMap | undefined;
    /**
     * Implementation of asText()
     */
    asText(): string | undefined;
    /**
     * Implementation of asLeaf()
     */
    asLeaf(): Cbor | undefined;
    /**
     * Implementation of asKnownValue()
     */
    asKnownValue(): KnownValue | undefined;
    /**
     * Implementation of tryKnownValue()
     */
    expectKnownValue(): KnownValue;
    /**
     * Implementation of isKnownValue()
     */
    isKnownValue(): boolean;
    /**
     * Implementation of isSubjectUnit()
     */
    isSubjectUnit(): boolean;
    /**
     * Implementation of checkSubjectUnit()
     */
    checkSubjectUnit(): Envelope;
    /**
     * Implementation of hasAssertions()
     */
    hasAssertions(): boolean;
    /**
     * Implementation of asAssertion()
     */
    asAssertion(): Envelope | undefined;
    /**
     * Implementation of tryAssertion()
     */
    expectAssertion(): Envelope;
    /**
     * Implementation of asPredicate()
     */
    asPredicate(): Envelope | undefined;
    /**
     * Implementation of tryPredicate()
     */
    expectPredicate(): Envelope;
    /**
     * Implementation of asObject()
     */
    asObject(): Envelope | undefined;
    /**
     * Implementation of tryObject()
     */
    expectObject(): Envelope;
    /**
     * Implementation of isAssertion()
     */
    isAssertion(): boolean;
    /**
     * Implementation of isElided()
     */
    isElided(): boolean;
    /**
     * Implementation of isLeaf()
     */
    isLeaf(): boolean;
    /**
     * Implementation of isNode()
     */
    isNode(): boolean;
    /**
     * Implementation of isWrapped()
     */
    isWrapped(): boolean;
    /**
     * Implementation of isInternal()
     */
    isInternal(): boolean;
    /**
     * Implementation of isObscured()
     */
    isObscured(): boolean;
    /**
     * Implementation of assertionsWithPredicate()
     */
    assertionsWithPredicate(predicate: EnvelopeInput): Envelope[];
    /**
     * Implementation of assertionWithPredicate()
     */
    assertionWithPredicate(predicate: EnvelopeInput): Envelope;
    /**
     * Implementation of optionalAssertionWithPredicate()
     */
    optionalAssertionWithPredicate(predicate: EnvelopeInput): Envelope | undefined;
    /**
     * Implementation of objectForPredicate()
     */
    objectForPredicate(predicate: EnvelopeInput): Envelope;
    /**
     * Implementation of optionalObjectForPredicate()
     */
    optionalObjectForPredicate(predicate: EnvelopeInput): Envelope | undefined;
    /**
     * Implementation of objectsForPredicate()
     */
    objectsForPredicate(predicate: EnvelopeInput): Envelope[];
    /**
     * Implementation of elementsCount()
     */
    elementsCount(): number;
    /**
     * Implementation of isSubjectEncrypted()
     */
    isSubjectEncrypted(): boolean;
    /**
     * Implementation of isSubjectCompressed()
     */
    isSubjectCompressed(): boolean;
    /**
     * Implementation of isSubjectElided()
     */
    isSubjectElided(): boolean;
    /**
     * Implementation of setPosition()
     */
    setPosition(position: number): Envelope;
    /**
     * Implementation of position()
     */
    position(): number;
    /**
     * Implementation of removePosition()
     */
    removePosition(): Envelope;
    /**
     * Implementation of wrap()
     */
    wrap(): Envelope;
    /**
     * Implementation of tryUnwrap()
     */
    unwrap(): Envelope;
    /**
     * Implementation of walk()
     */
    walk<State>(hideNodes: boolean, state: State, visit: Visitor<State>): void;
    /**
     * Implementation of digests()
     *
     * Returns the set of digests in the envelope, down to the specified level.
     *
     * Rust uses `HashSet<Digest>` which dedupes by content; native JS `Set`
     * dedupes by reference, so we route inserts through a hex-keyed `Map`
     * before materialising the final `Set`. That keeps the public signature
     * (`Set<Digest>`) while guaranteeing each *value* appears at most once,
     * which is what every consumer of these methods actually wants.
     */
    digests(levelLimit: number): Set<Digest>;
    /**
     * Implementation of deepDigests()
     * Returns all digests in the envelope at all levels.
     */
    deepDigests(): Set<Digest>;
    /**
     * Implementation of shallowDigests()
     * Returns the digests in the envelope down to its second level.
     */
    shallowDigests(): Set<Digest>;
    /**
     * Implementation of structuralDigest()
     *
     * structure mode, building an image:
     *
     * - Each obscured case prepends a 1-byte discriminator: `0` for Encrypted,
     * `1` for Elided, `2` for Compressed (matching the Rust order).
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
    /**
     * Implementation of object() - alias for tryObject()
     */
    object(): Envelope;
    /**
     * Implementation of predicate() - alias for tryPredicate()
     */
    predicate(): Envelope;
    /**
     * Elide this envelope, or with options elide (or encrypt or compress)
     * parts of it: `removing` obscures the elements whose digests are listed,
     * `revealing` obscures everything but the listed elements and their
     * ancestors. `action` defaults to `"elide"`.
     */
    elide(options?: ElideOptions): Envelope;
    /**
     * Implementation of elide()
     */
    private elideAll;
    /**
     * Implementation of elideRemovingSetWithAction
     */
    private elideRemovingWith;
    /**
     * Implementation of elideSetWithAction (for revealing mode)
     */
    elideSetWithAction(target: Set<Digest>, action: ObscureAction): Envelope;
    /**
     * Implementation of elideRevealingSetWithAction
     */
    private elideRevealingWith;
    /**
     * Implementation of unelide
     */
    unelide(envelope: Envelope): Envelope;
    /**
     * Implementation of nodesMatching
     *
     * `Set<Digest>` for backward compatibility with callers, but the
     * underlying dedup is by **hex content** (via a hex-keyed Map) so two
     * `Digest` instances that represent the same hash bytes count once,
     * matching Rust's `HashSet<Digest>` semantics.
     */
    nodesMatching(targetDigests: Set<Digest> | undefined, obscureTypes: ObscureType[]): Set<Digest>;
    /**
     * Implementation of walkUnelide
     */
    walkUnelide(envelopes: Envelope[]): Envelope;
    /**
     * Implementation of walkReplace
     */
    walkReplace(target: Set<Digest>, replacement: Envelope): Envelope;
    /**
     * Implementation of isEquivalentTo
     *
     * Two envelopes are equivalent if they have the same digest (semantic equivalence).
     * This is a weaker comparison than `isIdenticalTo` which also checks the case type.
     *
     */
    isEquivalentTo(other: Envelope): boolean;
    /**
     * Implementation of isIdenticalTo
     *
     * short-circuit on a *semantic* mismatch (different `digest()`), then fall
     * through to a {@link Envelope.structuralDigest} comparison. Two envelopes
     * whose digests match but whose structures differ — e.g. an envelope and a
     * version of it with one assertion elided — are **not** identical.
     */
    isIdenticalTo(other: Envelope): boolean;
    /**
     * Implementation of walkDecrypt
     *
     * Recursively walks the envelope and decrypts every encrypted node it
     * can. For an Encrypted node, each provided key is tried in order; the
     * first one that successfully decrypts wins, and the recursion continues
     * into the result so chains of nested encryption peel off one layer per
     * matching key. Nodes whose decryption fails for every key are returned
     * unchanged — matching Rust's `if let Ok(decrypted) = ...` pattern.
     *
     * Structural sharing: if a recursion produces an envelope that is
     * {@link Envelope.isIdenticalTo} the original, the original instance is
     * reused instead of allocating a new node.
     */
    walkDecrypt(keys: SymmetricKey[]): Envelope;
    /**
     * Implementation of walkDecompress
     *
     * Recursively walks the envelope and decompresses any compressed node
     * whose digest is in `targetDigests` (or every compressed node if
     * `targetDigests` is undefined). Decompression failures are tolerated —
     * the original node is returned in that case, mirroring Rust's
     * `if let Ok(decompressed) = ...` pattern.
     */
    walkDecompress(targetDigests?: Set<Digest>): Envelope;
    /**
     * Add the tryLeaf method to Envelope prototype.
     *
     * This extracts the leaf CBOR value from an envelope.
     */
    expectLeaf(): Cbor;
    /**
     * Add extraction convenience methods to Envelope prototype
     */
    expectString(): string;
    expectNumber(): number;
    expectBoolean(): boolean;
    expectBytes(): Uint8Array;
    expectNull(): null;
    /**
     * Add extractSubject method to Envelope prototype
     */
    expectSubject<T>(decoder: CborDecoder<T>): T;
    /**
     * Add tryObjectForPredicate method to Envelope prototype
     */
    expectObjectForPredicate<T>(predicate: EnvelopeInput, decoder: CborDecoder<T>): T;
    /**
     * Add tryOptionalObjectForPredicate method to Envelope prototype
     */
    optionalObjectForPredicateAs<T>(predicate: EnvelopeInput, decoder: CborDecoder<T>): T | undefined;
    /**
     * Add extractObjectForPredicateWithDefault method to Envelope prototype
     */
    objectForPredicateOr<T>(predicate: EnvelopeInput, decoder: CborDecoder<T>, defaultValue: T): T;
    /**
     * Add extractObjectsForPredicate method to Envelope prototype
     */
    expectObjectsForPredicate<T>(predicate: EnvelopeInput, decoder: CborDecoder<T>): T[];
    encryptSubject(key: SymmetricKey): Envelope;
    /**
     * Implementation of decryptSubject()
     */
    decryptSubject(key: SymmetricKey): Envelope;
    /**
     * Implementation of encrypt() - convenience method
     */
    encrypt(key: SymmetricKey): Envelope;
    /**
     * Implementation of decrypt() - convenience method
     */
    decrypt(key: SymmetricKey): Envelope;
    /**
     * Implementation of isEncrypted()
     */
    isEncrypted(): boolean;
    compress(): Envelope;
    /**
     * Implementation of decompress()
     */
    decompress(): Envelope;
    /**
     * Implementation of compressSubject()
     */
    compressSubject(): Envelope;
    /**
     * Implementation of decompressSubject()
     */
    decompressSubject(): Envelope;
    /**
     * Implementation of isCompressed()
     */
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
    type: "node";
    /** The subject of the node */
    subject: Envelope;
    /** The assertions attached to the subject */
    assertions: Envelope[];
    /** The digest of the node */
    digest: Digest;
} | {
    type: "leaf";
    /** The CBOR value contained in the leaf */
    cbor: Cbor;
    /** The digest of the leaf */
    digest: Digest;
} | {
    type: "wrapped";
    /** The envelope being wrapped */
    envelope: Envelope;
    /** The digest of the wrapped envelope */
    digest: Digest;
} | {
    type: "assertion";
    /** The assertion */
    assertion: Assertion;
} | {
    type: "elided";
    /** The digest of the elided content */
    digest: Digest;
} | {
    type: "knownValue";
    /** The known value instance */
    value: KnownValue;
    /** The digest of the known value */
    digest: Digest;
} | {
    type: "encrypted";
    /** The encrypted message */
    message: EncryptedMessage;
} | {
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
declare type EnvelopeInput = ToEnvelope | string | number | boolean | bigint | Uint8Array | null | undefined | Envelope | KnownValue | ToCbor;

export declare const EQ: Function_2;

/** Creates an equality expression: lhs == rhs */
export declare function eq(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

export declare const EQ_VALUE: number;

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
declare class Event_2<T extends EnvelopeInput> implements EventBehavior<T>, ToEnvelope {
    private readonly _content;
    private readonly _id;
    private _note;
    private _date;
    private constructor();
    /**
     * Creates a new event with the specified content and ID.
     */
    static from<T extends EnvelopeInput>(content: T, id: ARID): Event_2<T>;
    /**
     * Returns a human-readable summary of the event.
     */
    summary(): string;
    withNote(note: string): Event_2<T>;
    withDate(date: Date): Event_2<T>;
    get content(): T;
    get id(): ARID;
    get note(): string;
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
 * Interface that defines the behavior of an event.
 */
export declare interface EventBehavior<T extends EnvelopeInput> {
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
    readonly content: T;
    /**
     * Returns the unique identifier (ARID) of the event.
     */
    readonly id: ARID;
    /**
     * Returns the note attached to the event, or an empty string if none exists.
     */
    readonly note: string;
    /**
     * Returns the date attached to the event, if any.
     */
    readonly date: Date | undefined;
    /**
     * Converts the event to an envelope.
     */
    toEnvelope(): Envelope;
}

/**
 * Represents a complete expression with function and parameters.
 *
 * Parameters are stored as an *append-only array*, mirroring Rust
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
    /** Adds multiple parameters at once. */
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
    /** Converts this expression into an envelope (ToEnvelope implementation). */
    /**
     * Creates an expression from an envelope.
     *
     * The function and each parameter are read as **tagged CBOR**
     * (tag 40006 / tag 40007). Earlier the TS port stored these as
     * pre-formatted display strings (e.g. `«"test"»`, `❰"param1"❱`)
     * and parsed them by string matching; that diverged from Rust
     * (which stores tag-40006/40007 leaves) and prevented the
     * TAG_FUNCTION / TAG_PARAMETER format summarizers from firing.
     */
    static fromEnvelope(envelope: Envelope): Expression;
    /** Returns a string representation for display. */
    toString(): string;
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
    /** Creates a new known function with a numeric ID and optional name. */
    /** A function by known id (number) or name (string). */
    static from(id: FunctionID): Function_2;
    static known(value: number, name?: string): Function_2;
    /** Creates a new named function identified by a string. */
    static named(name: string): Function_2;
    /** Creates a function from a numeric ID (convenience method). */
    /** Creates a function from a string name (convenience method). */
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
    /** Returns true if this is a numeric function ID (legacy compatibility). */
    /** Returns true if this is a string function ID (legacy compatibility). */
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
    /** Converts this function into an envelope (ToEnvelope implementation). */
    /** Creates an expression with a parameter. */
    withParameter(param: ParameterID, value: EnvelopeInput): Expression;
    /** Checks equality based on value (for known) or name (for named). */
    equals(other: Function_2): boolean;
    /** Returns a hash code for this function. */
    hashCode(): number;
    /** Returns a string representation for display. */
    toString(): string;
}
export { Function_2 as Function }

/** Well-known function identifiers (numeric) */
export declare const FUNCTION_IDS: {
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
    /** Static method that returns the name of a function, using an optional store. */
    static nameForFunction(func: Function_2, store?: FunctionsStore): string;
}

export declare const GE: Function_2;

/** Creates a greater-than-or-equal expression: lhs >= rhs */
export declare function ge(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

export declare const GE_VALUE: number;

/** The global shared store of known functions. */
export declare const GLOBAL_FUNCTIONS: LazyStore<FunctionsStore>;

/** The global shared store of known parameters. */
export declare const GLOBAL_PARAMETERS: LazyStore<ParametersStore>;

export declare const GT: Function_2;

/** Creates a greater-than expression: lhs > rhs */
export declare function gt(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

export declare const GT_VALUE: number;

/** Lazy initialization helper for global stores */
export declare class LazyStore<T> {
    private _store;
    private readonly _initializer;
    constructor(initializer: () => T);
    get(): T;
}

export declare const LE: Function_2;

/** Creates a less-than-or-equal expression: lhs <= rhs */
export declare function le(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

export declare const LE_VALUE: number;

export declare const LHS: Parameter;

export declare const LHS_VALUE: number;

export declare const LT: Function_2;

/** Creates a less-than expression: lhs < rhs */
export declare function lt(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

export declare const LT_VALUE: number;

declare const MajorType: {
    readonly Unsigned: 0;
    readonly Negative: 1;
    readonly ByteString: 2;
    readonly Text: 3;
    readonly Array: 4;
    readonly Map: 5;
    readonly Tagged: 6;
    readonly Simple: 7;
};

declare type MajorType = (typeof MajorType)[keyof typeof MajorType];

declare interface MapEntry {
    readonly key: Cbor;
    readonly value: Cbor;
}

export declare const MUL: Function_2;

/** Creates a multiplication expression: lhs * rhs */
export declare function mul(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

export declare const MUL_VALUE: number;

export declare const NE: Function_2;

/** Creates a not-equal expression: lhs != rhs */
export declare function ne(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

export declare const NE_VALUE: number;

export declare const NEG: Function_2;

/** Creates a negation expression: -value */
export declare function neg(value: EnvelopeInput): Expression;

export declare const NEG_VALUE: number;

export declare const NOT: Function_2;

/** Creates a logical NOT expression: !value */
export declare function not(value: EnvelopeInput): Expression;

export declare const NOT_VALUE: number;

/**
 * Actions that can be performed on parts of an envelope to obscure them.
 *
 * Gordian Envelope supports several ways to obscure parts of an envelope while
 * maintaining its semantic integrity and digest tree.
 */
declare type ObscureAction = "elide" | "compress" | {
    encrypt: SymmetricKey;
};

/** How an obscured element was obscured. */
declare const ObscureType: {
    readonly Elided: "elided";
    readonly Encrypted: "encrypted";
    readonly Compressed: "compressed";
};

declare type ObscureType = (typeof ObscureType)[keyof typeof ObscureType];

export declare const OR: Function_2;

/** Creates a logical OR expression: lhs || rhs */
export declare function or(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

export declare const OR_VALUE: number;

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
    /** Creates a parameter with a value envelope (internal use). */
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
    /** Returns true if this is a numeric parameter ID (legacy compatibility). */
    /** Returns true if this is a string parameter ID (legacy compatibility). */
    /**
     * Creates a parameter envelope.
     *
     * Function above): the parameter is stored as `tag(40007, untagged)`
     * where untagged is `uint(N)` (Known) or `text(name)` (Named).
     */
    toEnvelope(): Envelope;
    /** Converts this parameter into an envelope (ToEnvelope implementation). */
    /** Checks equality based on value (for known) or name (for named). */
    equals(other: Parameter): boolean;
    /** Returns a hash code for this parameter. */
    hashCode(): number;
    /** Returns a string representation for display. */
    toString(): string;
    static blank(value: EnvelopeInput): Parameter;
    static lhs(value: EnvelopeInput): Parameter;
    static rhs(value: EnvelopeInput): Parameter;
}

/** Well-known parameter identifiers (numeric) */
export declare const PARAMETER_IDS: {
    readonly BLANK: 1;
    readonly LHS: 2;
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
    /** Static method that returns the name of a parameter, using an optional store. */
    static nameForParameter(param: Parameter, store?: ParametersStore): string;
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
 * const request = Request.from("getBalance", requestId)
 *   .withParameter("account", "alice")
 *   .withParameter("currency", "USD")
 *   .withNote("Monthly balance check");
 *
 * // Convert to an envelope
 * const envelope = request.toEnvelope();
 * ```
 */
declare class Request_2 implements RequestBehavior, ToEnvelope {
    private readonly _body;
    private readonly _id;
    private _note;
    private _date;
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
    withParameter(param: ParameterID, value: EnvelopeInput): Request_2;
    withNote(note: string): Request_2;
    withDate(date: Date): Request_2;
    get body(): Expression;
    get id(): ARID;
    get note(): string;
    get date(): Date | undefined;
    get function(): Function_2;
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
 * Interface that defines the behavior of a request.
 *
 * This interface extends expression behavior to add methods specific to requests,
 * including metadata management and access to request properties.
 */
export declare interface RequestBehavior {
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
    readonly body: Expression;
    /**
     * Returns the unique identifier (ARID) of the request.
     */
    readonly id: ARID;
    /**
     * Returns the note attached to the request, or an empty string if none exists.
     */
    readonly note: string;
    /**
     * Returns the date attached to the request, if any.
     */
    readonly date: Date | undefined;
    /**
     * Returns the function of the request.
     */
    readonly function: Function_2;
    /**
     * Returns the expression envelope of the request.
     */
    readonly expressionEnvelope: Envelope;
    /**
     * Converts the request to an envelope.
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
declare class Response_2 implements ResponseBehavior, ToEnvelope {
    private _result;
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
    withResult(result: EnvelopeInput): Response_2;
    withOptionalResult(result: EnvelopeInput | undefined): Response_2;
    withError(error: EnvelopeInput): Response_2;
    withOptionalError(error: EnvelopeInput | undefined): Response_2;
    isOk(): boolean;
    isErr(): boolean;
    get id(): ARID | undefined;
    expectId(): ARID;
    get result(): Envelope;
    get error(): Envelope;
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
     * Creates a response from an envelope.
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

/**
 * Interface that defines the behavior of a response.
 */
export declare interface ResponseBehavior {
    /**
     * Sets the result value for a successful response.
     * @throws Error if called on a failure response.
     */
    withResult(result: EnvelopeInput): Response_2;
    /**
     * Sets the error value for a failure response.
     * @throws Error if called on a successful response.
     */
    withError(error: EnvelopeInput): Response_2;
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

export declare const RHS: Parameter;

export declare const RHS_VALUE: number;

/** Options for `Envelope.addSalt`. */
declare interface SaltOptions {
    /** Use exactly this salt (at least 8 bytes). */
    salt?: Salt | Uint8Array;
    /** Random salt of exactly this many bytes (at least 8). */
    length?: number;
    /** Random salt of a length in this inclusive range. */
    range?: {
        min: number;
        max: number;
    };
    /** Randomness source; secure by default. */
    rng?: RandomNumberGenerator;
}

/**
 * Represents CBOR simple values (major type 7).
 *
 * In CBOR, simple values are a special category that includes booleans (`true`
 * and `false`), `null`, and floating point numbers.
 *
 * Per Section 2.4 of the dCBOR specification, only these specific simple
 * values are valid in dCBOR. All other major type 7 values (such as undefined
 * or other simple values) are invalid and will be rejected by dCBOR decoders.
 *
 * When encoding floating point values, dCBOR follows specific numeric
 * reduction rules detailed in Section 2.3 of the dCBOR specification,
 * including
 * - Integral floating point values must be reduced to integers when possible
 * - NaN values must be normalized to the canonical form `f97e00`
 */
declare type Simple = {
    readonly type: "False";
} | {
    readonly type: "True";
} | {
    readonly type: "Null";
} | {
    readonly type: "Float";
    readonly value: number;
};

export declare const SUB: Function_2;

/** Creates a subtraction expression: lhs - rhs */
export declare function sub(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

export declare const SUB_VALUE: number;

/**
 * A CBOR tag with an optional name.
 *
 * Tags consist of a numeric value and an optional human-readable name.
 *
 * Note on equality: tags compare by `value` only - two tags with the same
 * value but different names are equal. Use `Tag.equals` for this; raw
 * `===` on `Tag` objects compares by reference.
 */
declare interface Tag {
    /** The numeric tag value */
    readonly value: TagValue;
    /** Optional human-readable name for the tag */
    readonly name?: string | undefined;
}

/**
 * Value-type companion for the `Tag` interface: an interface plus a merged
 * `const` with a handful of members. It stays small and must not import the
 * encode/format graph.
 */
declare const Tag: {
    /**
     * Create a Tag from its numeric value, optionally with a name.
     *
     * ```typescript
     * Tag.from(1, "date");
     * Tag.from(12345);
     * ```
     */
    readonly from: (value: TagValue, name?: string) => Tag;
    /**
     * Compare two tags for equality: compares by `value` only (normalizing
     * `number` vs `bigint`) and ignores the optional `name`.
     */
    readonly equals: (a: Tag, b: Tag) => boolean;
};

/**
 * Numeric tag value type alias.
 *
 * A tag value is a u64. Since JavaScript has no native u64, this accepts the
 * broader `CborNumber` (`number | bigint`); the runtime guards in
 * `encodeVarInt` enforce the 0..=2^64-1 range.
 */
declare type TagValue = CborNumber;

/**
 * The structural encode protocol: types that can convert themselves to CBOR.
 * `cbor()` dispatches on it, following the `toJSON` precedent.
 *
 * Tagged types conventionally also keep `cborTags()` / `untaggedCbor()` /
 * `taggedCbor()` as ordinary members and implement `toCbor()` as
 * `return this.taggedCbor();`.
 */
declare interface ToCbor {
    toCbor(): Cbor;
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

export declare const XOR: Function_2;

/** Creates a logical XOR expression: lhs ^ rhs */
export declare function xor(lhs: EnvelopeInput, rhs: EnvelopeInput): Expression;

export declare const XOR_VALUE: number;

export { }
