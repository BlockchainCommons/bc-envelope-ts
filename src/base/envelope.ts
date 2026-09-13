import {
  type Cbor,
  cbor as toCborValue,
  CborMap,
  isNumber,
  asArray,
  asMap,
  asText,
  asFloat,
  isFloat,
  expectText,
  expectBoolean,
  expectBytes,
  isNull,
  decodeCbor,
  encodeCbor,
  cbor,
  taggedValue,
  MajorType,
  asBytes,
  asTaggedValue,
  type CborCodec,
  type Tag,
  expectTaggedContent,
  CborDate,
} from "@blockchaincommons/dcbor";
import { EnvelopeError } from "./error";
import type { ToEnvelope, EnvelopeInput } from "./envelope-encodable";
import { KnownValue, UNIT, POSITION, SALT } from "@blockchaincommons/known-values";
import { Digest, type DigestProvider } from "./digest";
import {
  type SymmetricKey,
  EncryptedMessage,
  Nonce,
  AuthenticationTag,
  Compressed,
  Salt,
} from "@blockchaincommons/components";
import { type UR, urFor } from "@blockchaincommons/uniform-resources";
import { chacha20Poly1305 } from "@blockchaincommons/crypto";
import {
  secureRng,
  randomBytes,
  type RandomNumberGenerator,
  type RngOptions,
} from "@blockchaincommons/rand";
import {
  TAG_COMPRESSED,
  TAG_ENCODED_CBOR,
  TAG_ENCRYPTED,
  TAG_ENVELOPE,
  TAG_LEAF,
} from "@blockchaincommons/tags";
import { nextInClosedRangeUsize } from "@blockchaincommons/rand/samplers";

// Type imports for extension method declarations
// These are imported as types only to avoid circular dependencies at runtime

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
export type EnvelopeCase =
  | {
      /** Discriminant. */
      type: "node";
      /** The subject of the node */
      subject: Envelope;
      /** The assertions attached to the subject (frozen; sorted by digest) */
      assertions: readonly Envelope[];
      /** The digest of the node */
      digest: Digest;
    }
  | {
      /** Discriminant. */
      type: "leaf";
      /** The CBOR value contained in the leaf */
      cbor: Cbor;
      /** The digest of the leaf */
      digest: Digest;
    }
  | {
      /** Discriminant. */
      type: "wrapped";
      /** The envelope being wrapped */
      envelope: Envelope;
      /** The digest of the wrapped envelope */
      digest: Digest;
    }
  | {
      /** Discriminant. */
      type: "assertion";
      /** The assertion */
      assertion: Assertion;
    }
  | {
      /** Discriminant. */
      type: "elided";
      /** The digest of the elided content */
      digest: Digest;
    }
  | {
      /** Discriminant. */
      type: "knownValue";
      /** The known value instance */
      value: KnownValue;
      /** The digest of the known value */
      digest: Digest;
    }
  | {
      /** Discriminant. */
      type: "encrypted";
      /** The encrypted message */
      message: EncryptedMessage;
    }
  | {
      /** Discriminant. */
      type: "compressed";
      /** The compressed data */
      value: Compressed;
    };

let ENVELOPE_CODEC: CborCodec<Envelope> | undefined;

/** The thrown value as an `Error` for a `cause`, or `undefined`. */
const asError = (error: unknown): Error | undefined => (error instanceof Error ? error : undefined);
/** The shared `NULL`/`TRUE`/`FALSE`/`UNIT` envelopes, built on first use. */
const CONSTANTS: { NULL?: Envelope; TRUE?: Envelope; FALSE?: Envelope; UNIT?: Envelope } = {};

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
export class Envelope implements DigestProvider {
  private readonly _case: EnvelopeCase;

  /**
   * Private constructor. Use static factory methods to create envelopes.
   *
   * @param envelopeCase - The envelope case variant
   */
  private constructor(envelopeCase: EnvelopeCase) {
    // An envelope is a value: its case and assertion list can never change
    // under a cached digest.
    if (envelopeCase.type === "node") Object.freeze(envelopeCase.assertions);
    this._case = Object.freeze(envelopeCase);
  }

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
  get case(): EnvelopeCase {
    return this._case;
  }

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
  static from(subject: EnvelopeInput): Envelope {
    // Convert the subject to an envelope
    if (subject instanceof Envelope) {
      return subject;
    }

    // Handle KnownValue specially to create knownValue envelopes
    if (subject instanceof KnownValue) {
      return Envelope.knownValue(subject);
    }

    // If the value implements `ToEnvelope`, defer to its
    // `toEnvelope()` so structured types (e.g. `ProvenanceMarkGenerator`,
    // `Permissions`) build the same envelope shape the reference produces via
    // its `ToEnvelope` blanket impl. Tagged-CBOR primitives
    // (those whose `toEnvelope` is just `Envelope.from(this.toCbor())`)
    // still resolve to the same leaf — the reference collapses the two paths
    // identically. Skip this branch for `Uint8Array`, which is a
    // built-in encodable but should produce a byte-string leaf, not be
    // confused with a class that happens to have an `toEnvelope`.
    if (
      typeof subject === "object" &&
      subject !== null &&
      !(subject instanceof Uint8Array) &&
      "toEnvelope" in subject &&
      typeof (subject as { toEnvelope?: unknown }).toEnvelope === "function"
    ) {
      return subject.toEnvelope();
    }

    // Handle primitives and create leaf envelopes
    return Envelope.leaf(subject);
  }
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
  static fromOptional(subject: EnvelopeInput | undefined): Envelope | undefined {
    if (subject === undefined || subject === null) {
      return undefined;
    }
    return Envelope.from(subject);
  }

  /**
   * Creates an envelope from an EnvelopeCase.
   *
   * This is an internal method used by extensions to create envelopes
   * from custom case types like compressed or encrypted.
   *
   * @param envelopeCase - The envelope case to wrap
   * @returns A new envelope with the given case
   */
  static fromCase(envelopeCase: EnvelopeCase): Envelope {
    return new Envelope(envelopeCase);
  }

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
  static assertion(predicate: EnvelopeInput, object: EnvelopeInput): Envelope {
    const predicateEnv = predicate instanceof Envelope ? predicate : Envelope.from(predicate);
    const objectEnv = object instanceof Envelope ? object : Envelope.from(object);
    return Envelope.fromAssertion(new Assertion(predicateEnv, objectEnv));
  }

  /**
   * Creates a null envelope (containing CBOR null).
   *
   * @returns A null envelope
   */
  static get NULL(): Envelope {
    return (CONSTANTS.NULL ??= Envelope.leaf(null));
  }

  //
  // Internal constructors
  //

  /**
   * Creates an envelope with a subject and unchecked assertions.
   *
   * The assertions are sorted by digest and the envelope's digest is calculated.
   *
   * @param subject - The subject envelope
   * @param uncheckedAssertions - The assertions to attach
   * @returns A new node envelope
   */
  private static nodeUnchecked(
    subject: Envelope,
    uncheckedAssertions: readonly Envelope[],
  ): Envelope {
    if (uncheckedAssertions.length === 0) {
      throw EnvelopeError.invalidParameter("assertions", "a non-empty array");
    }

    // Sort assertions by digest
    const sortedAssertions = [...uncheckedAssertions].sort((a, b) => {
      const aHex = a.digest().toHex();
      const bHex = b.digest().toHex();
      return aHex.localeCompare(bHex);
    });

    // Calculate digest from subject and all assertions
    const digests = [subject.digest(), ...sortedAssertions.map((a) => a.digest())];
    const digest = Digest.fromDigests(digests);

    return new Envelope({
      type: "node",
      subject,
      assertions: sortedAssertions,
      digest,
    });
  }

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
  static node(
    subject: Envelope,
    assertions: readonly Envelope[],
    { unchecked = false }: { unchecked?: boolean } = {},
  ): Envelope {
    if (unchecked) return Envelope.nodeUnchecked(subject, assertions);
    // Validate that all assertions are assertion or obscured envelopes
    for (const assertion of assertions) {
      if (!assertion.isSubjectAssertion() && !assertion.isSubjectObscured()) {
        throw EnvelopeError.invalidFormat();
      }
    }

    return Envelope.node(subject, assertions, { unchecked: true });
  }

  /**
   * Creates an envelope with an assertion as its subject.
   *
   * @param assertion - The assertion
   * @returns A new assertion envelope
   */
  static fromAssertion(assertion: Assertion): Envelope {
    return new Envelope({
      type: "assertion",
      assertion,
    });
  }

  /**
   * Creates an envelope with a known value.
   *
   * @param value - The known value (can be a KnownValue instance or a number/bigint)
   * @returns A new known value envelope
   */
  static knownValue(value: KnownValue | number | bigint): Envelope {
    let knownValue: KnownValue;
    if (value instanceof KnownValue) {
      knownValue = value;
    } else {
      try {
        knownValue = new KnownValue(value);
      } catch (error) {
        throw EnvelopeError.invalidParameter(
          "value",
          "an unsigned 64-bit integer",
          value,
          asError(error),
        );
      }
    }
    // Calculate digest from CBOR encoding of the known value
    const digest = Digest.fromImage(knownValue.toCbor().toData());
    return new Envelope({
      type: "knownValue",
      value: knownValue,
      digest,
    });
  }

  /**
   * Creates an envelope with encrypted content.
   *
   * `Err(Error::MissingDigest)` when the message has no AAD digest.
   *
   * @param encryptedMessage - The encrypted message
   * @returns A new encrypted envelope
   * @throws {EnvelopeError} If the encrypted message doesn't have a digest
   */
  static encrypted(encryptedMessage: EncryptedMessage): Envelope {
    if (!encryptedMessage.hasDigest()) {
      throw EnvelopeError.missingDigest();
    }
    return new Envelope({
      type: "encrypted",
      message: encryptedMessage,
    });
  }

  /**
   * Creates an envelope with compressed content.
   *
   * `Err(Error::MissingDigest)` when the compressed value has no digest.
   *
   * @param compressed - The compressed data
   * @returns A new compressed envelope
   * @throws {EnvelopeError} If the compressed data doesn't have a digest
   */
  static compressed(compressed: Compressed): Envelope {
    if (!compressed.hasDigest()) {
      throw EnvelopeError.missingDigest();
    }
    return new Envelope({
      type: "compressed",
      value: compressed,
    });
  }

  /**
   * Creates an elided envelope containing only a digest.
   *
   * @param digest - The digest of the elided content
   * @returns A new elided envelope
   */
  static elided(digest: Digest): Envelope {
    return new Envelope({
      type: "elided",
      digest,
    });
  }

  /**
   * Creates a leaf envelope containing a CBOR value.
   *
   * @param value - The value to encode as CBOR
   * @returns A new leaf envelope
   */
  static leaf(value: unknown): Envelope {
    // Convert value to CBOR
    const cbor = Envelope.valueToCbor(value);

    // Calculate digest from CBOR bytes
    const cborBytes = Envelope.cborToBytes(cbor);
    const digest = Digest.fromImage(cborBytes);

    return new Envelope({
      type: "leaf",
      cbor,
      digest,
    });
  }

  /**
   * Creates a wrapped envelope.
   *
   * @param subject - The envelope (or value) to wrap
   * @returns A new wrapped envelope
   */
  static wrap(subject: EnvelopeInput): Envelope {
    const envelope = Envelope.from(subject);
    const digest = Digest.fromDigests([envelope.digest()]);
    return new Envelope({
      type: "wrapped",
      envelope,
      digest,
    });
  }

