import { Compressed } from '@blockchaincommons/components';
import { Digest } from '@blockchaincommons/components';
import { EncryptedMessage } from '@blockchaincommons/components';
import { KnownValue } from '@blockchaincommons/known-values';
import { KnownValuesStore } from '@blockchaincommons/known-values';
import { SymmetricKey } from '@blockchaincommons/components';
import { UR } from '@blockchaincommons/uniform-resources';

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

declare interface CborArrayType {
    readonly isCbor: true;
    readonly type: typeof MajorType.Array;
    readonly value: readonly Cbor[];
}

export declare function cborBytes(envelope: Envelope): Uint8Array;

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

declare type CborDecoder<T> = (cbor: Cbor) => T;

declare const cborEnvelopeSummary: (cbor: Cbor, maxLength: number, context: FormatContextOpt) => string;
export { cborEnvelopeSummary }
export { cborEnvelopeSummary as envelopeSummary }

/**
 * The single error type thrown by dCBOR encoding, decoding, and extraction.
 *
 * @example
 * ```typescript
 * try {
 *   decodeCbor(bytes);
 * } catch (e) {
 *   if (CborError.isCborError(e) && e.code === "WrongTag") {
 *     console.log(e.details.expectedTag, e.details.actualTag);
 *   }
 * }
 * ```
 */
declare class CborError extends Error {
    /** Machine-readable discriminant; switch on this to handle errors. */
    readonly code: CborErrorCode;
    /** Structured, code-specific data (see {@link CborErrorDetails}). */
    readonly details: CborErrorDetails;
    constructor(code: CborErrorCode, message: string, details?: CborErrorDetails);
    /** Type guard: is `value` a {@link CborError}? Narrows to the
     * code-discriminated {@link CborErrorTyped} union. */
    static isCborError(value: unknown): value is CborErrorTyped;
    /** The CBOR data ended before a complete item could be decoded. */
    static underrun(): CborErrorTyped<"Underrun">;
    /** An unsupported/invalid value was found in a CBOR header byte. */
    static unsupportedHeaderValue(headerValue: number): CborErrorTyped<"UnsupportedHeaderValue">;
    /** A numeric value was not in its shortest/canonical dCBOR form. */
    static nonCanonicalNumeric(): CborErrorTyped<"NonCanonicalNumeric">;
    /** A major-type-7 simple value other than false/true/null/float. */
    static invalidSimpleValue(): CborErrorTyped<"InvalidSimpleValue">;
    /** A text string was not valid UTF-8 (with the underlying reason). */
    static invalidString(cause: string): CborErrorTyped<"InvalidString">;
    /** A text string was not in Unicode NFC. */
    static nonCanonicalString(): CborErrorTyped<"NonCanonicalString">;
    /** The decoded item left `count` trailing bytes unconsumed. */
    static unusedData(count: number): CborErrorTyped<"UnusedData">;
    /** Map keys were not in canonical ascending byte order. */
    static misorderedMapKey(): CborErrorTyped<"MisorderedMapKey">;
    /** A map contained a duplicate key. */
    static duplicateMapKey(): CborErrorTyped<"DuplicateMapKey">;
    /** A requested map key was not present. */
    static missingMapKey(): CborErrorTyped<"MissingMapKey">;
    /** A numeric value could not be represented in the target type. */
    static outOfRange(): CborErrorTyped<"OutOfRange">;
    /** The CBOR value was not the type expected by a conversion. */
    static wrongType(): CborErrorTyped<"WrongType">;
    /** A tagged value had a tag other than the one expected. */
    static wrongTag(expected: Tag, actual: Tag): CborErrorTyped<"WrongTag">;
    /** Invalid UTF-8 in a text string (with the underlying reason). */
    static invalidUtf8(cause: string): CborErrorTyped<"InvalidUtf8">;
    /** Invalid ISO 8601 / RFC 3339 date string (with the underlying reason). */
    static invalidDate(cause: string): CborErrorTyped<"InvalidDate">;
    /** An arbitrary error carrying a custom message. */
    static custom(message: string): CborErrorTyped<"Custom">;
}

/**
 * Machine-readable discriminant for a {@link CborError}.
 *
 * These cover the deterministic-encoding validation failures from RFC 8949
 * §4.2.1 and the dCBOR application profile, plus type/range errors raised while
 * extracting values.
 */