  /**
   * Returns the digest of this envelope.
   *
   *
   * @returns The envelope's digest
   */
  digest(): Digest {
    const c = this._case;
    switch (c.type) {
      case "node":
      case "leaf":
      case "wrapped":
      case "elided":
      case "knownValue":
        return c.digest;
      case "assertion":
        return c.assertion.digest();
      case "encrypted": {
        // The AAD parses back to the plaintext envelope's digest
        // (`@blockchaincommons/components::EncryptedMessage::aadDigest()` returns
        // `null` if the AAD is absent or doesn't decode as a tagged
        // Digest — both are construction-time errors.).
        const digest = c.message.aadDigest();
        if (digest === null) {
          throw EnvelopeError.missingDigest();
        }
        return digest;
      }
      case "compressed": {
        // Get digest from compressed value
        const digest = c.value.digestOpt();
        if (digest === undefined) {
          throw EnvelopeError.missingDigest();
        }
        return digest;
      }
    }
  }

  /**
   * Returns the subject of this envelope.
   *
   * For different envelope cases:
   * - Node: Returns the subject envelope
   * - Other cases: Returns the envelope itself
   *
   * @returns The subject envelope
   */
  subject(): Envelope {
    const c = this._case;
    switch (c.type) {
      case "node":
        return c.subject;
      case "leaf":
      case "wrapped":
      case "assertion":
      case "elided":
      case "knownValue":
      case "encrypted":
      case "compressed":
        return this;
    }
  }

  /**
   * Checks if the envelope's subject is an assertion.
   *
   * @returns `true` if the subject is an assertion, `false` otherwise
   */
  isSubjectAssertion(): boolean {
    if (this._case.type === "assertion") return true;
    if (this._case.type === "node") return this._case.subject.isSubjectAssertion();
    return false;
  }

  /**
   * Checks if the envelope's subject is obscured (elided, encrypted, or compressed).
   *
   * @returns `true` if the subject is obscured, `false` otherwise
   */
  isSubjectObscured(): boolean {
    return this.isSubjectElided() || this.isSubjectEncrypted() || this.isSubjectCompressed();
  }

  //
  // CBOR conversion helpers
  //