declare type CborErrorCode = "Underrun" | "UnsupportedHeaderValue" | "NonCanonicalNumeric" | "InvalidSimpleValue" | "InvalidString" | "NonCanonicalString" | "UnusedData" | "MisorderedMapKey" | "DuplicateMapKey" | "MissingMapKey" | "OutOfRange" | "WrongType" | "WrongTag" | "InvalidUtf8" | "InvalidDate" | "Custom";

/**
 * Optional structured data attached to a {@link CborError}, keyed by the codes
 * that carry it. Everything is optional so callers can narrow on `code` and
 * read only the fields relevant to that code.
 *
 * @deprecated Use {@link CborErrorDetailsByCode} (per-code payloads) with
 * {@link CborErrorTyped} - narrowing on `error.code` then makes the matching
 * detail fields non-optional. This undiscriminated bag remains for
 * compatibility and is removed at 2.0.
 */
declare interface CborErrorDetails {
    /** `UnsupportedHeaderValue`: the offending CBOR header byte. */
    readonly headerValue?: number | undefined;
    /** `UnusedData`: number of trailing bytes left unconsumed. */
    readonly count?: number | undefined;
    /** `WrongTag`: the tag that was expected. */
    readonly expectedTag?: Tag | undefined;
    /** `WrongTag`: the tag actually found. */
    readonly actualTag?: Tag | undefined;
    /** `InvalidString`/`InvalidUtf8`/`InvalidDate`: the underlying reason. */
    readonly cause?: string | undefined;
}

/**
 * The structured detail payload each {@link CborErrorCode} carries.
 * Codes mapped to `unknown` attach no structured details.
 *
 * Prefer consuming this through {@link CborErrorTyped}: narrowing on
 * `error.code` makes the matching payload fields non-optional.
 */
declare interface CborErrorDetailsByCode {
    Underrun: unknown;
    UnsupportedHeaderValue: {
        readonly headerValue: number;
    };
    NonCanonicalNumeric: unknown;
    InvalidSimpleValue: unknown;
    InvalidString: {
        readonly cause: string;
    };
    NonCanonicalString: unknown;
    UnusedData: {
        readonly count: number;
    };
    MisorderedMapKey: unknown;
    DuplicateMapKey: unknown;
    MissingMapKey: unknown;
    OutOfRange: unknown;
    WrongType: unknown;
    WrongTag: {
        readonly expectedTag: Tag;
        readonly actualTag: Tag;
    };
    InvalidUtf8: {
        readonly cause: string;
    };
    InvalidDate: {
        readonly cause: string;
    };
    Custom: unknown;
}

/**
 * A {@link CborError} whose `details` payload is discriminated by its `code`.
 * With the default type argument this is the distributed union over all codes,
 * so narrowing on `error.code` narrows `error.details` to exactly the fields
 * that code carries:
 *
 * ```typescript
 * try {
 *   decodeCbor(bytes);
 * } catch (e) {
 *   if (CborError.isCborError(e) && e.code === "WrongTag") {
 *     e.details.expectedTag; // Tag - non-optional after narrowing
 *   }
 * }
 * ```
 *
 * The intersection with the legacy {@link CborErrorDetails} bag keeps
 * un-narrowed `details` access compiling exactly as before.
 */
declare type CborErrorTyped<C extends CborErrorCode = CborErrorCode> = C extends CborErrorCode ? CborError & {
    readonly code: C;
    readonly details: Readonly<CborErrorDetailsByCode[C]> & CborErrorDetails;
} : never;

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
 * Function type for custom CBOR value summarizers.
 *
 * Summarizers provide custom string representations for tagged values.
 * Returns a summary string on success, or a CborError on failure.
 *
 * @param cbor - The CBOR value to summarize
 * @param flat - If true, produce single-line output
 * @returns Result with summary string on success, or error on failure
 */
declare type CborSummarizer = (cbor: Cbor, flat: boolean) => SummarizerResult;

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