  /**
   * Converts a value to CBOR.
   *
   * @param value - The value to convert
   * @returns A CBOR representation
   */
  private static valueToCbor(value: unknown): Cbor {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw EnvelopeError.invalidParameter("date", "a valid Date", value);
      }
      return CborDate.fromDate(value).toCbor();
    }
    if (value === undefined) {
      throw EnvelopeError.invalidParameter("value", "an encodable value (undefined is not)");
    }
    return cbor(value as Parameters<typeof cbor>[0]);
  }

  /**
   * Converts CBOR to bytes.
   *
   * @param cbor - The CBOR value
   * @returns Byte representation
   */
  private static cborToBytes(cbor: Cbor): Uint8Array {
    // Import encodeCbor function at runtime to avoid circular dependencies

    return encodeCbor(cbor);
  }

  /**
   * Returns the untagged CBOR representation of this envelope.
   *
   * @returns The untagged CBOR
   */
  untaggedCbor(): Cbor {
    const c = this._case;
    switch (c.type) {
      case "node": {
        // Array with subject followed by assertions
        const result = [c.subject.untaggedCbor()];
        for (const assertion of c.assertions) {
          result.push(assertion.untaggedCbor());
        }
        return Envelope.valueToCbor(result);
      }
      case "leaf":
        // Tagged with TAG_LEAF (201)
        return taggedValue(TAG_LEAF, c.cbor);
      case "wrapped":
        // Wrapped envelopes are tagged with TAG_ENVELOPE
        return c.envelope.toCbor();
      case "assertion":
        // Assertions convert to CBOR maps
        return c.assertion.toCbor();
      case "elided":
        // Elided is just the digest bytes
        return Envelope.valueToCbor(c.digest.bytes);
      case "knownValue":
        // Known values are encoded as untagged unsigned integers
        // This matches the reference: value.untagged_cbor()
        return c.value.untaggedCbor();
      case "encrypted": {
        // Encrypted envelopes serialize as the canonical
        // `@blockchaincommons/components::EncryptedMessage` tagged CBOR
        // (tag 40002, array `[ciphertext, nonce, auth, ?aadBytes]`).
        // The AAD bytes are the **CBOR-encoded tagged Digest** of the
        // plaintext, matching the reference
        // `bc-components/src/symmetric/symmetric_key.rs::encrypt_with_digest`.
        return c.message.toCbor();
      }
      case "compressed": {
        // Compressed envelopes serialize as the canonical
        // `@blockchaincommons/components::Compressed` tagged CBOR
        // (tag 40003, array `[checksum, decompressedSize, compressedData, ?digest]`).
        return c.value.toCbor();
      }
    }
  }

  /**
   * Returns the tagged CBOR representation of this envelope.
   *
   * All envelopes are tagged with TAG_ENVELOPE (200).
   *
   * @returns The tagged CBOR
   */
  toCbor(): Cbor {
    return taggedValue(TAG_ENVELOPE, this.untaggedCbor());
  }

  /** Tagged-CBOR codec; `decode` also accepts the untagged form. */
  static get codec(): CborCodec<Envelope> {
    return (ENVELOPE_CODEC ??= {
      tags: [TAG_ENVELOPE],
      encode: (e) => e.toCbor(),
      // Tagged-only, like every codec in the stack (`decodeURWith` re-tags a UR body).
      decode: (c) => Envelope.fromCbor(c),
    });
  }

  /** The envelope tag (200). */
  cborTags(): Tag[] {
    return [TAG_ENVELOPE];
  }

  /** As `ur:envelope/…`. */
  toUR(): UR {
    return urFor(this);
  }

  /**
   * Decodes an envelope from its tagged CBOR (tag 200).
   *
   * @throws {EnvelopeError} If the CBOR is not a tagged envelope
   */
  static fromCbor(cbor: Cbor): Envelope {
    // Only the tag check is wrapped here; the structure's own errors pass through.
    let untagged: Cbor;
    try {
      untagged = expectTaggedContent(cbor, TAG_ENVELOPE.value);
    } catch (error) {
      const got = asTaggedValue(cbor)?.[0].value;
      throw EnvelopeError.cbor(
        `expected CBOR tag envelope (${TAG_ENVELOPE.value}), but got ${got === undefined ? "an untagged value" : String(got)}`,
        asError(error),
      );
    }
    return Envelope.fromUntaggedCbor(untagged);
  }

  /**
   * Decodes an envelope from tagged CBOR bytes.
   *
   * @throws {EnvelopeError} If the data is not valid CBOR or not an envelope
   */
  static fromBytes(data: Uint8Array): Envelope {
    // Only the CBOR decode is wrapped here (T1); `fromCbor` reports the rest.
    let cbor: Cbor;
    try {
      cbor = decodeCbor(data);
    } catch (error) {
      throw EnvelopeError.cbor("invalid envelope", asError(error));
    }
    return Envelope.fromCbor(cbor);
  }

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
  static fromUntaggedCbor(cbor: Cbor): Envelope {
    try {
      return Envelope.decodeUntagged(cbor);
    } catch (error) {
      if (EnvelopeError.isEnvelopeError(error)) {
        if (error.code === "Cbor") throw error;
        throw EnvelopeError.cbor(
          error.details.code === "InvalidParameter" ? error.message : error.details.message,
          error,
        );
      }
      throw EnvelopeError.cbor("invalid envelope", asError(error));
    }
  }

  private static decodeUntagged(cbor: Cbor): Envelope {
    // Check if it's a tagged value
    const tagged = asTaggedValue(cbor);
    if (tagged !== undefined) {
      const [tag, item] = tagged;
      switch (tag.value) {
        case TAG_LEAF.value:
        case TAG_ENCODED_CBOR.value:
          // Leaf envelope
          return Envelope.leaf(item);
        case TAG_ENVELOPE.value: {
          // Wrapped envelope
          const envelope = Envelope.fromUntaggedCbor(item);
          return Envelope.wrap(envelope);
        }
        case TAG_COMPRESSED.value:
          // components' decoder (`[checksum, decompressedSize, compressedData, ?digest]`).
          return Envelope.compressed(
            decodeComponent(() => Compressed.fromCbor(cbor), "invalid compressed envelope"),
          );
        case TAG_ENCRYPTED.value:
          // components' decoder (`[ciphertext, nonce, auth, ?aad]`, the aad being the digest).
          return Envelope.encrypted(
            decodeComponent(() => EncryptedMessage.fromCbor(cbor), "invalid encrypted envelope"),
          );
        default:
          throw EnvelopeError.cbor(`unknown envelope tag: ${tag.value}`);
      }
    }

    // Check if it's a byte string (elided)
    const bytes = asBytes(cbor);
    if (bytes !== undefined) {
      if (bytes.length !== 32) {
        throw EnvelopeError.cbor(`invalid digest size: expected 32, got ${bytes.length}`);
      }
      return Envelope.elided(Digest.from(bytes));
    }

    // Check if it's an array (node)
    const array = asArray(cbor);
    if (array !== undefined) {
      if (array.length < 2) {
        throw EnvelopeError.cbor("node must have at least two elements");
      }
      const subjectCbor = array[0];
      if (subjectCbor === undefined) {
        throw EnvelopeError.cbor("node subject is missing");
      }
      const subject = Envelope.fromUntaggedCbor(subjectCbor);
      const assertions: Envelope[] = [];
      for (let i = 1; i < array.length; i++) {
        const assertionCbor = array[i];
        if (assertionCbor === undefined) {
          throw EnvelopeError.cbor(`node assertion at index ${i} is missing`);
        }
        assertions.push(Envelope.fromUntaggedCbor(assertionCbor));
      }
      return Envelope.node(subject, assertions);
    }

    // A map is an assertion
    const map = asMap(cbor);
    if (map !== undefined) {
      const assertion = decodeComponent(() => Assertion.fromCborMap(map), "invalid assertion");
      return Envelope.fromAssertion(assertion);
    }

    // An unsigned integer is a known value
    if (cbor.type === MajorType.Unsigned) {
      const knownValue = decodeComponent(() => new KnownValue(cbor.value), "invalid known value");
      return Envelope.knownValue(knownValue);
    }

    throw EnvelopeError.cbor("invalid envelope");
  }

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
  addAssertion(
    predicate: EnvelopeInput,
    object: EnvelopeInput,
    options: AddAssertionOptions = {},
  ): Envelope {
    const assertion = Envelope.assertion(predicate, object);
    return this.addAssertionEnvelope(assertion, options);
  }

  /**
   * Adds an assertion envelope to this envelope.
   *
   * @param assertion - The assertion envelope
   * @returns A new envelope with the assertion added
   */
  addAssertionEnvelope(assertion: Envelope, { salt = false }: AddAssertionOptions = {}): Envelope {
    // The check runs on the unsalted envelope: a salted assertion is a node
    // (the assertion plus its `salt` assertion), which it would reject.
    if (!assertion.isSubjectAssertion() && !assertion.isSubjectObscured()) {
      throw EnvelopeError.invalidFormat();
    }
    const added = salt ? assertion.addSalt() : assertion;
    const c = this._case;
    if (c.type === "node") {
      // An assertion already present (by digest) leaves the envelope unchanged.
      if (c.assertions.some((a) => a.digest().equals(added.digest()))) return this;
      return Envelope.node(c.subject, [...c.assertions, added], { unchecked: true });
    }
    return Envelope.node(this, [added], { unchecked: true });
  }

  /**
   * Creates a string representation of this envelope.
   *
   * @returns A string representation
   */
  toString(): string {
    return `Envelope(${this._case.type})`;
  }

  // Creates a shallow copy of this envelope.
  //
  // Since envelopes are immutable, this returns the same instance.
  //
  // @returns This envelope
  //
  // Format methods (implemented via prototype extension in format module)
  //

  // Returns a tree-formatted string representation of the envelope.
  //
  // The tree format displays the hierarchical structure of the envelope,
  // showing subjects, assertions, and their relationships.
  //
  // @param options - Optional formatting options
  // @returns A tree-formatted string

  // Returns a short identifier for this envelope based on its digest.
  //
  // @param format - Format for the digest ('short', 'full', or 'ur')
  // @returns A digest identifier string

  // Returns a summary string for this envelope.
  //
  // @param maxLength - Maximum length of the summary
  // @returns A summary string

  // Returns an annotated hex representation of the envelope's CBOR encoding.
  //
  // Default is the rich, multi-line annotated dump (tag names + per-line
  // notes), matching the reference `Envelope::hex` /
  // `dcbor::HexFormatOpts { annotate: true }`. Pass `false` to
  // {@link Envelope.hexOpt} for a plain, flat hex string.
  //
  // @returns A multi-line annotated hex string

  // Returns the CBOR-encoded bytes of the envelope.
  //
  // @returns The CBOR bytes

  // Returns a hex representation with explicit annotate flag and optional
  // {@link FormatContext} for tag-name resolution.
  //
  // @param annotate - When true, produce the annotated multi-line dump;
  //   when false, produce a plain hex string (no spaces, no labels).
  // @param context - Optional format context for resolving tag names.
  //   Defaults to the global format context.
  // @returns A hex string in the requested format

  // Returns a CBOR diagnostic notation string for the envelope.
  //
  // `dcbor::diagnostic_opt` with annotation on. For tag-name resolution
  // from a custom {@link FormatContext}, use
  // {@link Envelope.diagnosticAnnotated}.
  //
  // @returns A diagnostic string

  // Returns a CBOR diagnostic notation string with explicit tag annotation
  // and an optional {@link FormatContext} for tag-name resolution.
  //
  // @param context - Optional format context for resolving tag names.
  //   Defaults to the global format context.
  // @returns An annotated diagnostic string

  //
  // Extension methods (implemented via prototype extension in extension modules)
  // These declarations ensure TypeScript recognizes the methods when consuming the package
  //

  // Generic typed extraction methods from envelope-decodable.ts

  // Digest-related methods

  // Alias methods for the reference API compatibility

  // Additional elision method

  /** The `false` leaf. */
  static get FALSE(): Envelope {
    return (CONSTANTS.FALSE ??= Envelope.leaf(false));
  }

  /** The `true` leaf. */
  static get TRUE(): Envelope {
    return (CONSTANTS.TRUE ??= Envelope.leaf(true));
  }

  /**
   * Unit envelopes have the known value ''. They represent a position
   * where no meaningful data *can* exist. In this sense they make a
   * semantically stronger assertion than `null`, which represents a
   * position where no meaningful data currently exists, but could exist in
   * the future.
   */
  static get UNIT(): Envelope {
    return (CONSTANTS.UNIT ??= Envelope.from(UNIT));
  }

  /** Adds every assertion envelope in turn. */
  addAssertionEnvelopes(assertions: Envelope[]): Envelope {
    return assertions.reduce((result, assertion) => result.addAssertionEnvelope(assertion), this);
  }

  /**
   * Adds `assertion` when given (deduplicated by digest); this envelope otherwise.
   *
   * @throws EnvelopeError with code `InvalidFormat`.
   */
  addOptionalAssertionEnvelope(
    assertion: Envelope | undefined,
    { salt = false }: AddAssertionOptions = {},
  ): Envelope {
    if (assertion === undefined) {
      return this;
    }
    return this.addAssertionEnvelope(assertion, { salt });
  }

  /** Adds `predicate: object` when `object` is given; this envelope otherwise. */
  addOptionalAssertion(
    predicate: EnvelopeInput,
    object: EnvelopeInput | undefined,
    options: AddAssertionOptions = {},
  ): Envelope {
    if (object === undefined || object === null) {
      return this;
    }
    return this.addAssertion(predicate, object, options);
  }

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
  addSalt({ salt, length, range, rng }: SaltOptions = {}): Envelope {
    if (salt !== undefined) {
      // The reference's `add_salt_instance` takes any `Salt`; components' `Salt.from` sets the floor.
      const bytes = salt instanceof Salt ? salt.bytes : salt;
      const instance = decodeParameter(
        () => Salt.from(bytes),
        "salt",
        `at least ${MIN_SALT_SIZE} bytes`,
        bytes.length,
      );
      return this.addAssertion(SALT, instance);
    }
    if (length !== undefined) {
      expectLengthAtLeast("length", length, MIN_SALT_SIZE);
      return this.addAssertion(SALT, Salt.from(randomBytes(length, { rng: rng ?? secureRng() })));
    }
    const r = rng ?? secureRng();
    let size: number;
    if (range !== undefined) {
      const { min, max } = range;
      expectLengthAtLeast("range.min", min, MIN_SALT_SIZE);
      expectLengthAtLeast("range.max", max, min);
      // The reference samples a `RangeInclusive<usize>`: the 64-bit draw.
      size = nextInClosedRangeUsize(r, min, max);
    } else {
      const count = this.toCbor().toData().length;
      const minSize = Math.max(8, Math.ceil(count * 0.05));
      const maxSize = Math.max(minSize + 8, Math.ceil(count * 0.25));
      size = nextInClosedRangeUsize(r, minSize, maxSize);
    }
    return this.addAssertion(SALT, Salt.from(randomBytes(size, { rng: r })));
  }

  /**
   * Applies `fn` to this envelope: `e.pipe(sign, key).pipe(encryptSubject, k)`
   * chains the subpath functions without the `/all` facade.
   */
  pipe<A extends unknown[], R>(fn: (envelope: Envelope, ...args: A) => R, ...args: A): R {
    return fn(this, ...args);
  }

  /** Adds `predicate: text` when `text` is not empty; this envelope otherwise. */
  addNonemptyStringAssertion(predicate: EnvelopeInput, str: string): Envelope {
    if (str.length === 0) {
      return this;
    }
    return this.addAssertion(predicate, str);
  }

  /** Adds every assertion envelope in turn. */
  addAssertions(envelopes: Envelope[]): Envelope {
    return envelopes.reduce((result, envelope) => result.addAssertionEnvelope(envelope), this);
  }

  /** Adds `predicate: object` when `condition` holds; this envelope otherwise. */
  addAssertionIf(condition: boolean, predicate: EnvelopeInput, object: EnvelopeInput): Envelope {
    if (condition) {
      return this.addAssertion(predicate, object);
    }
    return this;
  }

  /** Adds `assertion` when `condition` holds; this envelope otherwise. */
  addAssertionEnvelopeIf(condition: boolean, assertionEnvelope: Envelope): Envelope {
    if (condition) {
      return this.addAssertionEnvelope(assertionEnvelope);
    }
    return this;
  }

  /** A copy without `assertion` (matched by digest); this envelope when it was not present. */
  removeAssertion(target: Envelope): Envelope {
    const assertions = this.assertions();
    const targetDigest = target.digest();

    const index = assertions.findIndex((a) => a.digest().equals(targetDigest));

    if (index === -1) {
      // Assertion not found, return unchanged
      return this;
    }

    // Remove the assertion
    const newAssertions = [...assertions.slice(0, index), ...assertions.slice(index + 1)];

    if (newAssertions.length === 0) {
      // No assertions left, return just the subject
      return this.subject();
    }

    // Return envelope with remaining assertions
    return Envelope.node(this.subject(), newAssertions, { unchecked: true });
  }

  /** A copy with `assertion` replaced by `newAssertion`; `NonexistentPredicate` when absent. */
  replaceAssertion(assertion: Envelope, newAssertion: Envelope): Envelope {
    return this.removeAssertion(assertion).addAssertionEnvelope(newAssertion);
  }

  /** A copy with the subject replaced and every assertion kept. */
  replaceSubject(subject: Envelope): Envelope {
    return this.assertions().reduce((e, a) => e.addAssertionEnvelope(a), subject);
  }

  /** The assertions of a node (a frozen array); empty for every other case. */
  assertions(): readonly Envelope[] {
    const c = this.case;
    if (c.type === "node") {
      return c.assertions;
    }
    return [];
  }

  /** `true` when the envelope is the boolean leaf `false`. */
  isFalse(): boolean {
    try {
      return this.expectBoolean() === false;
    } catch {
      return false;
    }
  }

  /** `true` when the envelope is the boolean leaf `true`. */
  isTrue(): boolean {
    try {
      return this.expectBoolean() === true;
    } catch {
      return false;
    }
  }

  /** `true` when the envelope is a boolean leaf. */
  isBool(): boolean {
    try {
      const value = this.expectBoolean();
      return typeof value === "boolean";
    } catch {
      return false;
    }
  }

  /** `true` when the envelope is a number leaf. */
  isNumber(): boolean {
    const leaf = this.asLeaf();
    if (leaf === undefined) {
      return false;
    }

    return isNumber(leaf);
  }

  /** `true` when the envelope is a node whose subject is a number. */
  isSubjectNumber(): boolean {
    return this.subject().isNumber();
  }

  /** `true` when the envelope is the `NaN` leaf. */
  isNaN(): boolean {
    const leaf = this.asLeaf();
    if (leaf === undefined) {
      return false;
    }

    return isFloat(leaf) && Number.isNaN(asFloat(leaf));
  }

  /** `true` when the envelope is a node whose subject is `NaN`. */
  isSubjectNaN(): boolean {
    return this.subject().isNaN();
  }

  /** `true` when the envelope is the `null` leaf. */
  isNull(): boolean {
    try {
      this.expectNull();
      return true;
    } catch (_error) {
      return false;
    }
  }

  /** A copy of the subject's bytes, or `undefined` when it is not a byte-string leaf. */
  asBytes(): Uint8Array<ArrayBuffer> | undefined {
    try {
      return this.expectBytes();
    } catch {
      return undefined;
    }
  }

  /** A copy of the subject's array, or `undefined` when it is not an array leaf. */
  asArray(): readonly Cbor[] | undefined {
    const leaf = this.asLeaf();
    if (leaf === undefined) {
      return undefined;
    }

    const items = asArray(leaf);
    return items === undefined ? undefined : [...items];
  }

  /** A copy of the subject's map, or `undefined` when it is not a map leaf. */
  asMap(): CborMap | undefined {
    const leaf = this.asLeaf();
    if (leaf === undefined) {
      return undefined;
    }

    const map = asMap(leaf);
    if (map === undefined) return undefined;
    // a copy: the leaf's map must not change under the cached digest
    const copy = new CborMap();
    for (const [k, v] of map.entries()) copy.set(k, v);
    return copy;
  }

  /** The subject's text, or `undefined` when it is not a text leaf. */
  asText(): string | undefined {
    const leaf = this.asLeaf();
    if (leaf === undefined) {
      return undefined;
    }

    return asText(leaf);
  }

  /** The subject's CBOR, or `undefined` when it is not a leaf. */
  asLeaf(): Cbor | undefined {
    const c = this.case;
    if (c.type === "leaf") {
      return c.cbor;
    }
    return undefined;
  }

  /** The known value, or `undefined` when the subject is not one. */
  asKnownValue(): KnownValue | undefined {
    const c = this.case;
    if (c.type === "knownValue") {
      return c.value;
    }
    return undefined;
  }

  /**
   * The known value, or `undefined` when the subject is not one.
   *
   * @throws EnvelopeError with code `NotKnownValue`.
   */
  expectKnownValue(): KnownValue {
    const kv = this.asKnownValue();
    if (kv === undefined) {
      throw EnvelopeError.notKnownValue();
    }
    return kv;
  }

  /** `true` when the envelope is a known value. */
  isKnownValue(): boolean {
    return this.case.type === "knownValue";
  }

  /** `true` when the envelope is a node whose subject is the unit known value. */
  isSubjectUnit(): boolean {
    const kv = this.subject().asKnownValue();
    if (kv === undefined) {
      return false;
    }
    return kv.equals(UNIT);
  }

  /**
   * Throws `SubjectNotUnit` unless the subject is the unit known value.
   *
   * @throws EnvelopeError with code `SubjectNotUnit`.
   */
  checkSubjectUnit(): Envelope {
    if (this.isSubjectUnit()) {
      return this;
    }
    throw EnvelopeError.subjectNotUnit();
  }

  /** `true` when the envelope is a node with at least one assertion. */
  hasAssertions(): boolean {
    const c = this.case;
    return c.type === "node" && c.assertions.length > 0;
  }

  /** The assertion, or `undefined` when this envelope is not one. */
  asAssertion(): Envelope | undefined {
    const c = this.case;
    return c.type === "assertion" ? this : undefined;
  }

  /**
   * The assertion, or `undefined` when this envelope is not one.
   *
   * @throws EnvelopeError with code `NotAssertion`.
   */
  expectAssertion(): Envelope {
    const result = this.asAssertion();
    if (result === undefined) {
      throw EnvelopeError.notAssertion();
    }
    return result;
  }

  /** The predicate, or `undefined` when this envelope is not an assertion. */
  asPredicate(): Envelope | undefined {
    // Refer to subject in case the assertion is a node and therefore has
    // its own assertions
    const subj = this.subject();
    const c = subj.case;
    if (c.type === "assertion") {
      return c.assertion.predicate();
    }
    return undefined;
  }

  /**
   * The predicate, or `undefined` when this envelope is not an assertion.
   *
   * @throws EnvelopeError with code `NotAssertion`.
   */
  expectPredicate(): Envelope {
    const result = this.asPredicate();
    if (result === undefined) {
      throw EnvelopeError.notAssertion();
    }
    return result;
  }

  /** The object, or `undefined` when this envelope is not an assertion. */
  asObject(): Envelope | undefined {
    // Refer to subject in case the assertion is a node and therefore has
    // its own assertions
    const subj = this.subject();
    const c = subj.case;
    if (c.type === "assertion") {
      return c.assertion.object();
    }
    return undefined;
  }

  /**
   * The object, or `undefined` when this envelope is not an assertion.
   *
   * @throws EnvelopeError with code `NotAssertion`.
   */
  expectObject(): Envelope {
    const result = this.asObject();
    if (result === undefined) {
      throw EnvelopeError.notAssertion();
    }
    return result;
  }

  /** `true` when the envelope is an assertion. */
  isAssertion(): boolean {
    return this.case.type === "assertion";
  }

  /** `true` when the envelope is elided. */
  isElided(): boolean {
    return this.case.type === "elided";
  }

  /** `true` when the envelope is a leaf. */
  isLeaf(): boolean {
    return this.case.type === "leaf";
  }

  /** `true` when the envelope is a node (a subject with assertions). */
  isNode(): boolean {
    return this.case.type === "node";
  }

  /** `true` when the envelope is a wrapped envelope. */
  isWrapped(): boolean {
    return this.case.type === "wrapped";
  }

  /** `true` when the envelope is internal (a node, a wrapped envelope or an assertion, never a leaf or known value). */
  isInternal(): boolean {
    const type = this.case.type;
    return type === "node" || type === "wrapped" || type === "assertion";
  }

  /** `true` when the envelope is obscured (elided, encrypted or compressed). */
  isObscured(): boolean {
    const type = this.case.type;
    return type === "elided" || type === "encrypted" || type === "compressed";
  }

  /** Every assertion with `predicate`. */
  assertionsWithPredicate(predicate: EnvelopeInput): Envelope[] {
    const predicateEnv = Envelope.from(predicate);
    const predicateDigest = predicateEnv.digest();

    return this.assertions().filter((assertion) => {
      const pred = assertion.subject().asPredicate();
      return pred?.digest().equals(predicateDigest) === true;
    });
  }

  /**
   * The single assertion with `predicate`; `NonexistentPredicate` / `AmbiguousPredicate` otherwise.
   *
   * @throws EnvelopeError with code `NonexistentPredicate`, `AmbiguousPredicate`.
   */
  assertionWithPredicate(predicate: EnvelopeInput): Envelope {
    const matches = this.assertionsWithPredicate(predicate);

    if (matches.length === 0) {
      throw EnvelopeError.nonexistentPredicate();
    }
    if (matches.length > 1) {
      throw EnvelopeError.ambiguousPredicate();
    }

    return matches[0];
  }

  /**
   * The single assertion with `predicate`, or `undefined`; `AmbiguousPredicate` when there are several.
   *
   * @throws EnvelopeError with code `AmbiguousPredicate`.
   */
  optionalAssertionWithPredicate(predicate: EnvelopeInput): Envelope | undefined {
    const matches = this.assertionsWithPredicate(predicate);

    if (matches.length === 0) {
      return undefined;
    }
    if (matches.length > 1) {
      throw EnvelopeError.ambiguousPredicate();
    }

    return matches[0];
  }

  /**
   * The object of the single assertion with `predicate`; `NonexistentPredicate` / `AmbiguousPredicate` otherwise.
   *
   * @throws EnvelopeError with code `NotAssertion`.
   */
  objectForPredicate(predicate: EnvelopeInput): Envelope {
    const assertion = this.assertionWithPredicate(predicate);
    const obj = assertion.asObject();
    if (obj === undefined) {
      throw EnvelopeError.notAssertion();
    }
    return obj;
  }

  /**
   * The object of the single assertion with `predicate`, or `undefined`; `AmbiguousPredicate` when there are several.
   *
   * @throws EnvelopeError with code `AmbiguousPredicate`.
   */
  optionalObjectForPredicate(predicate: EnvelopeInput): Envelope | undefined {
    const matches = this.assertionsWithPredicate(predicate);

    if (matches.length === 0) {
      return undefined;
    }
    if (matches.length > 1) {
      throw EnvelopeError.ambiguousPredicate();
    }

    const obj = matches[0].subject().asObject();
    return obj;
  }

  /**
   * The objects of every assertion with `predicate`.
   *
   * @throws EnvelopeError with code `NotAssertion`.
   */
  objectsForPredicate(predicate: EnvelopeInput): Envelope[] {
    return this.assertionsWithPredicate(predicate).map((assertion) => {
      const obj = assertion.asObject();
      if (obj === undefined) {
        throw EnvelopeError.notAssertion();
      }
      return obj;
    });
  }

  /** The number of elements in the tree (the subject, the assertions and their parts). */
  elementsCount(): number {
    let count = 1; // Count this envelope

    const c = this.case;
    switch (c.type) {
      case "node":
        count += c.subject.elementsCount();
        for (const assertion of c.assertions) {
          count += assertion.elementsCount();
        }
        break;
      case "assertion":
        count += c.assertion.predicate().elementsCount();
        count += c.assertion.object().elementsCount();
        break;
      case "wrapped":
        count += c.envelope.elementsCount();
        break;
      case "leaf":
      case "elided":
      case "knownValue":
      case "encrypted":
      case "compressed":
        // These cases don't contribute additional elements
        break;
    }

    return count;
  }

  /** `true` when the envelope is encrypted or a node whose subject is (recursively). */
  isSubjectEncrypted(): boolean {
    const c = this.case;
    if (c.type === "encrypted") {
      return true;
    }
    if (c.type === "node") {
      return c.subject.isSubjectEncrypted();
    }
    return false;
  }

  /** `true` when the envelope is compressed or a node whose subject is (recursively). */
  isSubjectCompressed(): boolean {
    const c = this.case;
    if (c.type === "compressed") {
      return true;
    }
    if (c.type === "node") {
      return c.subject.isSubjectCompressed();
    }
    return false;
  }

  /** `true` when the envelope is elided or a node whose subject is (recursively). */
  isSubjectElided(): boolean {
    const c = this.case;
    if (c.type === "elided") {
      return true;
    }
    if (c.type === "node") {
      return c.subject.isSubjectElided();
    }
    return false;
  }

  /**
   * Adds a `'position'` assertion with the given ordinal.
   *
   * @throws EnvelopeError with code `InvalidFormat`.
   */
  setPosition(position: number): Envelope {
    if (!Number.isSafeInteger(position) || position < 0) {
      throw EnvelopeError.invalidParameter("position", "a non-negative integer", position);
    }
    // Find all POSITION assertions
    const positionAssertions = this.assertionsWithPredicate(POSITION);

    // If there is more than one POSITION assertion, throw an error
    if (positionAssertions.length > 1) {
      throw EnvelopeError.invalidFormat();
    }

    // If there is a single POSITION assertion, remove it and add the new position
    // Otherwise, just add the new position to this envelope
    const baseEnvelope =
      positionAssertions.length === 1 ? this.removeAssertion(positionAssertions[0]) : this;

    // Add a new POSITION assertion with the given position
    return baseEnvelope.addAssertion(POSITION, position);
  }

  /** The value of the `'position'` assertion, or `undefined`. */
  position(): number {
    // Find the POSITION assertion in the envelope
    const positionEnvelope = this.objectForPredicate(POSITION);

    const positionValue = positionEnvelope.expectNumber();
    if (!Number.isSafeInteger(positionValue) || positionValue < 0) {
      throw EnvelopeError.cbor("position is not an unsigned integer");
    }
    return positionValue;
  }

  /**
   * A copy without the `'position'` assertion.
   *
   * @throws EnvelopeError with code `InvalidFormat`.
   */
  removePosition(): Envelope {
    // Find all POSITION assertions
    const positionAssertions = this.assertionsWithPredicate(POSITION);

    // If there is more than one POSITION assertion, throw an error
    if (positionAssertions.length > 1) {
      throw EnvelopeError.invalidFormat();
    }

    // If there is a single POSITION assertion, remove it
    if (positionAssertions.length === 1) {
      return this.removeAssertion(positionAssertions[0]);
    }

    // No POSITION assertion, return unchanged
    return this;
  }

  /** Wraps this envelope as the subject of a new one, so assertions can be attached to it as a whole. */
  wrap(): Envelope {
    return Envelope.wrap(this);
  }

  /**
   * The wrapped envelope, or `undefined` when this envelope is not a wrapper.
   *
   * @throws EnvelopeError with code `NotWrapped`.
   */
  unwrap(): Envelope {
    const c = this.subject().case;
    if (c.type === "wrapped") {
      return c.envelope;
    }
    throw EnvelopeError.notWrapped();
  }

  /** Visits every node of the tree depth-first, threading `state`; `hideNodes` visits only the leaves' structure. */
  walk<State>(hideNodes: boolean, state: State, visit: Visitor<State>): void {
    if (hideNodes) {
      walkTree(this, 0, EdgeType.None, state, visit);
    } else {
      walkStructure(this, 0, EdgeType.None, state, visit);
    }
  }

  /**
   * Returns the set of digests in the envelope, down to the specified level.
   *
   * the reference uses `HashSet<Digest>` which dedupes by content; native JS `Set`
   * dedupes by reference, so we route inserts through a hex-keyed `Map`
   * before materialising the final `Set`. That keeps the public signature
   * (`Set<Digest>`) while guaranteeing each *value* appears at most once,
   * which is what every consumer of these methods actually wants.
   */
  digests(levelLimit: number): Set<Digest> {
    if (!Number.isSafeInteger(levelLimit) || levelLimit < 0) {
      throw EnvelopeError.invalidParameter("levelLimit", "a non-negative integer", levelLimit);
    }
    const dedup = new Map<string, Digest>();

    const insert = (d: Digest): void => {
      const key = d.toHex();
      if (!dedup.has(key)) dedup.set(key, d);
    };

    const visitor = (
      envelope: Envelope,
      level: number,
      _incomingEdge: EdgeType,
      _state: undefined,
    ): [undefined, boolean] => {
      if (level < levelLimit) {
        insert(envelope.digest());
        insert(envelope.subject().digest());
      }
      return [undefined, false]; // Continue walking
    };

    this.walk(false, undefined, visitor);
    return new Set(dedup.values());
  }

  /**
   * Returns all digests in the envelope at all levels.
   */
  deepDigests(): Set<Digest> {
    return this.digests(Number.MAX_SAFE_INTEGER);
  }

  /**
   * Returns the digests in the envelope down to its second level.
   */
  shallowDigests(): Set<Digest> {
    return this.digests(2);
  }

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
  structuralDigest(): Digest {
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    this.walk(false, undefined, (envelope, _level, _edge, _state) => {
      const c = envelope.case;
      // Discriminator byte for obscured cases — matches the reference line 247-251.
      if (c.type === "encrypted") {
        chunks.push(new Uint8Array([0]));
        totalLength += 1;
      } else if (c.type === "elided") {
        chunks.push(new Uint8Array([1]));
        totalLength += 1;
      } else if (c.type === "compressed") {
        chunks.push(new Uint8Array([2]));
        totalLength += 1;
      }
      const digestBytes = envelope.digest().bytes;
      chunks.push(digestBytes);
      totalLength += digestBytes.length;
      return [undefined, false];
    });

    const image = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      image.set(chunk, offset);
      offset += chunk.length;
    }
    return Digest.fromImage(image);
  }

  /** The object, or `undefined` when this envelope is not an assertion (alias of `tryObject`). */
  object(): Envelope {
    return this.expectObject();
  }

  /** The predicate, or `undefined` when this envelope is not an assertion (alias of `tryPredicate`). */
  predicate(): Envelope {
    return this.expectPredicate();
  }

  /**
   * Elide this envelope, or with options elide (or encrypt or compress)
   * parts of it: `removing` obscures the elements whose digests are listed,
   * `revealing` obscures everything but the listed elements and their
   * ancestors. `action` defaults to `"elide"`.
   */
  elide(options?: ElideOptions): Envelope {
    if (options === undefined) return this.elideAll();
    const digests = (items: Iterable<DigestProvider | Digest>): Set<Digest> =>
      new Set([...items].map((x) => (x instanceof Digest ? x : x.digest())));
    const action = options.action ?? "elide";
    if (options.revealing !== undefined)
      return this.elideRevealingWith(digests(options.revealing), action);
    return this.elideRemovingWith(digests(options.removing ?? []), action);
  }

  /** The whole envelope elided to its digest. */
  private elideAll(): Envelope {
    const c = this.case;
    if (c.type === "elided") {
      return this;
    }
    return Envelope.elided(this.digest());
  }

  /** Elides everything whose digest is in `target`, with `action` (elide, compress or encrypt). */
  private elideRemovingWith(target: Set<Digest>, action: ObscureAction): Envelope {
    return elideSetWithAction(this, target, false, action);
  }

  /** Elides everything whose digest is not in `target` (revealing mode) with `action`. */
  elideSetWithAction(target: Set<Digest>, action: ObscureAction): Envelope {
    return elideSetWithAction(this, target, true, action);
  }

  /** Elides everything whose digest is not in `target`, with `action` (elide, compress or encrypt). */
  private elideRevealingWith(target: Set<Digest>, action: ObscureAction): Envelope {
    return elideSetWithAction(this, target, true, action);
  }

  /**
   * Restores this envelope from `revealed` when their digests match; otherwise returns this envelope.
   *
   * @throws EnvelopeError with code `InvalidDigest`.
   */
  unelide(envelope: Envelope): Envelope {
    if (this.digest().equals(envelope.digest())) {
      return envelope;
    }
    throw EnvelopeError.invalidDigest();
  }

  /**
   * `Set<Digest>` for backward compatibility with callers, but the
   * underlying dedup is by **hex content** (via a hex-keyed Map) so two
   * `Digest` instances that represent the same hash bytes count once,
   * matching the reference's `HashSet<Digest>` semantics.
   */
  nodesMatching(targetDigests: Set<Digest> | undefined, obscureTypes: ObscureType[]): Set<Digest> {
    const dedup = new Map<string, Digest>();
    const insert = (d: Digest): void => {
      const key = d.toHex();
      if (!dedup.has(key)) dedup.set(key, d);
    };

    // Pre-compute the target digest set as a hex lookup for O(1) membership
    // checks (replacing the old O(n) `Array.from(...).some(...)` scan).
    let targetHexes: Set<string> | undefined;
    if (targetDigests !== undefined) {
      targetHexes = new Set<string>();
      for (const d of targetDigests) {
        targetHexes.add(d.toHex());
      }
    }

    const visitor = (envelope: Envelope): void => {
      // Check if this node matches the target digests
      const ownDigest = envelope.digest();
      const digestMatches = targetHexes === undefined || targetHexes.has(ownDigest.toHex());

      if (!digestMatches) {
        return;
      }

      // If no obscure types specified, include all nodes
      if (obscureTypes.length === 0) {
        insert(ownDigest);
        return;
      }

      // Check if this node matches any of the specified obscure types
      const c = envelope.case;
      const typeMatches = obscureTypes.some((obscureType) => {
        if (obscureType === ObscureType.Elided && c.type === "elided") {
          return true;
        }
        if (obscureType === ObscureType.Encrypted && c.type === "encrypted") {
          return true;
        }
        if (obscureType === ObscureType.Compressed && c.type === "compressed") {
          return true;
        }
        return false;
      });

      if (typeMatches) {
        insert(ownDigest);
      }
    };

    // Walk the envelope tree
    walkEnvelope(this, visitor);

    return new Set(dedup.values());
  }

  /** Restores every elided part whose original is in `revealed`, by digest. */
  walkUnelide(envelopes: Envelope[]): Envelope {
    // Build a lookup map of digest -> envelope
    const envelopeMap = new Map<string, Envelope>();
    for (const env of envelopes) {
      envelopeMap.set(env.digest().toHex(), env);
    }

    return walkUnelideWithMap(this, envelopeMap);
  }

  /** Replaces every part whose digest is in `replacements` with the given envelope. */
  walkReplace(target: Set<Digest>, replacement: Envelope): Envelope {
    // Check if this node matches the target
    if (Array.from(target).some((d) => d.equals(this.digest()))) {
      return replacement;
    }

    const c = this.case;

    if (c.type === "node") {
      const newSubject = c.subject.walkReplace(target, replacement);
      const newAssertions = c.assertions.map((a) => a.walkReplace(target, replacement));

      if (
        newSubject.isIdenticalTo(c.subject) &&
        newAssertions.every((a, i) => a.isIdenticalTo(c.assertions[i]))
      ) {
        return this;
      }

      // Validate that all assertions are either assertions or obscured
      return Envelope.node(newSubject, newAssertions);
    }

    if (c.type === "wrapped") {
      const newEnvelope = c.envelope.walkReplace(target, replacement);
      if (newEnvelope.isIdenticalTo(c.envelope)) {
        return this;
      }
      return Envelope.wrap(newEnvelope);
    }

    if (c.type === "assertion") {
      const newPredicate = c.assertion.predicate().walkReplace(target, replacement);
      const newObject = c.assertion.object().walkReplace(target, replacement);

      if (
        newPredicate.isIdenticalTo(c.assertion.predicate()) &&
        newObject.isIdenticalTo(c.assertion.object())
      ) {
        return this;
      }

      return Envelope.assertion(newPredicate, newObject);
    }

    return this;
  }

  /**
   * Two envelopes are equivalent if they have the same digest (semantic equivalence).
   * This is a weaker comparison than `isIdenticalTo` which also checks the case type.
   *
   */
  isEquivalentTo(other: Envelope): boolean {
    return this.digest().equals(other.digest());
  }

  /**
   * short-circuit on a *semantic* mismatch (different `digest()`), then fall
   * through to a {@link Envelope.structuralDigest} comparison. Two envelopes
   * whose digests match but whose structures differ — e.g. an envelope and a
   * version of it with one assertion elided — are **not** identical.
   */
  isIdenticalTo(other: Envelope): boolean {
    if (!this.isEquivalentTo(other)) {
      return false;
    }
    return this.structuralDigest().equals(other.structuralDigest());
  }

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
  walkDecrypt(keys: SymmetricKey[]): Envelope {
    const c = this.case;

    switch (c.type) {
      case "encrypted": {
        // Try each key until one works.
        for (const key of keys) {
          try {
            // `decryptSubject` works on encrypted envelopes too — when the
            // subject *is* the encrypted node, it produces the decrypted
            // envelope.
            const decrypted = this.decryptSubject(key);
            return decrypted.walkDecrypt(keys);
          } catch {
            // This key didn't work; try the next one.
          }
        }
        // No key worked — leave this node alone.
        return this;
      }
      case "node": {
        const newSubject = c.subject.walkDecrypt(keys);
        const newAssertions = c.assertions.map((a) => a.walkDecrypt(keys));
        if (
          newSubject.isIdenticalTo(c.subject) &&
          newAssertions.every((a, i) => a.isIdenticalTo(c.assertions[i]))
        ) {
          return this;
        }
        return Envelope.node(newSubject, newAssertions, { unchecked: true });
      }
      case "wrapped": {
        const newEnvelope = c.envelope.walkDecrypt(keys);
        if (newEnvelope.isIdenticalTo(c.envelope)) {
          return this;
        }
        return newEnvelope.wrap();
      }
      case "assertion": {
        const newPredicate = c.assertion.predicate().walkDecrypt(keys);
        const newObject = c.assertion.object().walkDecrypt(keys);
        if (
          newPredicate.isIdenticalTo(c.assertion.predicate()) &&
          newObject.isIdenticalTo(c.assertion.object())
        ) {
          return this;
        }
        return Envelope.assertion(newPredicate, newObject);
      }
      case "leaf":
      case "knownValue":
      case "elided":
      case "compressed":
        // No-op: these cases have no children to walk and no decrypt
        // operation applies (the reference's match arm `_ => self.clone()`).
        return this;
    }
  }

  /**
   * Recursively walks the envelope and decompresses any compressed node
   * whose digest is in `targetDigests` (or every compressed node if
   * `targetDigests` is undefined). Decompression failures are tolerated —
   * the original node is returned in that case, mirroring the reference's
   * `if let Ok(decompressed) = ...` pattern.
   */
  walkDecompress(targetDigests?: Set<Digest>): Envelope {
    const matchesTarget = (envelope: Envelope): boolean => {
      if (targetDigests === undefined) return true;
      const ownDigest = envelope.digest();
      for (const d of targetDigests) {
        if (d.equals(ownDigest)) return true;
      }
      return false;
    };

    const c = this.case;

    switch (c.type) {
      case "compressed": {
        if (matchesTarget(this)) {
          try {
            const decompressed = this.decompress();
            return decompressed.walkDecompress(targetDigests);
          } catch {
            // Decompression failed — leave this node alone.
          }
        }
        return this;
      }
      case "node": {
        const newSubject = c.subject.walkDecompress(targetDigests);
        const newAssertions = c.assertions.map((a) => a.walkDecompress(targetDigests));
        if (
          newSubject.isIdenticalTo(c.subject) &&
          newAssertions.every((a, i) => a.isIdenticalTo(c.assertions[i]))
        ) {
          return this;
        }
        return Envelope.node(newSubject, newAssertions, { unchecked: true });
      }
      case "wrapped": {
        const newEnvelope = c.envelope.walkDecompress(targetDigests);
        if (newEnvelope.isIdenticalTo(c.envelope)) {
          return this;
        }
        return newEnvelope.wrap();
      }
      case "assertion": {
        const newPredicate = c.assertion.predicate().walkDecompress(targetDigests);
        const newObject = c.assertion.object().walkDecompress(targetDigests);
        if (
          newPredicate.isIdenticalTo(c.assertion.predicate()) &&
          newObject.isIdenticalTo(c.assertion.object())
        ) {
          return this;
        }
        return Envelope.assertion(newPredicate, newObject);
      }
      case "leaf":
      case "knownValue":
      case "elided":
      case "encrypted":
        // No-op: these cases have no children to walk and no decompress
        // operation applies (the reference's match arm `_ => self.clone()`).
        return this;
    }
  }

  /**
   * Add the tryLeaf method to Envelope prototype.
   *
   * This extracts the leaf CBOR value from an envelope.
   *
   * @throws EnvelopeError with code `NotLeaf`.
   */
  expectLeaf(): Cbor {
    const c = this.case;
    if (c.type !== "leaf") {
      throw EnvelopeError.notLeaf();
    }
    return c.cbor;
  }

  /** The subject's text; `NotLeaf` / `Cbor` when it is not a text leaf. */
  expectString(): string {
    return extractString(this);
  }

  /** The subject's number; `NotLeaf` / `Cbor` when it is not a number leaf. */
  expectNumber(): number {
    return extractNumber(this);
  }

  /** The subject's boolean; `NotLeaf` / `Cbor` when it is not a boolean leaf. */
  expectBoolean(): boolean {
    return extractBoolean(this);
  }

  /** A copy of the subject's bytes; `NotLeaf` / `Cbor` when it is not a byte-string leaf. */
  expectBytes(): Uint8Array<ArrayBuffer> {
    return extractBytes(this);
  }

  /** `null`; `NotLeaf` / `Cbor` when the subject is not the `null` leaf. */
  expectNull(): null {
    return extractNull(this);
  }

  /** The subject's tag-1 date as a `Date`; `NotLeaf` / `Cbor` when it is not a date leaf. */
  expectDate(): Date {
    return this.expectSubject((cbor) => CborDate.fromTaggedCbor(cbor).toDate());
  }

  /** `extractSubject` as a method. */
  expectSubject<T>(decoder: CborDecoder<T>): T {
    return extractSubject(this, decoder);
  }

  /**
   * Add tryObjectForPredicate method to Envelope prototype
   */
  expectObjectForPredicate<T>(predicate: EnvelopeInput, decoder: CborDecoder<T>): T {
    return tryObjectForPredicate(this, predicate, decoder);
  }

  /**
   * Add tryOptionalObjectForPredicate method to Envelope prototype
   */
  optionalObjectForPredicateAs<T>(
    predicate: EnvelopeInput,
    decoder: CborDecoder<T>,
  ): T | undefined {
    return tryOptionalObjectForPredicate(this, predicate, decoder);
  }

  /** `extractObjectForPredicateWithDefault` as a method. */
  objectForPredicateOr<T>(predicate: EnvelopeInput, decoder: CborDecoder<T>, defaultValue: T): T {
    return extractObjectForPredicateWithDefault(this, predicate, decoder, defaultValue);
  }

  /** `extractObjectsForPredicate` as a method. */
  expectObjectsForPredicate<T>(predicate: EnvelopeInput, decoder: CborDecoder<T>): T[] {
    return extractObjectsForPredicate(this, predicate, decoder);
  }

  /**
   * A copy with the subject encrypted by `key` (ChaCha20-Poly1305 over the
   * subject's CBOR, the digest as AAD); `AlreadyEncrypted` / `AlreadyElided`
   * when it cannot be.
   *
   * @throws EnvelopeError with code `General`.
   */
  encryptSubject(key: SymmetricKey, options: EncryptOptions = {}): Envelope {
    const c = this.case;

    if (c.type === "encrypted") {
      throw EnvelopeError.alreadyEncrypted();
    }
    if (c.type === "elided") {
      throw EnvelopeError.alreadyElided();
    }

    // For node case, encrypt just the subject
    if (c.type === "node") {
      if (c.subject.isEncrypted()) {
        throw EnvelopeError.alreadyEncrypted();
      }

      // Get the subject's CBOR data
      const subjectCbor = c.subject.toCbor();
      const encodedCbor = encodeCbor(subjectCbor);
      const subjectDigest = c.subject.digest();

      // Encrypt the subject
      const encryptedMessage = encryptWithDigest(key, encodedCbor, subjectDigest, options);

      // Create encrypted envelope
      const encryptedSubject = Envelope.fromCase({
        type: "encrypted",
        message: encryptedMessage,
      });

      // Rebuild the node with encrypted subject and same assertions
      return Envelope.node(encryptedSubject, c.assertions);
    }

    // For other cases, encrypt the entire envelope
    const cbor = this.toCbor();
    const encodedCbor = encodeCbor(cbor);
    const digest = this.digest();

    const encryptedMessage = encryptWithDigest(key, encodedCbor, digest, options);

    return Envelope.fromCase({
      type: "encrypted",
      message: encryptedMessage,
    });
  }

  /**
   * A copy with the subject decrypted by `key`; `NotEncrypted` / `Components` on failure.
   *
   * @throws EnvelopeError with code `General`.
   */
  decryptSubject(key: SymmetricKey): Envelope {
    const subjectCase = this.subject().case;

    if (subjectCase.type !== "encrypted") {
      throw EnvelopeError.notEncrypted();
    }

    const message = subjectCase.message;
    const subjectDigest = message.aadDigest();

    if (subjectDigest === null) {
      throw EnvelopeError.missingDigest();
    }

    const decryptedData = decryptWithDigest(key, message);
    const resultSubject = Envelope.fromBytes(decryptedData);

    if (!resultSubject.digest().equals(subjectDigest)) {
      throw EnvelopeError.invalidDigest();
    }

    const c = this.case;

    // If this is a node, rebuild with decrypted subject
    if (c.type === "node") {
      const result = Envelope.node(resultSubject, c.assertions);
      if (!result.digest().equals(c.digest)) {
        throw EnvelopeError.invalidDigest();
      }
      return result;
    }

    // Otherwise just return the decrypted subject
    return resultSubject;
  }

  /** Wraps this envelope and encrypts the wrapper's subject, so the whole envelope is hidden. */
  encrypt(key: SymmetricKey, options: EncryptOptions = {}): Envelope {
    return this.wrap().encryptSubject(key, options);
  }

  /** Decrypts a subject encrypted with `encrypt` and unwraps it. */
  decrypt(key: SymmetricKey): Envelope {
    const decrypted = this.decryptSubject(key);
    return decrypted.unwrap();
  }

  /** `true` when the envelope is encrypted. */
  isEncrypted(): boolean {
    return this.case.type === "encrypted";
  }

  /**
   * A copy compressed (deflate over its CBOR); this envelope when already compressed.
   *
   * @throws EnvelopeError with code `General`.
   */
  compress(): Envelope {
    const c = this.case;

    // If already compressed, return as-is
    if (c.type === "compressed") {
      return this;
    }

    // Can't compress encrypted or elided envelopes
    if (c.type === "encrypted") {
      throw EnvelopeError.alreadyEncrypted();
    }
    if (c.type === "elided") {
      throw EnvelopeError.alreadyElided();
    }

    // Compress the entire envelope (matches the reference
    // `bc-envelope-rust/src/extension/compress.rs::compress`).
    const cbor = this.toCbor();
    const decompressedData = encodeCbor(cbor);
    const compressed = Compressed.fromDecompressedData(decompressedData, this.digest());
    return Envelope.fromCase({ type: "compressed", value: compressed });
  }

  /**
   * A copy decompressed; this envelope when it is not compressed.
   *
   * @throws EnvelopeError with code `General`.
   */
  decompress(): Envelope {
    const c = this.case;

    if (c.type !== "compressed") {
      throw EnvelopeError.notCompressed();
    }

    const compressed = c.value;
    const digest = compressed.digestOpt();

    if (digest === undefined) {
      throw EnvelopeError.missingDigest();
    }
    if (!digest.equals(this.digest())) {
      throw EnvelopeError.invalidDigest();
    }

    // `Compressed.decompress` verifies the CRC32 checksum itself.
    let decompressedData: Uint8Array;
    try {
      decompressedData = compressed.decompress();
    } catch (error) {
      throw EnvelopeError.components("decompression failed", asError(error));
    }
    const envelope = Envelope.fromBytes(decompressedData);

    if (!envelope.digest().equals(digest)) {
      throw EnvelopeError.invalidDigest();
    }

    return envelope;
  }

  /** A copy with the subject compressed; `AlreadyEncrypted` / `AlreadyElided` when it cannot be. */
  compressSubject(): Envelope {
    if (this.subject().isCompressed()) {
      return this;
    }

    const subject = this.subject().compress();
    return this.replaceSubject(subject);
  }

  /** A copy with the subject decompressed; `NotCompressed` when it is not. */
  decompressSubject(): Envelope {
    if (this.subject().isCompressed()) {
      const subject = this.subject().decompress();
      return this.replaceSubject(subject);
    }

    return this;
  }

  /** `true` when the envelope is compressed. */
  isCompressed(): boolean {
    return this.case.type === "compressed";
  }
}