/** The pre-redesign tagged-encodable shape (replaced by dcbor's ToCbor in Phase 3). */
declare interface CborTaggedEncodable extends CborTagged {
    untaggedCbor(): Cbor;
    taggedCbor(): Cbor;
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

export declare const defaultFormatOpts: () => EnvelopeFormatOpts;

export declare const defaultMermaidOpts: () => MermaidFormatOpts;

export declare function diagnostic(envelope: Envelope): string;

export declare function diagnosticAnnotated(envelope: Envelope, context?: FormatContext): string;

/**
 * Specifies the format for displaying envelope digests in tree output.
 *
 * Ported from bc-envelope-rust/src/format/tree/format/digest.rs
 */
export declare enum DigestDisplayFormat {
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

declare interface DigestProvider {
    digest(): Digest;
}

declare enum EdgeType {
    None = "none",
    Subject = "subject",
    Assertion = "assertion",
    Predicate = "predicate",
    Object = "object",
    Content = "content"
}

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
    /**
     * Implementation of static false()
     */
    static false(): Envelope;
    /**
     * Implementation of static true()
     */
    static true(): Envelope;
    /**
     * Implementation of static unit()
     * Unit envelopes have the known value ''. They represent a position
     * where no meaningful data *can* exist. In this sense they make a
     * semantically stronger assertion than `null`, which represents a
     * position where no meaningful data currently exists, but could exist in
     * the future.
     */
    static unit(): Envelope;
    /**
     * Implementation of fromUrString
     */
    static fromUrString(urString: string): Envelope;
    static fromURString(urString: string): Envelope;
    /**
     * Implementation of fromUR
     */
    static fromUR(ur: UR): Envelope;
    /**
     * Implementation of addAssertionEnvelopes
     */
    addAssertionEnvelopes(assertions: Envelope[]): Envelope;
    /**
     * Implementation of addOptionalAssertionEnvelope
     */
    addOptionalAssertionEnvelope(assertion: Envelope | undefined): Envelope;
    /**
     * Implementation of addOptionalAssertion
     */
    addOptionalAssertion(predicate: EnvelopeEncodableValue, object: EnvelopeEncodableValue | undefined): Envelope;
    /**
     * Implementation of addNonemptyStringAssertion
     */
    addNonemptyStringAssertion(predicate: EnvelopeEncodableValue, str: string): Envelope;
    /**
     * Implementation of addAssertions
     */
    addAssertions(envelopes: Envelope[]): Envelope;
    /**
     * Implementation of addAssertionIf
     */
    addAssertionIf(condition: boolean, predicate: EnvelopeEncodableValue, object: EnvelopeEncodableValue): Envelope;
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
     * Implementation of tryByteString()
     */
    tryByteString(): Uint8Array;
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
    tryKnownValue(): KnownValue;
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
    tryAssertion(): Envelope;
    /**
     * Implementation of asPredicate()
     */
    asPredicate(): Envelope | undefined;
    /**
     * Implementation of tryPredicate()
     */
    tryPredicate(): Envelope;
    /**
     * Implementation of asObject()
     */
    asObject(): Envelope | undefined;
    /**
     * Implementation of tryObject()
     */
    tryObject(): Envelope;
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
    assertionsWithPredicate(predicate: EnvelopeEncodableValue): Envelope[];
    /**
     * Implementation of assertionWithPredicate()
     */
    assertionWithPredicate(predicate: EnvelopeEncodableValue): Envelope;
    /**
     * Implementation of optionalAssertionWithPredicate()
     */
    optionalAssertionWithPredicate(predicate: EnvelopeEncodableValue): Envelope | undefined;
    /**
     * Implementation of objectForPredicate()
     */
    objectForPredicate(predicate: EnvelopeEncodableValue): Envelope;
    /**
     * Implementation of optionalObjectForPredicate()
     */
    optionalObjectForPredicate(predicate: EnvelopeEncodableValue): Envelope | undefined;
    /**
     * Implementation of objectsForPredicate()
     */
    objectsForPredicate(predicate: EnvelopeEncodableValue): Envelope[];
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
    tryUnwrap(): Envelope;
    /**
     * Implementation of unwrap() - alias for tryUnwrap()
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
     * Mirrors Rust `Envelope::digests` (`bc-envelope-rust/src/base/digest.rs:103-119`).
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
     * Mirrors Rust `Envelope::structural_digest`
     * (`bc-envelope-rust/src/base/digest.rs:241-261`). Walks every node in
     * structure mode, building an image:
     *
     * - Each obscured case prepends a 1-byte discriminator: `0` for Encrypted,
     * `1` for Elided, `2` for Compressed (matching the Rust order).
     * - Every node — obscured or not — appends its 32-byte digest bytes.
     *
     * The full image is then SHA-256-hashed via {@link Digest.fromImage}.
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
     * Implementation of toCbor() - alias for taggedCbor()
     */
    toCbor(): unknown;
    /**
     * Implementation of expectLeaf() - returns the leaf CBOR value or throws
     */
    expectLeaf(): unknown;
    /**
     * Implementation of elide()
     */
    elide(): Envelope;
    /**
     * Implementation of elideRemovingSetWithAction
     */
    elideRemovingSetWithAction(target: Set<Digest>, action: ObscureAction): Envelope;
    /**
     * Implementation of elideSetWithAction (for revealing mode)
     */
    elideSetWithAction(target: Set<Digest>, action: ObscureAction): Envelope;
    /**
     * Implementation of elideRemovingSet
     */
    elideRemovingSet(target: Set<Digest>): Envelope;
    /**
     * Implementation of elideRemovingArrayWithAction
     */
    elideRemovingArrayWithAction(target: DigestProvider[], action: ObscureAction): Envelope;
    /**
     * Implementation of elideRemovingArray
     */
    elideRemovingArray(target: DigestProvider[]): Envelope;
    /**
     * Implementation of elideRemovingTargetWithAction
     */
    elideRemovingTargetWithAction(target: DigestProvider, action: ObscureAction): Envelope;
    /**
     * Implementation of elideRemovingTarget
     */
    elideRemovingTarget(target: DigestProvider): Envelope;
    /**
     * Implementation of elideRevealingSetWithAction
     */
    elideRevealingSetWithAction(target: Set<Digest>, action: ObscureAction): Envelope;
    /**
     * Implementation of elideRevealingSet
     */
    elideRevealingSet(target: Set<Digest>): Envelope;
    /**
     * Implementation of elideRevealingArrayWithAction
     */
    elideRevealingArrayWithAction(target: DigestProvider[], action: ObscureAction): Envelope;
    /**
     * Implementation of elideRevealingArray
     */
    elideRevealingArray(target: DigestProvider[]): Envelope;
    /**
     * Implementation of elideRevealingTargetWithAction
     */
    elideRevealingTargetWithAction(target: DigestProvider, action: ObscureAction): Envelope;
    /**
     * Implementation of elideRevealingTarget
     */
    elideRevealingTarget(target: DigestProvider): Envelope;
    /**
     * Implementation of unelide
     */
    unelide(envelope: Envelope): Envelope;
    /**
     * Implementation of nodesMatching
     *
     * Mirrors Rust `Envelope::nodes_matching`. The TS public signature is
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
     * Equivalent to Rust's `is_equivalent_to()` in `src/base/digest.rs`.
     */
    isEquivalentTo(other: Envelope): boolean;
    /**
     * Implementation of isIdenticalTo
     *
     * Mirrors Rust `Envelope::is_identical_to`
     * (`bc-envelope-rust/src/base/digest.rs:344-349`):
     * short-circuit on a *semantic* mismatch (different `digest()`), then fall
     * through to a {@link Envelope.structuralDigest} comparison. Two envelopes
     * whose digests match but whose structures differ — e.g. an envelope and a
     * version of it with one assertion elided — are **not** identical.
     */
    isIdenticalTo(other: Envelope): boolean;
    /**
     * Implementation of walkDecrypt
     *
     * Mirrors Rust `Envelope::walk_decrypt`
     * (`bc-envelope-rust/src/base/elide.rs:963-1019`).
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
     * Mirrors Rust `Envelope::walk_decompress`
     * (`bc-envelope-rust/src/base/elide.rs:1067-1135`).
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
    tryLeaf(): Cbor;
    /**
     * Add extraction convenience methods to Envelope prototype
     */
    extractString(): string;
    extractNumber(): number;
    extractBoolean(): boolean;
    extractBytes(): Uint8Array;
    extractNull(): null;
    /**
     * Add extractSubject method to Envelope prototype
     */
    extractSubject<T>(decoder: CborDecoder<T>): T;
    /**
     * Add tryObjectForPredicate method to Envelope prototype
     */
    tryObjectForPredicate<T>(predicate: EnvelopeEncodableValue, decoder: CborDecoder<T>): T;
    /**
     * Add tryOptionalObjectForPredicate method to Envelope prototype
     */
    tryOptionalObjectForPredicate<T>(predicate: EnvelopeEncodableValue, decoder: CborDecoder<T>): T | undefined;
    /**
     * Add extractObjectForPredicateWithDefault method to Envelope prototype
     */
    extractObjectForPredicateWithDefault<T>(predicate: EnvelopeEncodableValue, decoder: CborDecoder<T>, defaultValue: T): T;
    /**
     * Add extractObjectsForPredicate method to Envelope prototype
     */
    extractObjectsForPredicate<T>(predicate: EnvelopeEncodableValue, decoder: CborDecoder<T>): T[];
    /**
     * Add tryObjectsForPredicate method to Envelope prototype
     */
    tryObjectsForPredicate<T>(predicate: EnvelopeEncodableValue, decoder: CborDecoder<T>): T[];
    /**
     * Implementation of urString
     */
    urString(): string;
    /**
     * Implementation of ur
     */
    ur(): UR;
    /**
     * Implementation of taggedCborData (alias for cborBytes)
     */
    taggedCborData(): Uint8Array;
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

declare type EnvelopeCase = {
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

declare interface EnvelopeEncodable {
    intoEnvelope(): Envelope;
}

declare type EnvelopeEncodableValue = EnvelopeEncodable | string | number | boolean | bigint | Uint8Array | null | undefined | Envelope | KnownValue | CborTaggedEncodable | ToCbor;

/**
 * Hook installed by `src/index.ts` to break the circular import
 * between `base/envelope.ts` and `format/format-context.ts`. Used by
 * the request/response/event tag summarizers to recursively format the
 * inner envelope.
 */
declare type EnvelopeFormatHook = (cbor: unknown, flat: boolean) => string;

export declare type EnvelopeFormatItem = {
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

export declare interface EnvelopeFormatOpts {
    flat: boolean;
    context: FormatContextOpt;
}

export declare interface EnvelopeSummary {
    envelopeSummary(maxLength: number, context: FormatContextOpt): string;
}

export declare const flatFormatOpts: () => EnvelopeFormatOpts;

export declare function format(envelope: Envelope): string;

export declare const formatAssertion: (assertion: Assertion, opts: EnvelopeFormatOpts) => EnvelopeFormatItem;

export declare const formatBegin: (value: string) => EnvelopeFormatItem;

export declare const formatCbor: (cbor: Cbor, opts: EnvelopeFormatOpts) => EnvelopeFormatItem;

export declare class FormatContext implements ReadonlyTagsStore {
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

export declare const formatContextCustom: (context: FormatContext) => FormatContextOpt;

export declare const formatContextGlobal: () => FormatContextOpt;

export declare const formatContextNone: () => FormatContextOpt;

export declare type FormatContextOpt = {
    type: "none";
} | {
    type: "global";
} | {
    type: "custom";
    context: FormatContext;
};

export declare const formatEnd: (value: string) => EnvelopeFormatItem;

export declare const formatEnvelope: (envelope: Envelope, opts: EnvelopeFormatOpts) => EnvelopeFormatItem;

export declare function formatFlat(envelope: Envelope): string;

export declare const formatItem: (value: string) => EnvelopeFormatItem;

export declare const formatList: (items: EnvelopeFormatItem[]) => EnvelopeFormatItem;

export declare function formatOpt(envelope: Envelope, opts: EnvelopeFormatOpts): string;

export declare const formatSeparator: () => EnvelopeFormatItem;

export declare const getGlobalFormatContext: () => FormatContext;

export declare const GLOBAL_FORMAT_CONTEXT: {
    get: () => FormatContext;
};

export declare const globalFormatContext: () => FormatContext;

export declare function hex(envelope: Envelope): string;

export declare function hexOpt(envelope: Envelope, annotate: boolean, context?: FormatContext): string;

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

export declare function mermaidFormat(envelope: Envelope): string;

export declare function mermaidFormatOpt(envelope: Envelope, opts: MermaidFormatOpts): string;

export declare interface MermaidFormatOpts {
    hideNodes?: boolean;
    monochrome?: boolean;
    theme?: MermaidTheme;
    orientation?: MermaidOrientation;
    highlightingTarget?: Set<Digest>;
}

export declare enum MermaidOrientation {
    LeftToRight = "LR",
    TopToBottom = "TB",
    RightToLeft = "RL",
    BottomToTop = "BT"
}

export declare enum MermaidTheme {
    Default = "default",
    Neutral = "neutral",
    Dark = "dark",
    Forest = "forest",
    Base = "base"
}

declare type ObscureAction = {
    type: "elide";
} | {
    type: "encrypt";
    key: unknown;
} | {
    type: "compress";
};

declare enum ObscureType {
    Elided = "elided",
    Encrypted = "encrypted",
    Compressed = "compressed"
}

/**
 * The read-only tags-store surface.
 */
declare interface ReadonlyTagsStore {
    /**
     * Get the assigned name for a tag, if any.
     *
     * @param tag - The tag to look up
     * @returns The assigned name, or undefined if no name is registered
     */
    assignedNameForTag(tag: Tag): string | undefined;
    /**
     * Get a display name for a tag.
     *
     * @param tag - The tag to get a name for
     * @returns The assigned name if available, otherwise the tag value as a string
     */
    nameForTag(tag: Tag): string;
    /**
     * Look up a tag by its numeric value.
     *
     * @param value - The numeric tag value
     * @returns The Tag object if found, undefined otherwise
     */
    tagForValue(value: CborNumber): Tag | undefined;
    /**
     * Look up a tag by its name.
     *
     * @param name - The tag name
     * @returns The Tag object if found, undefined otherwise
     */
    tagForName(name: string): Tag | undefined;
    /**
     * Get a display name for a tag value.
     *
     * @param value - The numeric tag value
     * @returns The tag name if registered, otherwise the value as a string
     */
    nameForValue(value: CborNumber): string;
    /**
     * Get a custom summarizer function for a tag, if registered.
     *
     * @param tag - The numeric tag value
     * @returns The summarizer function if registered, undefined otherwise
     */
    summarizer(tag: CborNumber): CborSummarizer | undefined;
}

export declare const registerMermaidExtension: () => void;

export declare const registerTags: () => void;

export declare const registerTagsIn: (context: FormatContext) => void;

export declare const setEnvelopeFormatHook: (hook: EnvelopeFormatHook) => void;

export declare function shortId(envelope: Envelope, format?: "short" | "full" | "ur"): string;

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

/**
 * Result type for summarizer functions: a summary string or a CborError.
 */
declare type SummarizerResult = {
    readonly ok: true;
    readonly value: string;
} | {
    readonly ok: false;
    readonly error: CborError;
};

export declare function summary(envelope: Envelope, maxLength?: number): string;

export declare function summaryWithContext(envelope: Envelope, maxLength: number, context: FormatContext): string;

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
 * Tag registry implementation.
 *
 * Stores tags with their names and optional summarizer functions.
 */
declare class TagsStore implements ReadonlyTagsStore {
    /** Debug label: `Object.prototype.toString` reports `[object TagsStore]`. */
    get [Symbol.toStringTag](): string;
    private readonly _tagsByValue;
    private readonly _tagsByName;
    private readonly _summarizers;
    constructor();
    /**
     * Insert a tag into the registry.
     *
     * - Throws if the tag name is undefined or empty
     * - Throws if a tag with the same value exists with a different name
     * - Allows re-registering the same tag value with the same name
     *
     * @param tag - The tag to register (must have a non-empty name)
     * @throws Error if tag has no name, empty name, or conflicts with existing registration
     *
     * @example
     * ```typescript
     * const store = new TagsStore();
     * store.register(Tag.from(12345, 'myCustomTag'));
     * ```
     */
    register(tag: Tag): void;
    /**
     * Register multiple tags; the conflict-throwing validation in `register()`
     * applies per tag.
     */
    registerAll(tags: Tag[]): void;
    /**
     * Register a custom summarizer function for a tag.
     *
     * @param tagValue - The numeric tag value
     * @param summarizer - The summarizer function
     *
     * @example
     * ```typescript
     * store.setSummarizer(1, (cbor, flat) => {
     *   // Custom date formatting
     *   return `Date(${extractCbor(cbor)})`;
     * });
     * ```
     */
    setSummarizer(tagValue: CborNumber, summarizer: CborSummarizer): void;
    assignedNameForTag(tag: Tag): string | undefined;
    nameForTag(tag: Tag): string;
    tagForValue(value: CborNumber): Tag | undefined;
    tagForName(name: string): Tag | undefined;
    nameForValue(value: CborNumber): string;
    summarizer(tag: CborNumber): CborSummarizer | undefined;
    /**
     * Create a string key for a numeric tag value.
     * Handles both number and bigint types.
     *
     * @private
     */
    private _valueKey;
}

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

export declare function treeFormat(envelope: Envelope, options?: TreeFormatOptions): string;

export declare interface TreeFormatOptions {
    hideNodes?: boolean;
    highlightDigests?: Set<string>;
    digestDisplay?: DigestDisplayFormat | "short" | "full" | "ur";
    context?: FormatContext;
}

declare type Visitor<State> = (envelope: Envelope, level: number, incomingEdge: EdgeType, state: State) => [State, boolean];

export declare const withFormatContext: <T>(action: (context: FormatContext) => T) => T;

export declare const withFormatContextMut: <T>(action: (context: FormatContext) => T) => T;

export { }