/**
 * The type of incoming edge provided to the visitor.
 *
 * This enum identifies how an envelope element is connected to its parent in
 * the hierarchy during traversal. It helps the visitor function understand the
 * semantic relationship between elements.
 */
export const EdgeType = {
  /** No incoming edge (root) */
  None: "none",
  /** Element is the subject of a node */
  Subject: "subject",
  /** Element is an assertion on a node */
  Assertion: "assertion",
  /** Element is the predicate of an assertion */
  Predicate: "predicate",
  /** Element is the object of an assertion */
  Object: "object",
  /** Element is the content wrapped by another envelope */
  Content: "content",
} as const;
/** One of the `EdgeType` values. */
export type EdgeType = (typeof EdgeType)[keyof typeof EdgeType];

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
export function edgeLabel(edgeType: EdgeType): string | undefined {
  switch (edgeType) {
    case EdgeType.Subject:
      return "subj";
    case EdgeType.Content:
      return "cont";
    case EdgeType.Predicate:
      return "pred";
    case EdgeType.Object:
      return "obj";
    case EdgeType.None:
    case EdgeType.Assertion:
      return undefined;
    default:
      return undefined;
  }
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
export type Visitor<State> = (
  envelope: Envelope,
  level: number,
  incomingEdge: EdgeType,
  state: State,
) => [State, boolean];

/**
 * Recursive implementation of structure-based traversal.
 *
 * This internal function performs the actual recursive traversal of the
 * envelope structure, visiting every element and maintaining the
 * correct level and edge relationships.
 */
function walkStructure<State>(
  envelope: Envelope,
  level: number,
  incomingEdge: EdgeType,
  state: State,
  visit: Visitor<State>,
): void {
  // Visit this envelope
  const [newState, stop] = visit(envelope, level, incomingEdge, state);
  if (stop) {
    return;
  }

  const nextLevel = level + 1;
  const c = envelope.case;

  switch (c.type) {
    case "node":
      // Visit subject
      walkStructure(c.subject, nextLevel, EdgeType.Subject, newState, visit);
      // Visit all assertions
      for (const assertion of c.assertions) {
        walkStructure(assertion, nextLevel, EdgeType.Assertion, newState, visit);
      }
      break;

    case "wrapped":
      // Visit wrapped envelope
      walkStructure(c.envelope, nextLevel, EdgeType.Content, newState, visit);
      break;

    case "assertion":
      // Visit predicate and object
      walkStructure(c.assertion.predicate(), nextLevel, EdgeType.Predicate, newState, visit);
      walkStructure(c.assertion.object(), nextLevel, EdgeType.Object, newState, visit);
      break;

    case "leaf":
    case "elided":
    case "knownValue":
    case "encrypted":
    case "compressed":
      // Leaf nodes and other types have no children
      break;
  }
}

/**
 * Recursive implementation of tree-based traversal.
 *
 * This internal function performs the actual recursive traversal of the
 * envelope's semantic tree, skipping node containers and focusing on
 * the semantic content elements. It maintains the correct level and
 * edge relationships while skipping structural elements.
 */
function walkTree<State>(
  envelope: Envelope,
  level: number,
  incomingEdge: EdgeType,
  state: State,
  visit: Visitor<State>,
): State {
  let currentState = state;
  let subjectLevel = level;

  // Skip visiting if this is a node
  if (!envelope.isNode()) {
    const [newState, stop] = visit(envelope, level, incomingEdge, currentState);
    if (stop) {
      return newState;
    }
    currentState = newState;
    subjectLevel = level + 1;
  }

  const c = envelope.case;

  switch (c.type) {
    case "node": {
      // Visit subject
      const assertionState = walkTree(
        c.subject,
        subjectLevel,
        EdgeType.Subject,
        currentState,
        visit,
      );
      // Visit all assertions
      const assertionLevel = subjectLevel + 1;
      for (const assertion of c.assertions) {
        walkTree(assertion, assertionLevel, EdgeType.Assertion, assertionState, visit);
      }
      break;
    }

    case "wrapped":
      // Visit wrapped envelope
      walkTree(c.envelope, subjectLevel, EdgeType.Content, currentState, visit);
      break;

    case "assertion":
      // Visit predicate and object
      walkTree(c.assertion.predicate(), subjectLevel, EdgeType.Predicate, currentState, visit);
      walkTree(c.assertion.object(), subjectLevel, EdgeType.Object, currentState, visit);
      break;

    case "leaf":
    case "elided":
    case "knownValue":
    case "encrypted":
    case "compressed":
      // Leaf nodes and other types have no children
      break;
  }

  return currentState;
}

/** How an obscured element was obscured. */
export const ObscureType = {
  /** Replaced by its digest. */
  Elided: "elided",
  /** Replaced by an `EncryptedMessage` of its CBOR. */
  Encrypted: "encrypted",
  /** Replaced by a `Compressed` of its CBOR. */
  Compressed: "compressed",
} as const;
/** One of the `ObscureType` values. */
export type ObscureType = (typeof ObscureType)[keyof typeof ObscureType];

/**
 * Actions that can be performed on parts of an envelope to obscure them.
 *
 * Gordian Envelope supports several ways to obscure parts of an envelope while
 * maintaining its semantic integrity and digest tree.
 */
export type ObscureAction =
  | "elide"
  | "compress"
  | {
      /** Encrypt with this key instead of eliding. */
      encrypt: SymmetricKey;
    };

/** Options for `Envelope.encryptSubject` and `encrypt`. */
export interface EncryptOptions extends RngOptions {
  /** Use exactly this nonce (12 bytes); tests and vectors only — never reuse one with a key. */
  nonce?: Nonce | undefined;
}

/** Options for `Envelope.addAssertion` and friends. */
export interface AddAssertionOptions {
  /** Also salt the assertion (see `addSalt`) so its digest is not correlatable. */
  salt?: boolean;
}

const MIN_SALT_SIZE = 8;

/** Options for `Envelope.addSalt`. */
export interface SaltOptions {
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

/** Options for `Envelope.elide`. */
export interface ElideOptions {
  /** Obscure these elements (by digest). */
  removing?: Iterable<DigestProvider | Digest>;
  /** Obscure everything except these elements and their ancestors. */
  revealing?: Iterable<DigestProvider | Digest>;
  /** What to do to the targeted elements; `"elide"` by default. */
  action?: ObscureAction;
}

// Late-binding handler for the encrypt obscure action.
// Registered by extension/encrypt.ts to avoid circular dependencies.

// Registers the handler for the encrypt obscure action.
// Called by registerEncryptExtension() during module initialization.

/** Core elision logic */
function elideSetWithAction(
  envelope: Envelope,
  target: Set<Digest>,
  isRevealing: boolean,
  action: ObscureAction,
): Envelope {
  const selfDigest = envelope.digest();
  const targetContainsSelf = Array.from(target).some((d) => d.equals(selfDigest));

  // Target Matches  isRevealing  elide
  // false          false         false
  // false          true          true
  // true           false         true
  // true           true          false

  if (targetContainsSelf !== isRevealing) {
    // Should obscure this envelope
    if (action === "elide") {
      return envelope.elide();
    } else if (typeof action === "object") {
      return encryptWholeEnvelope(envelope, action.encrypt);
    } else if (action === "compress") {
      return envelope.compress();
    }
  }

  const c = envelope.case;

  // Recursively process structure
  if (c.type === "assertion") {
    const predicate = elideSetWithAction(c.assertion.predicate(), target, isRevealing, action);
    const object = elideSetWithAction(c.assertion.object(), target, isRevealing, action);
    const elidedAssertion = new Assertion(predicate, object);
    return Envelope.fromAssertion(elidedAssertion);
  } else if (c.type === "node") {
    const elidedSubject = elideSetWithAction(c.subject, target, isRevealing, action);
    const elidedAssertions = c.assertions.map((a) =>
      elideSetWithAction(a, target, isRevealing, action),
    );
    return Envelope.node(elidedSubject, elidedAssertions, { unchecked: true });
  } else if (c.type === "wrapped") {
    const elidedEnvelope = elideSetWithAction(c.envelope, target, isRevealing, action);
    return Envelope.wrap(elidedEnvelope);
  }

  return envelope;
}

/** Helper to walk envelope tree */
function walkEnvelope(envelope: Envelope, visitor: (e: Envelope) => void): void {
  visitor(envelope);

  const c = envelope.case;
  if (c.type === "node") {
    walkEnvelope(c.subject, visitor);
    for (const assertion of c.assertions) {
      walkEnvelope(assertion, visitor);
    }
  } else if (c.type === "assertion") {
    walkEnvelope(c.assertion.predicate(), visitor);
    walkEnvelope(c.assertion.object(), visitor);
  } else if (c.type === "wrapped") {
    walkEnvelope(c.envelope, visitor);
  }
}

/** Helper for walkUnelide with map */
function walkUnelideWithMap(envelope: Envelope, envelopeMap: Map<string, Envelope>): Envelope {
  const c = envelope.case;

  if (c.type === "elided") {
    // Try to find a matching envelope to restore
    const replacement = envelopeMap.get(envelope.digest().toHex());
    return replacement ?? envelope;
  }

  if (c.type === "node") {
    const newSubject = walkUnelideWithMap(c.subject, envelopeMap);
    const newAssertions = c.assertions.map((a) => walkUnelideWithMap(a, envelopeMap));

    if (
      newSubject.isIdenticalTo(c.subject) &&
      newAssertions.every((a, i) => a.isIdenticalTo(c.assertions[i]))
    ) {
      return envelope;
    }

    return Envelope.node(newSubject, newAssertions, { unchecked: true });
  }

  if (c.type === "wrapped") {
    const newEnvelope = walkUnelideWithMap(c.envelope, envelopeMap);
    if (newEnvelope.isIdenticalTo(c.envelope)) {
      return envelope;
    }
    return Envelope.wrap(newEnvelope);
  }

  if (c.type === "assertion") {
    const newPredicate = walkUnelideWithMap(c.assertion.predicate(), envelopeMap);
    const newObject = walkUnelideWithMap(c.assertion.object(), envelopeMap);

    if (
      newPredicate.isIdenticalTo(c.assertion.predicate()) &&
      newObject.isIdenticalTo(c.assertion.object())
    ) {
      return envelope;
    }

    return Envelope.assertion(newPredicate, newObject);
  }

  return envelope;
}

/**
 * Extracts a string value from an envelope.
 *
 * @param envelope - The envelope to extract from
 * @returns The string value
 * @throws {EnvelopeError} If the envelope is not a leaf or cannot be converted
 */
export function extractString(envelope: Envelope): string {
  const cbor = envelope.expectLeaf();
  try {
    return expectText(cbor);
  } catch (error) {
    throw EnvelopeError.cbor(
      "envelope does not contain a string",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Extracts a number value from an envelope.
 *
 * @param envelope - The envelope to extract from
 * @returns The number value
 * @throws {EnvelopeError} If the envelope is not a leaf or cannot be converted
 */
export function extractNumber(envelope: Envelope): number {
  const cbor = envelope.expectLeaf();

  // Handle unsigned, negative, and simple (float) types
  if ("type" in cbor) {
    switch (cbor.type) {
      case 0: // MajorType.Unsigned
        return typeof cbor.value === "bigint" ? Number(cbor.value) : cbor.value;
      case 1: {
        // MajorType.Negative
        // Negative values are stored as magnitude, convert back
        const magnitude = typeof cbor.value === "bigint" ? Number(cbor.value) : cbor.value;
        return -magnitude - 1;
      }
      case 7: // MajorType.Simple
        if (
          typeof cbor.value === "object" &&
          cbor.value !== null &&
          "type" in cbor.value &&
          cbor.value.type === "Float"
        ) {
          return cbor.value.value;
        }
        break;
      case 2: // MajorType.ByteString
      case 3: // MajorType.TextString
      case 4: // MajorType.Array
      case 5: // MajorType.Map
      case 6: // MajorType.Tag
        // These CBOR types don't represent numbers
        break;
    }
  }

  throw EnvelopeError.cbor("envelope does not contain a number");
}

/**
 * Extracts a boolean value from an envelope.
 *
 * @param envelope - The envelope to extract from
 * @returns The boolean value
 * @throws {EnvelopeError} If the envelope is not a leaf or cannot be converted
 */
export function extractBoolean(envelope: Envelope): boolean {
  const cbor = envelope.expectLeaf();
  try {
    return expectBoolean(cbor);
  } catch (error) {
    throw EnvelopeError.cbor(
      "envelope does not contain a boolean",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Extracts a byte array value from an envelope.
 *
 * @param envelope - The envelope to extract from
 * @returns The byte array value
 * @throws {EnvelopeError} If the envelope is not a leaf or cannot be converted
 */
export function extractBytes(envelope: Envelope): Uint8Array<ArrayBuffer> {
  const cbor = envelope.expectLeaf();
  try {
    // a copy: the leaf's bytes must not change under the cached digest
    return new Uint8Array(expectBytes(cbor));
  } catch (error) {
    throw EnvelopeError.cbor(
      "envelope does not contain bytes",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Extracts null from an envelope.
 *
 * @param envelope - The envelope to extract from
 * @throws {EnvelopeError} If the envelope is not a leaf containing null
 */
export function extractNull(envelope: Envelope): null {
  const cbor = envelope.expectLeaf();
  if (isNull(cbor)) {
    return null;
  }
  throw EnvelopeError.cbor("envelope does not contain null");
}

/** Type for CBOR decoder functions */
export type CborDecoder<T> = (cbor: Cbor) => T;

/**
 * Extracts the subject of an envelope as type T using a decoder function.
 *
 * This is the TypeScript equivalent of the reference's `TryFrom<Envelope>` trait bound.
 * Since TypeScript doesn't have trait bounds on generics, we pass a decoder
 * function explicitly.
 *
 * Handles all envelope case types:
 * - leaf: decodes the CBOR value
 * - knownValue: converts to tagged CBOR then decodes
 * - wrapped: recurses into the inner envelope
 * - node: recurses on the subject
 *
 * @example
 * ```typescript
 * const envelope = Envelope.from(myEncryptedKey.toCbor());
 * const extracted = envelope.expectSubject(EncryptedKey.fromTaggedCbor);
 * ```
 *
 * @param decoder - Function to decode CBOR to type T
 * @returns The decoded value of type T
 * @throws {EnvelopeError} If the envelope case is unsupported or decoding fails
 */
export function extractSubject<T>(envelope: Envelope, decoder: CborDecoder<T>): T {
  const subject = envelope.subject();
  const c = subject.case;

  switch (c.type) {
    case "leaf":
      try {
        return decoder(c.cbor);
      } catch (error) {
        throw EnvelopeError.cbor(
          "failed to decode subject",
          error instanceof Error ? error : undefined,
        );
      }
    case "knownValue":
      try {
        return decoder(c.value.toCbor());
      } catch (error) {
        throw EnvelopeError.cbor(
          "failed to decode subject",
          error instanceof Error ? error : undefined,
        );
      }
    case "wrapped":
      // The reference yields the wrapped envelope only when `T` is `Envelope`;
      // a CBOR decoder cannot take it, so it is `InvalidFormat` (use `unwrap()`).
      throw EnvelopeError.invalidFormat();
    case "node":
      return extractSubject(c.subject, decoder);
    case "assertion":
      try {
        return decoder(c.assertion.toCbor());
      } catch {
        throw EnvelopeError.invalidFormat();
      }
    case "elided":
      try {
        return decoder(c.digest.toCbor());
      } catch {
        throw EnvelopeError.invalidFormat();
      }
    case "encrypted":
      throw EnvelopeError.invalidFormat();
    case "compressed":
      throw EnvelopeError.invalidFormat();
  }
}

/**
 * Extracts the object for a predicate as type T using a decoder function.
 *
 * @param envelope - The envelope to query
 * @param predicate - The predicate to match
 * @param decoder - Function to decode CBOR to type T
 * @returns The decoded value of type T
 * @throws {EnvelopeError} If predicate not found or decoding fails
 */
export function tryObjectForPredicate<T>(
  envelope: Envelope,
  predicate: EnvelopeInput,
  decoder: CborDecoder<T>,
): T {
  const obj = envelope.objectForPredicate(predicate);
  return extractSubject(obj, decoder);
}

/**
 * Extracts the optional object for a predicate as type T using a decoder function.
 *
 * @param envelope - The envelope to query
 * @param predicate - The predicate to match
 * @param decoder - Function to decode CBOR to type T
 * @returns The decoded value of type T, or undefined if predicate not found
 * @throws {EnvelopeError} If decoding fails (but not if predicate not found)
 */
export function tryOptionalObjectForPredicate<T>(
  envelope: Envelope,
  predicate: EnvelopeInput,
  decoder: CborDecoder<T>,
): T | undefined {
  const obj = envelope.optionalObjectForPredicate(predicate);
  if (obj === undefined) {
    return undefined;
  }
  return extractSubject(obj, decoder);
}

/**
 * Extracts the object for a predicate as type T, with a default value if not found.
 *
 * @param envelope - The envelope to query
 * @param predicate - The predicate to match
 * @param decoder - Function to decode CBOR to type T
 * @param defaultValue - Value to return if predicate not found
 * @returns The decoded value of type T, or the default value
 * @throws {EnvelopeError} If decoding fails (but not if predicate not found)
 */
export function extractObjectForPredicateWithDefault<T>(
  envelope: Envelope,
  predicate: EnvelopeInput,
  decoder: CborDecoder<T>,
  defaultValue: T,
): T {
  const result = tryOptionalObjectForPredicate(envelope, predicate, decoder);
  return result ?? defaultValue;
}

/**
 * Extracts all objects for a predicate as type T using a decoder function.
 *
 * @param envelope - The envelope to query
 * @param predicate - The predicate to match
 * @param decoder - Function to decode CBOR to type T
 * @returns Array of decoded values of type T
 * @throws {EnvelopeError} If any decoding fails
 */
export function extractObjectsForPredicate<T>(
  envelope: Envelope,
  predicate: EnvelopeInput,
  decoder: CborDecoder<T>,
): T[] {
  const objects = envelope.objectsForPredicate(predicate);
  return objects.map((obj) => extractSubject(obj, decoder));
}

/**
 * Builds the AAD bytes for a digest, mirroring the reference
 * `bc-components/src/symmetric/symmetric_key.rs::encrypt_with_digest`:
 * `digest.tagged_cbor().to_cbor_data()`.
 */
function digestAadBytes(digest: Digest): Uint8Array {
  return encodeCbor(digest.toCbor());
}

/**
 * Encrypts plaintext with a symmetric key using the digest's CBOR-encoded
 * tagged form as AAD. Returns an {@link EncryptedMessage} whose `aad` field
 * carries the same bytes — so the on-wire CBOR (`[ciphertext, nonce, auth,
 * aadBytes]`) matches the reference byte-for-byte.
 */
function encryptWithDigest(
  key: SymmetricKey,
  plaintext: Uint8Array,
  digest: Digest,
  { nonce, rng }: EncryptOptions = {},
): EncryptedMessage {
  const nonceBytes =
    nonce?.bytes ?? randomBytes(chacha20Poly1305.NONCE_SIZE, { rng: rng ?? secureRng() });
  const aad = digestAadBytes(digest);
  const sealed = chacha20Poly1305.encrypt(key.bytes, nonceBytes, plaintext, { aad });
  const split = sealed.length - chacha20Poly1305.TAG_SIZE;
  return EncryptedMessage.from({
    ciphertext: sealed.subarray(0, split),
    aad,
    nonce: Nonce.from(nonceBytes),
    authTag: AuthenticationTag.from(sealed.subarray(split)),
  });
}

/**
 * Decrypts an {@link EncryptedMessage} using the AAD bytes the message
 * already carries. The AAD must parse as a CBOR-encoded tagged
 * `Digest`; the recovered digest is what callers compare against
 * `Envelope::digest()`.
 */
function decryptWithDigest(key: SymmetricKey, message: EncryptedMessage): Uint8Array {
  const digest = message.aadDigest();
  if (digest === null) {
    throw EnvelopeError.missingDigest();
  }
  const aad = message.aad;
  try {
    const ct = message.ciphertext;
    const tag = message.authenticationTag.bytes;
    const sealed = new Uint8Array(ct.length + tag.length);
    sealed.set(ct, 0);
    sealed.set(tag, ct.length);
    return chacha20Poly1305.decrypt(key.bytes, message.nonce.bytes, sealed, { aad });
  } catch (error) {
    // The reference reports the AEAD failure as `Components(Crypto(…))`.
    throw EnvelopeError.components("AEAD error", asError(error));
  }
}

/**
 * Encrypts an entire envelope as a unit, matching the reference's
 * ObscureAction::Encrypt behavior in elide_set_with_action.
 * Unlike encryptSubject which only encrypts a node's subject,
 * this encrypts the entire envelope's tagged CBOR.
 *
 * @throws EnvelopeError with code `General`.
 */
export function encryptWholeEnvelope(
  envelope: Envelope,
  key: SymmetricKey,
  options: EncryptOptions = {},
): Envelope {
  const c = envelope.case;
  if (c.type === "encrypted") {
    throw EnvelopeError.alreadyEncrypted();
  }
  if (c.type === "elided") {
    throw EnvelopeError.alreadyElided();
  }
  const cbor = envelope.toCbor();
  const encodedCbor = encodeCbor(cbor);
  const digest = envelope.digest();
  const encryptedMessage = encryptWithDigest(key, encodedCbor, digest, options);
  return Envelope.fromCase({ type: "encrypted", message: encryptedMessage });
}

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
export class Assertion implements DigestProvider {
  private readonly _predicate: Envelope;
  private readonly _object: Envelope;
  private readonly _digest: Digest;

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
  constructor(predicate: ToEnvelope | Envelope, object: ToEnvelope | Envelope) {
    this._predicate = predicate instanceof Envelope ? predicate : Envelope.from(predicate);
    this._object = object instanceof Envelope ? object : Envelope.from(object);
    this._digest = Digest.fromDigests([this._predicate.digest(), this._object.digest()]);
  }

  /**
   * Returns the predicate of the assertion.
   *
   * The predicate states what is being asserted about the subject. It is
   * typically a string or known value, but can be any envelope.
   *
   * @returns A clone of the assertion's predicate envelope.
   */
  predicate(): Envelope {
    return this._predicate;
  }

  /**
   * Returns the object of the assertion.
   *
   * The object provides the value or content of the assertion. It can be any
   * type that can be represented as an envelope.
   *
   * @returns A clone of the assertion's object envelope.
   */
  object(): Envelope {
    return this._object;
  }

  /**
   * Returns the digest of this assertion.
   *
   *
   * @returns The assertion's digest
   */
  digest(): Digest {
    return this._digest;
  }

  /**
   * Checks if two assertions are equal based on digest equality.
   *
   * Two assertions are considered equal if they have the same digest,
   * regardless of how they were constructed.
   *
   * @param other - The other assertion to compare with
   * @returns `true` if the assertions are equal, `false` otherwise
   */
  equals(other: Assertion): boolean {
    return this._digest.equals(other._digest);
  }

  /**
   * Converts this assertion to CBOR.
   *
   * The CBOR representation of an assertion is a map with a single key-value
   * pair, where the key is the predicate's CBOR and the value is the object's
   * CBOR.
   *
   * @returns A CBOR representation of this assertion
   */
  toCbor(): Cbor {
    const map = new CborMap();
    map.set(this._predicate.untaggedCbor(), this._object.untaggedCbor());
    return toCborValue(map);
  }

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
  static fromCbor(cbor: Cbor): Assertion {
    // Check if cbor is a Map
    if (!(cbor instanceof CborMap)) {
      throw EnvelopeError.invalidAssertion();
    }

    return Assertion.fromCborMap(cbor);
  }

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
  static fromCborMap(map: CborMap): Assertion {
    if (map.size !== 1) {
      throw EnvelopeError.invalidAssertion();
    }

    const entries = Array.from(map.entries());
    const firstEntry = entries[0];
    if (firstEntry === undefined) {
      throw EnvelopeError.invalidAssertion();
    }
    const [predicateCbor, objectCbor] = firstEntry;

    const predicate = Envelope.fromUntaggedCbor(predicateCbor);

    const object = Envelope.fromUntaggedCbor(objectCbor);

    return new Assertion(predicate, object);
  }

  /**
   * Creates a string representation of this assertion for debugging.
   *
   * @returns A string representation
   */
  toString(): string {
    return `Assertion(${String(this._predicate)}: ${String(this._object)})`;
  }
}

/**
 * Runs a components / dcbor decoder inside the envelope decode path; a
 * failure is reported as `Cbor` with the original as `cause`, as the
 * reference's `?` on a `dcbor::Error` does.
 */
function decodeComponent<T>(decode: () => T, message: string): T {
  try {
    return decode();
  } catch (error) {
    if (EnvelopeError.isEnvelopeError(error)) throw error;
    throw EnvelopeError.cbor(message, asError(error));
  }
}

/** Runs a components constructor on caller input; a rejection is `InvalidParameter`. */
function decodeParameter<T>(
  build: () => T,
  parameter: string,
  expected: string,
  value: unknown,
): T {
  try {
    return build();
  } catch (error) {
    throw EnvelopeError.invalidParameter(parameter, expected, value, asError(error));
  }
}

/** `InvalidParameter` unless `value` is an integer of at least `min`. */
function expectLengthAtLeast(parameter: string, value: number, min: number): void {
  if (!Number.isSafeInteger(value) || value < min) {
    throw EnvelopeError.invalidParameter(parameter, `an integer of at least ${min}`, value);
  }
}
