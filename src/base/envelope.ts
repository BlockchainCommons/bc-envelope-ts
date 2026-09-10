/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

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
  expectTaggedContent,
} from "@blockchaincommons/dcbor";
import { EnvelopeError, ErrorCode } from "./error";
import type { EnvelopeEncodable, EnvelopeEncodableValue } from "./envelope-encodable";
import { KnownValue, UNIT, POSITION } from "@blockchaincommons/known-values";
import { Digest, type DigestProvider } from "./digest";
import {
  type SymmetricKey,
  EncryptedMessage,
  Nonce,
  AuthenticationTag,
  Compressed,
  type Encrypter,
  type Decrypter,
  type Salt,
} from "@blockchaincommons/components";
import { UR } from "@blockchaincommons/uniform-resources";
import { chacha20Poly1305, SYMMETRIC_NONCE_SIZE } from "@blockchaincommons/crypto";
import { secureRng, randomBytes, type RandomNumberGenerator } from "@blockchaincommons/rand";
import { ENCODED_CBOR, ENVELOPE, LEAF, ENCRYPTED, COMPRESSED } from "@blockchaincommons/tags";
import type { KeyDerivationMethod } from "@blockchaincommons/components/kdf";
import type { Spec } from "@blockchaincommons/sskr";
import type {
  SealedMessage,
  Signer,
  Verifier,
  Signature,
  SignatureMetadata,
  SigningOptions,
} from "../extension";
import type { TreeFormatOptions } from "../format/tree";
import type { EnvelopeFormatOpts } from "../format/notation";
import type { MermaidFormatOpts } from "../format/mermaid";
import type { FormatContext } from "../format/format-context";

// Type imports for extension method declarations
// These are imported as types only to avoid circular dependencies at runtime

/// These match the Rust reference implementation in bc-tags-rust
const TAG_ENVELOPE = ENVELOPE.value;
const TAG_LEAF = LEAF.value;
const TAG_ENCRYPTED = ENCRYPTED.value;
const TAG_COMPRESSED = COMPRESSED.value;

/// The core structural variants of a Gordian Envelope.
///
/// Each variant represents a different structural form that an
/// envelope can take, as defined in the Gordian Envelope IETF Internet Draft.
/// The different cases provide different capabilities and serve different
/// purposes in the envelope ecosystem.
///
/// The `EnvelopeCase` is the internal representation of an envelope's
/// structure. While each case has unique properties, they all maintain a digest
/// that ensures the integrity of the envelope.
///
/// It is advised to use the other Envelope APIs for most uses. Please see the
/// queries module for more information on how to interact with envelopes.
export type EnvelopeCase =
  | {
      type: "node";
      /// The subject of the node
      subject: Envelope;
      /// The assertions attached to the subject
      assertions: Envelope[];
      /// The digest of the node
      digest: Digest;
    }
  | {
      type: "leaf";
      /// The CBOR value contained in the leaf
      cbor: Cbor;
      /// The digest of the leaf
      digest: Digest;
    }
  | {
      type: "wrapped";
      /// The envelope being wrapped
      envelope: Envelope;
      /// The digest of the wrapped envelope
      digest: Digest;
    }
  | {
      type: "assertion";
      /// The assertion
      assertion: Assertion;
    }
  | {
      type: "elided";
      /// The digest of the elided content
      digest: Digest;
    }
  | {
      type: "knownValue";
      /// The known value instance
      value: KnownValue;
      /// The digest of the known value
      digest: Digest;
    }
  | {
      type: "encrypted";
      /// The encrypted message
      message: EncryptedMessage;
    }
  | {
      type: "compressed";
      /// The compressed data
      value: Compressed;
    };

// Import types from extension modules (will be available at runtime)

/// A flexible container for structured data with built-in integrity
/// verification.
///
/// Gordian Envelope is the primary data structure of this library. It provides a
/// way to encapsulate and organize data with cryptographic integrity, privacy
/// features, and selective disclosure capabilities.
///
/// Key characteristics of envelopes:
///
/// - **Immutability**: Envelopes are immutable. Operations that appear to
///   "modify" an envelope actually create a new envelope. This immutability is
///   fundamental to maintaining the integrity of the envelope's digest tree.
///
/// - **Efficient Cloning**: Envelopes use shallow copying for efficient O(1)
///   cloning. Since they're immutable, clones share the same underlying data.
///
/// - **Semantic Structure**: Envelopes can represent various semantic
///   relationships through subjects, predicates, and objects (similar to RDF
///   triples).
///
/// - **Digest Tree**: Each envelope maintains a Merkle-like digest tree that
///   ensures the integrity of its contents and enables verification of
///   individual parts.
///
/// - **Privacy Features**: Envelopes support selective disclosure through
///   elision, encryption, and compression of specific parts, while maintaining
///   the overall integrity of the structure.
///
/// - **Deterministic Representation**: Envelopes use deterministic CBOR
///   encoding to ensure consistent serialization across platforms.
///
/// The Gordian Envelope specification is defined in an IETF Internet Draft, and
/// this implementation closely follows that specification.
///
/// @example
/// ```typescript
/// // Create an envelope representing a person
/// const person = Envelope.new("person")
///     .addAssertion("name", "Alice")
///     .addAssertion("age", 30)
///     .addAssertion("email", "alice@example.com");
///
/// // Create a partially redacted version by eliding the email
/// const redacted = person.elideRemovingTarget(
///     person.assertionWithPredicate("email")
/// );
///
/// // The digest of both envelopes remains the same
/// assert(person.digest().equals(redacted.digest()));
/// ```
export class Envelope implements DigestProvider {
  private readonly _case: EnvelopeCase;

  /// Private constructor. Use static factory methods to create envelopes.
  ///
  /// @param envelopeCase - The envelope case variant
  private constructor(envelopeCase: EnvelopeCase) {
    this._case = envelopeCase;
  }

  /// Returns a reference to the underlying envelope case.
  ///
  /// The `EnvelopeCase` enum represents the specific structural variant of
  /// this envelope. This method provides access to that underlying
  /// variant for operations that need to differentiate between the
  /// different envelope types.
  ///
  /// @returns The `EnvelopeCase` that defines this envelope's structure.
  case(): EnvelopeCase {
    return this._case;
  }

  /// Creates an envelope with a subject, which can be any value that
  /// can be encoded as an envelope.
  ///
  /// @param subject - The subject value
  /// @returns A new envelope containing the subject
  ///
  /// @example
  /// ```typescript
  /// const envelope = Envelope.new("Hello, world!");
  /// const numberEnvelope = Envelope.new(42);
  /// const binaryEnvelope = Envelope.new(new Uint8Array([1, 2, 3]));
  /// ```
  static new(subject: EnvelopeEncodableValue): Envelope {
    // Convert the subject to an envelope
    if (subject instanceof Envelope) {
      return subject;
    }

    // Handle KnownValue specially to create knownValue envelopes
    if (subject instanceof KnownValue) {
      return Envelope.newWithKnownValue(subject);
    }

    // If the value implements `EnvelopeEncodable`, defer to its
    // `intoEnvelope()` so structured types (e.g. `ProvenanceMarkGenerator`,
    // `Permissions`) build the same envelope shape Rust produces via
    // its `EnvelopeEncodable` blanket impl. Tagged-CBOR primitives
    // (those whose `intoEnvelope` is just `Envelope::new(self.tagged_cbor())`)
    // still resolve to the same leaf — Rust collapses the two paths
    // identically. Skip this branch for `Uint8Array`, which is a
    // built-in encodable but should produce a byte-string leaf, not be
    // confused with a class that happens to have an `intoEnvelope`.
    if (
      typeof subject === "object" &&
      subject !== null &&
      !(subject instanceof Uint8Array) &&
      "intoEnvelope" in subject &&
      typeof (subject as { intoEnvelope?: unknown }).intoEnvelope === "function"
    ) {
      return subject.intoEnvelope();
    }

    // Handle primitives and create leaf envelopes
    return Envelope.newLeaf(subject);
  }

  /// Creates an envelope with a subject, or a `null` leaf envelope if
  /// the subject is **absent** (`undefined` *or* JS `null`).
  ///
  /// **TS↔Rust note**: Rust `Envelope::new_or_null` only takes
  /// `Option<impl EnvelopeEncodable>` — the no-subject branch fires only
  /// on `None`. JavaScript collapses "no value" into two distinct values
  /// (`undefined` and `null`); we treat both as "absent" because the
  /// most common JS usage pattern is `value ?? undefined`. If you need
  /// to construct a leaf envelope whose CBOR value is JS `null`
  /// (Rust's `CBOR::null()`), use {@link Envelope.null} directly:
  ///
  /// ```ts
  /// // Equivalent to Rust `Envelope::new(CBOR::null())`:
  /// const nullLeaf = Envelope.null();
  ///
  /// // `newOrNull(null)` returns the same null leaf.
  /// const same = Envelope.newOrNull(null);
  /// ```
  ///
  /// @param subject - The optional subject value (`undefined` *or* `null`
  ///   triggers the no-subject branch).
  /// @returns A new envelope or a null leaf envelope
  static newOrNull(subject: EnvelopeEncodableValue | undefined): Envelope {
    if (subject === undefined || subject === null) {
      return Envelope.null();
    }
    return Envelope.new(subject);
  }

  /// Creates an envelope with a subject, or `undefined` if the subject is
  /// **absent** (`undefined` *or* JS `null`).
  ///
  /// **TS↔Rust note**: Rust `Envelope::new_or_none` returns
  /// `Option<Envelope>` — the `None` branch fires only on `None`. We
  /// follow the same convention as {@link Envelope.newOrNull} and treat
  /// JS `null` and `undefined` interchangeably as the absent case.
  ///
  /// @param subject - The optional subject value (`undefined` *or* `null`
  ///   triggers the absent branch).
  /// @returns A new envelope or `undefined`
  static newOrNone(subject: EnvelopeEncodableValue | undefined): Envelope | undefined {
    if (subject === undefined || subject === null) {
      return undefined;
    }
    return Envelope.new(subject);
  }

  /// Creates an envelope from an EnvelopeCase.
  ///
  /// This is an internal method used by extensions to create envelopes
  /// from custom case types like compressed or encrypted.
  ///
  /// @param envelopeCase - The envelope case to wrap
  /// @returns A new envelope with the given case
  static fromCase(envelopeCase: EnvelopeCase): Envelope {
    return new Envelope(envelopeCase);
  }

  /// Creates an assertion envelope with a predicate and object.
  ///
  /// @param predicate - The predicate of the assertion
  /// @param object - The object of the assertion
  /// @returns A new assertion envelope
  ///
  /// @example
  /// ```typescript
  /// const assertion = Envelope.newAssertion("name", "Alice");
  /// ```
  static newAssertion(predicate: EnvelopeEncodableValue, object: EnvelopeEncodableValue): Envelope {
    const predicateEnv = predicate instanceof Envelope ? predicate : Envelope.new(predicate);
    const objectEnv = object instanceof Envelope ? object : Envelope.new(object);
    return Envelope.newWithAssertion(new Assertion(predicateEnv, objectEnv));
  }

  /// Creates a null envelope (containing CBOR null).
  ///
  /// @returns A null envelope
  static null(): Envelope {
    return Envelope.newLeaf(null);
  }

  //
  // Internal constructors
  //

  /// Creates an envelope with a subject and unchecked assertions.
  ///
  /// The assertions are sorted by digest and the envelope's digest is calculated.
  ///
  /// @param subject - The subject envelope
  /// @param uncheckedAssertions - The assertions to attach
  /// @returns A new node envelope
  static newWithUncheckedAssertions(subject: Envelope, uncheckedAssertions: Envelope[]): Envelope {
    if (uncheckedAssertions.length === 0) {
      throw new Error("Assertions array cannot be empty");
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

  /// Creates an envelope with a subject and validated assertions.
  ///
  /// All assertions must be assertion or obscured envelopes.
  ///
  /// @param subject - The subject envelope
  /// @param assertions - The assertions to attach
  /// @returns A new node envelope
  /// @throws {EnvelopeError} If any assertion is not valid
  static newWithAssertions(subject: Envelope, assertions: Envelope[]): Envelope {
    // Validate that all assertions are assertion or obscured envelopes
    for (const assertion of assertions) {
      if (!assertion.isSubjectAssertion() && !assertion.isSubjectObscured()) {
        throw EnvelopeError.invalidFormat();
      }
    }

    return Envelope.newWithUncheckedAssertions(subject, assertions);
  }

  /// Creates an envelope with an assertion as its subject.
  ///
  /// @param assertion - The assertion
  /// @returns A new assertion envelope
  static newWithAssertion(assertion: Assertion): Envelope {
    return new Envelope({
      type: "assertion",
      assertion,
    });
  }

  /// Creates an envelope with a known value.
  ///
  /// @param value - The known value (can be a KnownValue instance or a number/bigint)
  /// @returns A new known value envelope
  static newWithKnownValue(value: KnownValue | number | bigint): Envelope {
    const knownValue = value instanceof KnownValue ? value : new KnownValue(value);
    // Calculate digest from CBOR encoding of the known value
    const digest = Digest.fromImage(knownValue.toCbor().toData());
    return new Envelope({
      type: "knownValue",
      value: knownValue,
      digest,
    });
  }

  /// Creates an envelope with encrypted content.
  ///
  /// Mirrors Rust `Envelope::new_with_encrypted`
  /// (`bc-envelope-rust/src/base/envelope.rs:317-324`), which returns
  /// `Err(Error::MissingDigest)` when the message has no AAD digest.
  ///
  /// @param encryptedMessage - The encrypted message
  /// @returns A new encrypted envelope
  /// @throws {EnvelopeError} If the encrypted message doesn't have a digest
  static newWithEncrypted(encryptedMessage: EncryptedMessage): Envelope {
    if (!encryptedMessage.hasDigest()) {
      throw EnvelopeError.missingDigest();
    }
    return new Envelope({
      type: "encrypted",
      message: encryptedMessage,
    });
  }

  /// Creates an envelope with compressed content.
  ///
  /// Mirrors Rust `Envelope::new_with_compressed`
  /// (`bc-envelope-rust/src/base/envelope.rs:326-332`), which returns
  /// `Err(Error::MissingDigest)` when the compressed value has no digest.
  ///
  /// @param compressed - The compressed data
  /// @returns A new compressed envelope
  /// @throws {EnvelopeError} If the compressed data doesn't have a digest
  static newWithCompressed(compressed: Compressed): Envelope {
    if (!compressed.hasDigest()) {
      throw EnvelopeError.missingDigest();
    }
    return new Envelope({
      type: "compressed",
      value: compressed,
    });
  }

  /// Creates an elided envelope containing only a digest.
  ///
  /// @param digest - The digest of the elided content
  /// @returns A new elided envelope
  static newElided(digest: Digest): Envelope {
    return new Envelope({
      type: "elided",
      digest,
    });
  }

  /// Creates a leaf envelope containing a CBOR value.
  ///
  /// @param value - The value to encode as CBOR
  /// @returns A new leaf envelope
  static newLeaf(value: unknown): Envelope {
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

  /// Creates a wrapped envelope.
  ///
  /// @param envelope - The envelope to wrap
  /// @returns A new wrapped envelope
  static newWrapped(envelope: Envelope): Envelope {
    const digest = Digest.fromDigests([envelope.digest()]);
    return new Envelope({
      type: "wrapped",
      envelope,
      digest,
    });
  }

  /// Returns the digest of this envelope.
  ///
  /// Implementation of DigestProvider interface.
  ///
  /// @returns The envelope's digest
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
          throw new Error("Encrypted envelope missing digest");
        }
        return digest;
      }
      case "compressed": {
        // Get digest from compressed value
        const digest = c.value.digestOpt();
        if (digest === undefined) {
          throw new Error("Compressed envelope missing digest");
        }
        return digest;
      }
    }
  }

  /// Returns the subject of this envelope.
  ///
  /// For different envelope cases:
  /// - Node: Returns the subject envelope
  /// - Other cases: Returns the envelope itself
  ///
  /// @returns The subject envelope
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

  /// Checks if the envelope's subject is an assertion.
  ///
  /// @returns `true` if the subject is an assertion, `false` otherwise
  isSubjectAssertion(): boolean {
    if (this._case.type === "assertion") return true;
    if (this._case.type === "node") return this._case.subject.isSubjectAssertion();
    return false;
  }

  /// Checks if the envelope's subject is obscured (elided, encrypted, or compressed).
  ///
  /// @returns `true` if the subject is obscured, `false` otherwise
  isSubjectObscured(): boolean {
    const t = this._case.type;
    return t === "elided" || t === "encrypted" || t === "compressed";
  }

  //
  // CBOR conversion helpers
  //

  /// Converts a value to CBOR.
  ///
  /// @param value - The value to convert
  /// @returns A CBOR representation
  private static valueToCbor(value: unknown): Cbor {
    // Import cbor function at runtime to avoid circular dependencies

    return cbor(value as Parameters<typeof cbor>[0]);
  }

  /// Converts CBOR to bytes.
  ///
  /// @param cbor - The CBOR value
  /// @returns Byte representation
  private static cborToBytes(cbor: Cbor): Uint8Array {
    // Import encodeCbor function at runtime to avoid circular dependencies

    return encodeCbor(cbor);
  }

  /// Returns the untagged CBOR representation of this envelope.
  ///
  /// @returns The untagged CBOR
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
        // Tagged with TAG_LEAF (204)
        return taggedValue(TAG_LEAF, c.cbor);
      case "wrapped":
        // Wrapped envelopes are tagged with TAG_ENVELOPE
        return c.envelope.taggedCbor();
      case "assertion":
        // Assertions convert to CBOR maps
        return c.assertion.toCbor();
      case "elided":
        // Elided is just the digest bytes
        return Envelope.valueToCbor(c.digest.bytes);
      case "knownValue":
        // Known values are encoded as untagged unsigned integers
        // This matches Rust: value.untagged_cbor()
        return c.value.untaggedCbor();
      case "encrypted": {
        // Encrypted envelopes serialize as the canonical
        // `@blockchaincommons/components::EncryptedMessage` tagged CBOR
        // (tag 40002, array `[ciphertext, nonce, auth, ?aadBytes]`).
        // The AAD bytes are the **CBOR-encoded tagged Digest** of the
        // plaintext, matching Rust
        // `bc-components/src/symmetric/symmetric_key.rs::encrypt_with_digest`.
        return c.message.toCbor();
      }
      case "compressed": {
        // Compressed envelopes serialize as the canonical
        // `@blockchaincommons/components::Compressed` tagged CBOR
        // (tag 40003, array `[checksum, decompressedSize, compressedData, ?digest]`).
        // Matches Rust `bc-components/src/compressed.rs::CBORTaggedEncodable`.
        return c.value.toCbor();
      }
    }
  }

  /// Returns the tagged CBOR representation of this envelope.
  ///
  /// All envelopes are tagged with TAG_ENVELOPE (200).
  ///
  /// @returns The tagged CBOR
  taggedCbor(): Cbor {
    return taggedValue(TAG_ENVELOPE, this.untaggedCbor());
  }

  /// Creates an envelope from untagged CBOR.
  ///
  /// @param cbor - The untagged CBOR value
  /// @returns A new envelope
  static fromUntaggedCbor(cbor: Cbor): Envelope {
    // Check if it's a tagged value
    const tagged = asTaggedValue(cbor);
    if (tagged !== undefined) {
      const [tag, item] = tagged;
      switch (tag.value) {
        case TAG_LEAF:
        case ENCODED_CBOR.value:
          // Leaf envelope
          return Envelope.newLeaf(item);
        case TAG_ENVELOPE: {
          // Wrapped envelope
          const envelope = Envelope.fromUntaggedCbor(item);
          return Envelope.newWrapped(envelope);
        }
        case TAG_COMPRESSED: {
          // Delegate to the canonical `@blockchaincommons/components::Compressed`
          // decoder (`[checksum, decompressedSize, compressedData,
          // ?digest]`). Matches Rust
          // `bc-components/src/compressed.rs::from_untagged_cbor`.
          const compressed = Compressed.fromCbor(cbor);
          return Envelope.newWithCompressed(compressed);
        }
        case TAG_ENCRYPTED: {
          // Delegate to the canonical `@blockchaincommons/components::EncryptedMessage`
          // decoder (`[ciphertext, nonce, auth, ?aadBytes]` with `aadBytes`
          // being the CBOR-encoded tagged Digest of the plaintext).
          // Matches Rust
          // `bc-components/src/symmetric/encrypted_message.rs::from_untagged_cbor`.
          const message = EncryptedMessage.fromCbor(cbor);
          return Envelope.newWithEncrypted(message);
        }
        default:
          throw EnvelopeError.cbor(`unknown envelope tag: ${tag.value}`);
      }
    }

    // Check if it's a byte string (elided)
    const bytes = asBytes(cbor);
    if (bytes !== undefined) {
      if (bytes.length !== 32) {
        throw EnvelopeError.cbor("elided digest must be 32 bytes");
      }
      return Envelope.newElided(Digest.from(bytes));
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
      return Envelope.newWithAssertions(subject, assertions);
    }

    // Check if it's a map (assertion)
    const map = asMap(cbor);
    if (map !== undefined) {
      const assertion = Assertion.fromCborMap(map);
      return Envelope.newWithAssertion(assertion);
    }

    // Handle known values (unsigned integers)
    if (cbor.type === MajorType.Unsigned) {
      const knownValue = new KnownValue(cbor.value);
      return Envelope.newWithKnownValue(knownValue);
    }

    throw EnvelopeError.cbor("invalid envelope format");
  }

  /// Creates an envelope from tagged CBOR.
  ///
  /// @param cbor - The tagged CBOR value (should have TAG_ENVELOPE)
  /// @returns A new envelope
  static fromTaggedCbor(cbor: Cbor): Envelope {
    try {
      const untagged = expectTaggedContent(cbor, TAG_ENVELOPE);
      return Envelope.fromUntaggedCbor(untagged);
    } catch (error) {
      throw EnvelopeError.cbor(
        `expected TAG_ENVELOPE (${TAG_ENVELOPE})`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /// Adds an assertion to this envelope.
  ///
  /// @param predicate - The assertion predicate
  /// @param object - The assertion object
  /// @returns A new envelope with the assertion added
  ///
  /// @example
  /// ```typescript
  /// const person = Envelope.new("Alice")
  ///     .addAssertion("age", 30)
  ///     .addAssertion("city", "Boston");
  /// ```
  addAssertion(predicate: EnvelopeEncodableValue, object: EnvelopeEncodableValue): Envelope {
    const assertion = Envelope.newAssertion(predicate, object);
    return this.addAssertionEnvelope(assertion);
  }

  /// Adds an assertion envelope to this envelope.
  ///
  /// @param assertion - The assertion envelope
  /// @returns A new envelope with the assertion added
  addAssertionEnvelope(assertion: Envelope): Envelope {
    const c = this._case;

    // If this is already a node, add to existing assertions
    if (c.type === "node") {
      return Envelope.newWithAssertions(c.subject, [...c.assertions, assertion]);
    }

    // Otherwise, create a new node with this envelope as subject
    return Envelope.newWithAssertions(this, [assertion]);
  }

  /// Creates a string representation of this envelope.
  ///
  /// @returns A string representation
  toString(): string {
    return `Envelope(${this._case.type})`;
  }

  /// Creates a shallow copy of this envelope.
  ///
  /// Since envelopes are immutable, this returns the same instance.
  ///
  /// @returns This envelope
  clone(): Envelope {
    return this;
  }

  //
  // Format methods (implemented via prototype extension in format module)
  //

  /// Returns a tree-formatted string representation of the envelope.
  ///
  /// The tree format displays the hierarchical structure of the envelope,
  /// showing subjects, assertions, and their relationships.
  ///
  /// @param options - Optional formatting options
  /// @returns A tree-formatted string
  declare treeFormat: (options?: TreeFormatOptions) => string;

  /// Returns a short identifier for this envelope based on its digest.
  ///
  /// @param format - Format for the digest ('short', 'full', or 'ur')
  /// @returns A digest identifier string
  declare shortId: (format?: "short" | "full" | "ur") => string;

  /// Returns a summary string for this envelope.
  ///
  /// @param maxLength - Maximum length of the summary
  /// @returns A summary string
  declare summary: (maxLength?: number) => string;

  /// Returns an annotated hex representation of the envelope's CBOR encoding.
  ///
  /// Default is the rich, multi-line annotated dump (tag names + per-line
  /// notes), matching Rust `Envelope::hex` /
  /// `dcbor::HexFormatOpts { annotate: true }`. Pass `false` to
  /// {@link Envelope.hexOpt} for a plain, flat hex string.
  ///
  /// @returns A multi-line annotated hex string
  declare hex: () => string;

  /// Returns the CBOR-encoded bytes of the envelope.
  ///
  /// @returns The CBOR bytes
  declare cborBytes: () => Uint8Array;

  /// Returns a hex representation with explicit annotate flag and optional
  /// {@link FormatContext} for tag-name resolution.
  ///
  /// Mirrors Rust `Envelope::hex_opt(annotate, context)`.
  ///
  /// @param annotate - When true, produce the annotated multi-line dump;
  ///   when false, produce a plain hex string (no spaces, no labels).
  /// @param context - Optional format context for resolving tag names.
  ///   Defaults to the global format context.
  /// @returns A hex string in the requested format
  declare hexOpt: (annotate: boolean, context?: FormatContext) => string;

  /// Returns a CBOR diagnostic notation string for the envelope.
  ///
  /// Mirrors Rust `Envelope::diagnostic`, which delegates to
  /// `dcbor::diagnostic_opt` with annotation on. For tag-name resolution
  /// from a custom {@link FormatContext}, use
  /// {@link Envelope.diagnosticAnnotated}.
  ///
  /// @returns A diagnostic string
  declare diagnostic: () => string;

  /// Returns a CBOR diagnostic notation string with explicit tag annotation
  /// and an optional {@link FormatContext} for tag-name resolution.
  ///
  /// Mirrors Rust `Envelope::diagnostic_annotated`.
  ///
  /// @param context - Optional format context for resolving tag names.
  ///   Defaults to the global format context.
  /// @returns An annotated diagnostic string
  declare diagnosticAnnotated: (context?: FormatContext) => string;

  //
  // Extension methods (implemented via prototype extension in extension modules)
  // These declarations ensure TypeScript recognizes the methods when consuming the package
  //

  // From assertions.ts
  // From salt.ts - assertion methods with optional salting
  declare addAssertionSalted: (
    predicate: EnvelopeEncodableValue,
    object: EnvelopeEncodableValue,
    salted: boolean,
  ) => Envelope;
  declare addAssertionEnvelopeSalted: (assertionEnvelope: Envelope, salted: boolean) => Envelope;
  declare addOptionalAssertionEnvelopeSalted: (
    assertionEnvelope: Envelope | undefined,
    salted: boolean,
  ) => Envelope;

  // From elide.ts

  // From leaf.ts

  // Generic typed extraction methods from envelope-decodable.ts

  // From queries.ts

  // From walk.ts

  // Digest-related methods

  // Alias methods for Rust API compatibility

  // Additional elision method

  // From ur.ts - UR (Uniform Resource) support

  // From wrap.ts

  // From attachment.ts
  declare addAttachment: (
    payload: EnvelopeEncodableValue,
    vendor: string,
    conformsTo?: string,
  ) => Envelope;
  declare attachmentPayload: () => Envelope;
  declare attachmentVendor: () => string;
  declare attachmentConformsTo: () => string | undefined;
  declare attachments: () => Envelope[];
  declare attachmentsWithVendorAndConformsTo: (vendor?: string, conformsTo?: string) => Envelope[];
  declare attachmentWithVendorAndConformsTo: (vendor?: string, conformsTo?: string) => Envelope;
  declare validateAttachment: () => void;

  // From edge.ts (BCR-2026-003)
  declare addEdgeEnvelope: (edge: Envelope) => Envelope;
  declare edges: () => Envelope[];
  declare validateEdge: () => void;
  declare edgeIsA: () => Envelope;
  declare edgeSource: () => Envelope;
  declare edgeTarget: () => Envelope;
  declare edgeSubject: () => Envelope;
  declare edgesMatching: (
    isA?: Envelope,
    source?: Envelope,
    target?: Envelope,
    subject?: Envelope,
  ) => Envelope[];

  // From compress.ts

  // From encrypt.ts

  // From proof.ts
  declare proofContainsSet: (target: Set<Digest>) => Envelope | undefined;
  declare proofContainsTarget: (target: Envelope) => Envelope | undefined;
  declare confirmContainsSet: (target: Set<Digest>, proof: Envelope) => boolean;
  declare confirmContainsTarget: (target: Envelope, proof: Envelope) => boolean;

  // From recipient.ts - uses Encrypter/Decrypter interfaces for PQ support
  declare encryptSubjectToRecipient: (recipient: Encrypter) => Envelope;
  declare encryptSubjectToRecipients: (recipients: Encrypter[]) => Envelope;
  declare addRecipient: (
    recipient: Encrypter,
    contentKey: SymmetricKey,
    testNonce?: Nonce,
  ) => Envelope;
  declare decryptSubjectToRecipient: (recipient: Decrypter) => Envelope;
  declare decryptToRecipient: (recipient: Decrypter) => Envelope;
  declare encryptToRecipients: (recipients: Encrypter[]) => Envelope;
  declare recipients: () => SealedMessage[];

  // From seal.ts
  declare encryptToRecipient: (recipient: Encrypter) => Envelope;
  declare seal: (sender: Signer, recipient: Encrypter) => Envelope;
  declare sealOpt: (sender: Signer, recipient: Encrypter, options?: SigningOptions) => Envelope;
  declare unseal: (senderPublicKey: Verifier, recipient: Decrypter) => Envelope;

  // From salt.ts
  declare addSalt: () => Envelope;
  declare addSaltInstance: (salt: Salt) => Envelope;
  declare addSaltWithLength: (count: number) => Envelope;
  declare addSaltWithLen: (count: number) => Envelope;
  declare addSaltBytes: (saltBytes: Uint8Array) => Envelope;
  declare addSaltInRange: (min: number, max: number) => Envelope;
  // Test-determinism overloads matching Rust's `*_using` variants.
  declare addSaltUsing: (rng: RandomNumberGenerator) => Envelope;
  declare addSaltWithLenUsing: (count: number, rng: RandomNumberGenerator) => Envelope;
  declare addSaltInRangeUsing: (min: number, max: number, rng: RandomNumberGenerator) => Envelope;

  // From signature.ts — matches bc-envelope-rust/src/extension/signature/signature_impl.rs
  declare addSignature: (signer: Signer) => Envelope;
  declare addSignatureOpt: (
    signer: Signer,
    options?: SigningOptions,
    metadata?: SignatureMetadata,
  ) => Envelope;
  declare addSignatureWithMetadata: (signer: Signer, metadata?: SignatureMetadata) => Envelope;
  declare addSignatures: (signers: Signer[]) => Envelope;
  declare addSignaturesOpt: (
    signersWithOptions: {
      signer: Signer;
      options?: SigningOptions;
      metadata?: SignatureMetadata;
    }[],
  ) => Envelope;
  declare addSignaturesWithMetadata: (
    signersWithMetadata: { signer: Signer; metadata?: SignatureMetadata }[],
  ) => Envelope;
  declare makeSignedAssertion: (signature: Signature, note?: string) => Envelope;
  declare isVerifiedSignature: (signature: Signature, verifier: Verifier) => boolean;
  declare verifySignature: (signature: Signature, verifier: Verifier) => Envelope;
  declare hasSignatureFrom: (verifier: Verifier) => boolean;
  declare hasSignatureFromReturningMetadata: (verifier: Verifier) => Envelope | undefined;
  declare verifySignatureFrom: (verifier: Verifier) => Envelope;
  declare verifySignatureFromReturningMetadata: (verifier: Verifier) => Envelope;
  declare hasSignaturesFrom: (verifiers: Verifier[]) => boolean;
  declare hasSignaturesFromThreshold: (verifiers: Verifier[], threshold?: number) => boolean;
  declare verifySignaturesFrom: (verifiers: Verifier[]) => Envelope;
  declare verifySignaturesFromThreshold: (verifiers: Verifier[], threshold?: number) => Envelope;
  declare signatures: () => Envelope[];
  declare sign: (signer: Signer) => Envelope;
  declare signOpt: (signer: Signer, options?: SigningOptions) => Envelope;
  declare signWithMetadata: (signer: Signer, metadata?: SignatureMetadata) => Envelope;
  declare verify: (verifier: Verifier) => Envelope;
  declare verifyReturningMetadata: (verifier: Verifier) => {
    envelope: Envelope;
    metadata: Envelope;
  };

  // From types.ts
  declare addType: (object: EnvelopeEncodableValue) => Envelope;
  declare types: () => Envelope[];
  declare getType: () => Envelope;
  declare hasType: (t: EnvelopeEncodableValue) => boolean;
  declare checkType: (t: EnvelopeEncodableValue) => void;
  declare hasTypeValue: (t: KnownValue) => boolean;

  // Static methods from extensions
  declare static newAttachment: (
    payload: EnvelopeEncodableValue,
    vendor: string,
    conformsTo?: string,
  ) => Envelope;

  // Static methods from leaf.ts

  // From format/notation.ts
  declare format: () => string;
  declare formatOpt: (opts: EnvelopeFormatOpts) => string;
  declare formatFlat: () => string;

  // From format/mermaid.ts
  declare mermaidFormat: () => string;
  declare mermaidFormatOpt: (opts: MermaidFormatOpts) => string;

  // From format/envelope-summary.ts
  declare summaryWithContext: (maxLength: number, context: FormatContext) => string;

  // From secret.ts
  declare lockSubject: (method: KeyDerivationMethod, secret: Uint8Array) => Envelope;
  declare unlockSubject: (secret: Uint8Array) => Envelope;
  declare isLockedWithPassword: () => boolean;
  declare isLockedWithSshAgent: () => boolean;
  declare addSecret: (
    method: KeyDerivationMethod,
    secret: Uint8Array,
    contentKey: SymmetricKey,
  ) => Envelope;
  declare lock: (method: KeyDerivationMethod, secret: Uint8Array) => Envelope;
  declare unlock: (secret: Uint8Array) => Envelope;

  // From extension/sskr.ts
  declare sskrSplit: (spec: Spec, contentKey: SymmetricKey) => Envelope[][];
  declare sskrSplitFlattened: (spec: Spec, contentKey: SymmetricKey) => Envelope[];
  declare sskrSplitUsing: (
    spec: Spec,
    contentKey: SymmetricKey,
    rng: RandomNumberGenerator,
  ) => Envelope[][];
  declare static sskrJoin: (envelopes: Envelope[]) => Envelope;

  // CBOR methods
  declare checkTypeValue: (t: KnownValue) => void;

  /**
   * Implementation of static false()
   */
  static false(): Envelope {
    return Envelope.newLeaf(false);
  }

  /**
   * Implementation of static true()
   */
  static true(): Envelope {
    return Envelope.newLeaf(true);
  }

  /**
   * Implementation of static unit()
   * Unit envelopes have the known value ''. They represent a position
   * where no meaningful data *can* exist. In this sense they make a
   * semantically stronger assertion than `null`, which represents a
   * position where no meaningful data currently exists, but could exist in
   * the future.
   */
  static unit(): Envelope {
    return Envelope.new(UNIT);
  }

  /**
   * Implementation of fromUrString
   */
  static fromUrString(urString: string): Envelope {
    const ur = UR.parse(urString);
    return Envelope.fromUR(ur);
  }

  static fromURString(urString: string): Envelope {
    return Envelope.fromUrString(urString);
  }

  /**
   * Implementation of fromUR
   */
  static fromUR(ur: UR): Envelope {
    ur.expectType("envelope");
    // Use fromUntaggedCbor() per Rust implementation - the UR type "envelope" implies the tag
    return Envelope.fromUntaggedCbor(ur.cbor);
  }

  /**
   * Implementation of addAssertionEnvelopes
   */
  addAssertionEnvelopes(assertions: Envelope[]): Envelope {
    return assertions.reduce((result, assertion) => result.addAssertionEnvelope(assertion), this);
  }

  /**
   * Implementation of addOptionalAssertionEnvelope
   */
  addOptionalAssertionEnvelope(assertion: Envelope | undefined): Envelope {
    if (assertion === undefined) {
      return this;
    }

    // Validate that the assertion is a valid assertion or obscured envelope
    if (!assertion.isSubjectAssertion() && !assertion.isSubjectObscured()) {
      throw EnvelopeError.invalidFormat();
    }

    const c = this.case();

    // Check if this is already a node
    if (c.type === "node") {
      // Check for duplicate assertions
      const isDuplicate = c.assertions.some((a) => a.digest().equals(assertion.digest()));
      if (isDuplicate) {
        return this;
      }

      // Add the new assertion
      return Envelope.newWithUncheckedAssertions(c.subject, [...c.assertions, assertion]);
    }

    // Otherwise, create a new node with this envelope as subject
    return Envelope.newWithUncheckedAssertions(this.subject(), [assertion]);
  }

  /**
   * Implementation of addOptionalAssertion
   */
  addOptionalAssertion(
    predicate: EnvelopeEncodableValue,
    object: EnvelopeEncodableValue | undefined,
  ): Envelope {
    if (object === undefined || object === null) {
      return this;
    }
    return this.addAssertion(predicate, object);
  }

  /**
   * Implementation of addNonemptyStringAssertion
   */
  addNonemptyStringAssertion(predicate: EnvelopeEncodableValue, str: string): Envelope {
    if (str.length === 0) {
      return this;
    }
    return this.addAssertion(predicate, str);
  }

  /**
   * Implementation of addAssertions
   */
  addAssertions(envelopes: Envelope[]): Envelope {
    return envelopes.reduce((result, envelope) => result.addAssertionEnvelope(envelope), this);
  }

  /**
   * Implementation of addAssertionIf
   */
  addAssertionIf(
    condition: boolean,
    predicate: EnvelopeEncodableValue,
    object: EnvelopeEncodableValue,
  ): Envelope {
    if (condition) {
      return this.addAssertion(predicate, object);
    }
    return this;
  }

  /**
   * Implementation of addAssertionEnvelopeIf
   */
  addAssertionEnvelopeIf(condition: boolean, assertionEnvelope: Envelope): Envelope {
    if (condition) {
      return this.addAssertionEnvelope(assertionEnvelope);
    }
    return this;
  }

  /**
   * Implementation of removeAssertion
   */
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
    return Envelope.newWithUncheckedAssertions(this.subject(), newAssertions);
  }

  /**
   * Implementation of replaceAssertion
   */
  replaceAssertion(assertion: Envelope, newAssertion: Envelope): Envelope {
    return this.removeAssertion(assertion).addAssertionEnvelope(newAssertion);
  }

  /**
   * Implementation of replaceSubject
   */
  replaceSubject(subject: Envelope): Envelope {
    return this.assertions().reduce((e, a) => e.addAssertionEnvelope(a), subject);
  }

  /**
   * Implementation of assertions
   */
  assertions(): Envelope[] {
    const c = this.case();
    if (c.type === "node") {
      return c.assertions;
    }
    return [];
  }

  /**
   * Implementation of isFalse()
   */
  isFalse(): boolean {
    try {
      return this.extractBoolean() === false;
    } catch {
      return false;
    }
  }

  /**
   * Implementation of isTrue()
   */
  isTrue(): boolean {
    try {
      return this.extractBoolean() === true;
    } catch {
      return false;
    }
  }

  /**
   * Implementation of isBool()
   */
  isBool(): boolean {
    try {
      const value = this.extractBoolean();
      return typeof value === "boolean";
    } catch {
      return false;
    }
  }

  /**
   * Implementation of isNumber()
   */
  isNumber(): boolean {
    const leaf = this.asLeaf();
    if (leaf === undefined) {
      return false;
    }

    return isNumber(leaf);
  }

  /**
   * Implementation of isSubjectNumber()
   */
  isSubjectNumber(): boolean {
    return this.subject().isNumber();
  }

  /**
   * Implementation of isCborNaN()
   */
  isNaN(): boolean {
    const leaf = this.asLeaf();
    if (leaf === undefined) {
      return false;
    }

    return isFloat(leaf) && Number.isNaN(asFloat(leaf));
  }

  /**
   * Implementation of isSubjectNaN()
   */
  isSubjectNaN(): boolean {
    return this.subject().isNaN();
  }

  /**
   * Implementation of isNull()
   */
  isNull(): boolean {
    try {
      this.extractNull();
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Implementation of tryByteString()
   */
  tryByteString(): Uint8Array {
    return this.extractBytes();
  }

  /**
   * Implementation of asBytes()
   */
  asBytes(): Uint8Array | undefined {
    try {
      return this.extractBytes();
    } catch {
      return undefined;
    }
  }

  /**
   * Implementation of asArray()
   */
  asArray(): readonly Cbor[] | undefined {
    const leaf = this.asLeaf();
    if (leaf === undefined) {
      return undefined;
    }

    return asArray(leaf);
  }

  /**
   * Implementation of asMap()
   */
  asMap(): CborMap | undefined {
    const leaf = this.asLeaf();
    if (leaf === undefined) {
      return undefined;
    }

    return asMap(leaf);
  }

  /**
   * Implementation of asText()
   */
  asText(): string | undefined {
    const leaf = this.asLeaf();
    if (leaf === undefined) {
      return undefined;
    }

    return asText(leaf);
  }

  /**
   * Implementation of asLeaf()
   */
  asLeaf(): Cbor | undefined {
    const c = this.case();
    if (c.type === "leaf") {
      return c.cbor;
    }
    return undefined;
  }

  /**
   * Implementation of asKnownValue()
   */
  asKnownValue(): KnownValue | undefined {
    const c = this.case();
    if (c.type === "knownValue") {
      return c.value;
    }
    return undefined;
  }

  /**
   * Implementation of tryKnownValue()
   */
  tryKnownValue(): KnownValue {
    const kv = this.asKnownValue();
    if (kv === undefined) {
      throw EnvelopeError.notKnownValue();
    }
    return kv;
  }

  /**
   * Implementation of isKnownValue()
   */
  isKnownValue(): boolean {
    return this.case().type === "knownValue";
  }

  /**
   * Implementation of isSubjectUnit()
   */
  isSubjectUnit(): boolean {
    const kv = this.subject().asKnownValue();
    if (kv === undefined) {
      return false;
    }
    return kv.equals(UNIT);
  }

  /**
   * Implementation of checkSubjectUnit()
   */
  checkSubjectUnit(): Envelope {
    if (this.isSubjectUnit()) {
      return this;
    }
    throw EnvelopeError.subjectNotUnit();
  }

  /**
   * Implementation of hasAssertions()
   */
  hasAssertions(): boolean {
    const c = this.case();
    return c.type === "node" && c.assertions.length > 0;
  }

  /**
   * Implementation of asAssertion()
   */
  asAssertion(): Envelope | undefined {
    const c = this.case();
    return c.type === "assertion" ? this : undefined;
  }

  /**
   * Implementation of tryAssertion()
   */
  tryAssertion(): Envelope {
    const result = this.asAssertion();
    if (result === undefined) {
      throw EnvelopeError.notAssertion();
    }
    return result;
  }

  /**
   * Implementation of asPredicate()
   */
  asPredicate(): Envelope | undefined {
    // Refer to subject in case the assertion is a node and therefore has
    // its own assertions
    const subj = this.subject();
    const c = subj.case();
    if (c.type === "assertion") {
      return c.assertion.predicate();
    }
    return undefined;
  }

  /**
   * Implementation of tryPredicate()
   */
  tryPredicate(): Envelope {
    const result = this.asPredicate();
    if (result === undefined) {
      throw EnvelopeError.notAssertion();
    }
    return result;
  }

  /**
   * Implementation of asObject()
   */
  asObject(): Envelope | undefined {
    // Refer to subject in case the assertion is a node and therefore has
    // its own assertions
    const subj = this.subject();
    const c = subj.case();
    if (c.type === "assertion") {
      return c.assertion.object();
    }
    return undefined;
  }

  /**
   * Implementation of tryObject()
   */
  tryObject(): Envelope {
    const result = this.asObject();
    if (result === undefined) {
      throw EnvelopeError.notAssertion();
    }
    return result;
  }

  /**
   * Implementation of isAssertion()
   */
  isAssertion(): boolean {
    return this.case().type === "assertion";
  }

  /**
   * Implementation of isElided()
   */
  isElided(): boolean {
    return this.case().type === "elided";
  }

  /**
   * Implementation of isLeaf()
   */
  isLeaf(): boolean {
    return this.case().type === "leaf";
  }

  /**
   * Implementation of isNode()
   */
  isNode(): boolean {
    return this.case().type === "node";
  }

  /**
   * Implementation of isWrapped()
   */
  isWrapped(): boolean {
    return this.case().type === "wrapped";
  }

  /**
   * Implementation of isInternal()
   */
  isInternal(): boolean {
    const type = this.case().type;
    return type === "node" || type === "wrapped" || type === "assertion";
  }

  /**
   * Implementation of isObscured()
   */
  isObscured(): boolean {
    const type = this.case().type;
    return type === "elided" || type === "encrypted" || type === "compressed";
  }

  /**
   * Implementation of assertionsWithPredicate()
   */
  assertionsWithPredicate(predicate: EnvelopeEncodableValue): Envelope[] {
    const predicateEnv = Envelope.new(predicate);
    const predicateDigest = predicateEnv.digest();

    return this.assertions().filter((assertion) => {
      const pred = assertion.subject().asPredicate();
      return pred?.digest().equals(predicateDigest) === true;
    });
  }

  /**
   * Implementation of assertionWithPredicate()
   */
  assertionWithPredicate(predicate: EnvelopeEncodableValue): Envelope {
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
   * Implementation of optionalAssertionWithPredicate()
   */
  optionalAssertionWithPredicate(predicate: EnvelopeEncodableValue): Envelope | undefined {
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
   * Implementation of objectForPredicate()
   */
  objectForPredicate(predicate: EnvelopeEncodableValue): Envelope {
    const assertion = this.assertionWithPredicate(predicate);
    const obj = assertion.asObject();
    if (obj === undefined) {
      throw EnvelopeError.notAssertion();
    }
    return obj;
  }

  /**
   * Implementation of optionalObjectForPredicate()
   */
  optionalObjectForPredicate(predicate: EnvelopeEncodableValue): Envelope | undefined {
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
   * Implementation of objectsForPredicate()
   */
  objectsForPredicate(predicate: EnvelopeEncodableValue): Envelope[] {
    return this.assertionsWithPredicate(predicate).map((assertion) => {
      const obj = assertion.asObject();
      if (obj === undefined) {
        throw EnvelopeError.notAssertion();
      }
      return obj;
    });
  }

  /**
   * Implementation of elementsCount()
   */
  elementsCount(): number {
    let count = 1; // Count this envelope

    const c = this.case();
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

  /**
   * Implementation of isSubjectEncrypted()
   */
  isSubjectEncrypted(): boolean {
    const c = this.case();
    if (c.type === "encrypted") {
      return true;
    }
    if (c.type === "node") {
      return c.subject.isSubjectEncrypted();
    }
    return false;
  }

  /**
   * Implementation of isSubjectCompressed()
   */
  isSubjectCompressed(): boolean {
    const c = this.case();
    if (c.type === "compressed") {
      return true;
    }
    if (c.type === "node") {
      return c.subject.isSubjectCompressed();
    }
    return false;
  }

  /**
   * Implementation of isSubjectElided()
   */
  isSubjectElided(): boolean {
    const c = this.case();
    if (c.type === "elided") {
      return true;
    }
    if (c.type === "node") {
      return c.subject.isSubjectElided();
    }
    return false;
  }

  /**
   * Implementation of setPosition()
   */
  setPosition(position: number): Envelope {
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

  /**
   * Implementation of position()
   */
  position(): number {
    // Find the POSITION assertion in the envelope
    const positionEnvelope = this.objectForPredicate(POSITION);

    // Extract the position value
    const positionValue = positionEnvelope.extractNumber();
    return positionValue;
  }

  /**
   * Implementation of removePosition()
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

  /**
   * Implementation of wrap()
   */
  wrap(): Envelope {
    return Envelope.newWrapped(this);
  }

  /**
   * Implementation of tryUnwrap()
   */
  tryUnwrap(): Envelope {
    const c = this.subject().case();
    if (c.type === "wrapped") {
      return c.envelope;
    }
    throw EnvelopeError.notWrapped();
  }

  /**
   * Implementation of unwrap() - alias for tryUnwrap()
   */
  unwrap(): Envelope {
    return this.tryUnwrap();
  }

  /**
   * Implementation of walk()
   */
  walk<State>(hideNodes: boolean, state: State, visit: Visitor<State>): void {
    if (hideNodes) {
      walkTree(this, 0, EdgeType.None, state, visit);
    } else {
      walkStructure(this, 0, EdgeType.None, state, visit);
    }
  }

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
  digests(levelLimit: number): Set<Digest> {
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
   * Implementation of deepDigests()
   * Returns all digests in the envelope at all levels.
   */
  deepDigests(): Set<Digest> {
    return this.digests(Number.MAX_SAFE_INTEGER);
  }

  /**
   * Implementation of shallowDigests()
   * Returns the digests in the envelope down to its second level.
   */
  shallowDigests(): Set<Digest> {
    return this.digests(2);
  }

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
  structuralDigest(): Digest {
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    this.walk(false, undefined, (envelope, _level, _edge, _state) => {
      const c = envelope.case();
      // Discriminator byte for obscured cases — matches Rust line 247-251.
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

  /**
   * Implementation of object() - alias for tryObject()
   */
  object(): Envelope {
    return this.tryObject();
  }

  /**
   * Implementation of predicate() - alias for tryPredicate()
   */
  predicate(): Envelope {
    return this.tryPredicate();
  }

  /**
   * Implementation of toCbor() - alias for taggedCbor()
   */
  toCbor(): unknown {
    return this.taggedCbor();
  }

  /**
   * Implementation of expectLeaf() - returns the leaf CBOR value or throws
   */
  expectLeaf(): unknown {
    return this.tryLeaf();
  }

  /**
   * Implementation of elide()
   */
  elide(): Envelope {
    const c = this.case();
    if (c.type === "elided") {
      return this;
    }
    return Envelope.newElided(this.digest());
  }

  /**
   * Implementation of elideRemovingSetWithAction
   */
  elideRemovingSetWithAction(target: Set<Digest>, action: ObscureAction): Envelope {
    return elideSetWithAction(this, target, false, action);
  }

  /**
   * Implementation of elideSetWithAction (for revealing mode)
   */
  elideSetWithAction(target: Set<Digest>, action: ObscureAction): Envelope {
    return elideSetWithAction(this, target, true, action);
  }

  /**
   * Implementation of elideRemovingSet
   */
  elideRemovingSet(target: Set<Digest>): Envelope {
    return elideSetWithAction(this, target, false, elideAction());
  }

  /**
   * Implementation of elideRemovingArrayWithAction
   */
  elideRemovingArrayWithAction(target: DigestProvider[], action: ObscureAction): Envelope {
    const targetSet = new Set(target.map((p) => p.digest()));
    return elideSetWithAction(this, targetSet, false, action);
  }

  /**
   * Implementation of elideRemovingArray
   */
  elideRemovingArray(target: DigestProvider[]): Envelope {
    const targetSet = new Set(target.map((p) => p.digest()));
    return elideSetWithAction(this, targetSet, false, elideAction());
  }

  /**
   * Implementation of elideRemovingTargetWithAction
   */
  elideRemovingTargetWithAction(target: DigestProvider, action: ObscureAction): Envelope {
    return this.elideRemovingArrayWithAction([target], action);
  }

  /**
   * Implementation of elideRemovingTarget
   */
  elideRemovingTarget(target: DigestProvider): Envelope {
    return this.elideRemovingArray([target]);
  }

  /**
   * Implementation of elideRevealingSetWithAction
   */
  elideRevealingSetWithAction(target: Set<Digest>, action: ObscureAction): Envelope {
    return elideSetWithAction(this, target, true, action);
  }

  /**
   * Implementation of elideRevealingSet
   */
  elideRevealingSet(target: Set<Digest>): Envelope {
    return elideSetWithAction(this, target, true, elideAction());
  }

  /**
   * Implementation of elideRevealingArrayWithAction
   */
  elideRevealingArrayWithAction(target: DigestProvider[], action: ObscureAction): Envelope {
    const targetSet = new Set(target.map((p) => p.digest()));
    return elideSetWithAction(this, targetSet, true, action);
  }

  /**
   * Implementation of elideRevealingArray
   */
  elideRevealingArray(target: DigestProvider[]): Envelope {
    const targetSet = new Set(target.map((p) => p.digest()));
    return elideSetWithAction(this, targetSet, true, elideAction());
  }

  /**
   * Implementation of elideRevealingTargetWithAction
   */
  elideRevealingTargetWithAction(target: DigestProvider, action: ObscureAction): Envelope {
    return this.elideRevealingArrayWithAction([target], action);
  }

  /**
   * Implementation of elideRevealingTarget
   */
  elideRevealingTarget(target: DigestProvider): Envelope {
    return this.elideRevealingArray([target]);
  }

  /**
   * Implementation of unelide
   */
  unelide(envelope: Envelope): Envelope {
    if (this.digest().equals(envelope.digest())) {
      return envelope;
    }
    throw EnvelopeError.invalidDigest();
  }

  /**
   * Implementation of nodesMatching
   *
   * Mirrors Rust `Envelope::nodes_matching`. The TS public signature is
   * `Set<Digest>` for backward compatibility with callers, but the
   * underlying dedup is by **hex content** (via a hex-keyed Map) so two
   * `Digest` instances that represent the same hash bytes count once,
   * matching Rust's `HashSet<Digest>` semantics.
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
      const c = envelope.case();
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

  /**
   * Implementation of walkUnelide
   */
  walkUnelide(envelopes: Envelope[]): Envelope {
    // Build a lookup map of digest -> envelope
    const envelopeMap = new Map<string, Envelope>();
    for (const env of envelopes) {
      envelopeMap.set(env.digest().toHex(), env);
    }

    return walkUnelideWithMap(this, envelopeMap);
  }

  /**
   * Implementation of walkReplace
   */
  walkReplace(target: Set<Digest>, replacement: Envelope): Envelope {
    // Check if this node matches the target
    if (Array.from(target).some((d) => d.equals(this.digest()))) {
      return replacement;
    }

    const c = this.case();

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
      return Envelope.newWithAssertions(newSubject, newAssertions);
    }

    if (c.type === "wrapped") {
      const newEnvelope = c.envelope.walkReplace(target, replacement);
      if (newEnvelope.isIdenticalTo(c.envelope)) {
        return this;
      }
      return Envelope.newWrapped(newEnvelope);
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

      return Envelope.newAssertion(newPredicate, newObject);
    }

    return this;
  }

  /**
   * Implementation of isEquivalentTo
   *
   * Two envelopes are equivalent if they have the same digest (semantic equivalence).
   * This is a weaker comparison than `isIdenticalTo` which also checks the case type.
   *
   * Equivalent to Rust's `is_equivalent_to()` in `src/base/digest.rs`.
   */
  isEquivalentTo(other: Envelope): boolean {
    return this.digest().equals(other.digest());
  }

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
  isIdenticalTo(other: Envelope): boolean {
    if (!this.isEquivalentTo(other)) {
      return false;
    }
    return this.structuralDigest().equals(other.structuralDigest());
  }

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
  walkDecrypt(keys: SymmetricKey[]): Envelope {
    const c = this.case();

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
        return Envelope.newWithUncheckedAssertions(newSubject, newAssertions);
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
        return Envelope.newAssertion(newPredicate, newObject);
      }
      case "leaf":
      case "knownValue":
      case "elided":
      case "compressed":
        // No-op: these cases have no children to walk and no decrypt
        // operation applies (Rust's match arm `_ => self.clone()`).
        return this;
    }
  }

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
  walkDecompress(targetDigests?: Set<Digest>): Envelope {
    const matchesTarget = (envelope: Envelope): boolean => {
      if (targetDigests === undefined) return true;
      const ownDigest = envelope.digest();
      for (const d of targetDigests) {
        if (d.equals(ownDigest)) return true;
      }
      return false;
    };

    const c = this.case();

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
        return Envelope.newWithUncheckedAssertions(newSubject, newAssertions);
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
        return Envelope.newAssertion(newPredicate, newObject);
      }
      case "leaf":
      case "knownValue":
      case "elided":
      case "encrypted":
        // No-op: these cases have no children to walk and no decompress
        // operation applies (Rust's match arm `_ => self.clone()`).
        return this;
    }
  }

  /**
   * Add the tryLeaf method to Envelope prototype.
   *
   * This extracts the leaf CBOR value from an envelope.
   */
  tryLeaf(): Cbor {
    const c = this.case();
    if (c.type !== "leaf") {
      throw EnvelopeError.notLeaf();
    }
    return c.cbor;
  }

  /**
   * Add extraction convenience methods to Envelope prototype
   */
  extractString(): string {
    return extractString(this);
  }

  extractNumber(): number {
    return extractNumber(this);
  }

  extractBoolean(): boolean {
    return extractBoolean(this);
  }

  extractBytes(): Uint8Array {
    return extractBytes(this);
  }

  extractNull(): null {
    return extractNull(this);
  }

  /**
   * Add extractSubject method to Envelope prototype
   */
  extractSubject<T>(decoder: CborDecoder<T>): T {
    return extractSubject(this, decoder);
  }

  /**
   * Add tryObjectForPredicate method to Envelope prototype
   */
  tryObjectForPredicate<T>(predicate: EnvelopeEncodableValue, decoder: CborDecoder<T>): T {
    return tryObjectForPredicate(this, predicate, decoder);
  }

  /**
   * Add tryOptionalObjectForPredicate method to Envelope prototype
   */
  tryOptionalObjectForPredicate<T>(
    predicate: EnvelopeEncodableValue,
    decoder: CborDecoder<T>,
  ): T | undefined {
    return tryOptionalObjectForPredicate(this, predicate, decoder);
  }

  /**
   * Add extractObjectForPredicateWithDefault method to Envelope prototype
   */
  extractObjectForPredicateWithDefault<T>(
    predicate: EnvelopeEncodableValue,
    decoder: CborDecoder<T>,
    defaultValue: T,
  ): T {
    return extractObjectForPredicateWithDefault(this, predicate, decoder, defaultValue);
  }

  /**
   * Add extractObjectsForPredicate method to Envelope prototype
   */
  extractObjectsForPredicate<T>(predicate: EnvelopeEncodableValue, decoder: CborDecoder<T>): T[] {
    return extractObjectsForPredicate(this, predicate, decoder);
  }

  /**
   * Add tryObjectsForPredicate method to Envelope prototype
   */
  tryObjectsForPredicate<T>(predicate: EnvelopeEncodableValue, decoder: CborDecoder<T>): T[] {
    return tryObjectsForPredicate(this, predicate, decoder);
  }

  /**
   * Implementation of urString
   */
  urString(): string {
    // Use untaggedCbor() per Rust implementation - the UR type "envelope" implies the tag
    const ur = UR.from("envelope", this.untaggedCbor());
    return ur.toString();
  }

  /**
   * Implementation of ur
   */
  ur(): UR {
    // Use untaggedCbor() per Rust implementation - the UR type "envelope" implies the tag
    return UR.from("envelope", this.untaggedCbor());
  }

  /**
   * Implementation of taggedCborData (alias for cborBytes)
   */
  taggedCborData(): Uint8Array {
    return this.cborBytes();
  }

  encryptSubject(key: SymmetricKey): Envelope {
    const c = this.case();

    // Can't encrypt if already encrypted or elided
    if (c.type === "encrypted") {
      throw EnvelopeError.general("Envelope is already encrypted");
    }
    if (c.type === "elided") {
      throw EnvelopeError.general("Cannot encrypt elided envelope");
    }

    // For node case, encrypt just the subject
    if (c.type === "node") {
      if (c.subject.isEncrypted()) {
        throw EnvelopeError.general("Subject is already encrypted");
      }

      // Get the subject's CBOR data
      const subjectCbor = c.subject.taggedCbor();
      const encodedCbor = encodeCbor(subjectCbor);
      const subjectDigest = c.subject.digest();

      // Encrypt the subject
      const encryptedMessage = encryptWithDigest(key, encodedCbor, subjectDigest);

      // Create encrypted envelope
      const encryptedSubject = Envelope.fromCase({
        type: "encrypted",
        message: encryptedMessage,
      });

      // Rebuild the node with encrypted subject and same assertions
      return Envelope.newWithAssertions(encryptedSubject, c.assertions);
    }

    // For other cases, encrypt the entire envelope
    const cbor = this.taggedCbor();
    const encodedCbor = encodeCbor(cbor);
    const digest = this.digest();

    const encryptedMessage = encryptWithDigest(key, encodedCbor, digest);

    return Envelope.fromCase({
      type: "encrypted",
      message: encryptedMessage,
    });
  }

  /**
   * Implementation of decryptSubject()
   */
  decryptSubject(key: SymmetricKey): Envelope {
    const subjectCase = this.subject().case();

    if (subjectCase.type !== "encrypted") {
      throw EnvelopeError.general("Subject is not encrypted");
    }

    const message = subjectCase.message;
    const subjectDigest = message.aadDigest();

    if (subjectDigest === null) {
      throw EnvelopeError.general("Missing digest in encrypted message");
    }

    // Decrypt the subject
    const decryptedData = decryptWithDigest(key, message);

    // Parse back to envelope
    const cbor = decodeCbor(decryptedData);
    const resultSubject = Envelope.fromTaggedCbor(cbor);

    // Verify digest
    if (!resultSubject.digest().equals(subjectDigest)) {
      throw EnvelopeError.general("Invalid digest after decryption");
    }

    const c = this.case();

    // If this is a node, rebuild with decrypted subject
    if (c.type === "node") {
      const result = Envelope.newWithAssertions(resultSubject, c.assertions);
      if (!result.digest().equals(c.digest)) {
        throw EnvelopeError.general("Invalid envelope digest after decryption");
      }
      return result;
    }

    // Otherwise just return the decrypted subject
    return resultSubject;
  }

  /**
   * Implementation of encrypt() - convenience method
   */
  encrypt(key: SymmetricKey): Envelope {
    return this.wrap().encryptSubject(key);
  }

  /**
   * Implementation of decrypt() - convenience method
   */
  decrypt(key: SymmetricKey): Envelope {
    const decrypted = this.decryptSubject(key);
    return decrypted.unwrap();
  }

  /**
   * Implementation of isEncrypted()
   */
  isEncrypted(): boolean {
    return this.case().type === "encrypted";
  }

  compress(): Envelope {
    const c = this.case();

    // If already compressed, return as-is
    if (c.type === "compressed") {
      return this;
    }

    // Can't compress encrypted or elided envelopes
    if (c.type === "encrypted") {
      throw EnvelopeError.general("Cannot compress encrypted envelope");
    }
    if (c.type === "elided") {
      throw EnvelopeError.general("Cannot compress elided envelope");
    }

    // Compress the entire envelope (matches Rust
    // `bc-envelope-rust/src/extension/compress.rs::compress`).
    const cbor = this.taggedCbor();
    const decompressedData = encodeCbor(cbor);
    const compressed = Compressed.fromDecompressedData(decompressedData, this.digest());
    return Envelope.fromCase({ type: "compressed", value: compressed });
  }

  /**
   * Implementation of decompress()
   */
  decompress(): Envelope {
    const c = this.case();

    if (c.type !== "compressed") {
      throw EnvelopeError.general("Envelope is not compressed");
    }

    const compressed = c.value;
    const digest = compressed.digestOpt();

    if (digest === undefined) {
      throw EnvelopeError.general("Missing digest in compressed envelope");
    }

    // Verify the digest matches
    if (!digest.equals(this.digest())) {
      throw EnvelopeError.general("Invalid digest in compressed envelope");
    }

    // Decompress the data — `Compressed.decompress` itself verifies the
    // CRC32 checksum and throws on mismatch.
    const decompressedData = compressed.decompress();

    // Parse back to envelope
    const cbor = decodeCbor(decompressedData);
    const envelope = Envelope.fromTaggedCbor(cbor);

    // Verify the decompressed envelope has the correct digest
    if (!envelope.digest().equals(digest)) {
      throw EnvelopeError.general("Invalid digest after decompression");
    }

    return envelope;
  }

  /**
   * Implementation of compressSubject()
   */
  compressSubject(): Envelope {
    if (this.subject().isCompressed()) {
      return this;
    }

    const subject = this.subject().compress();
    return this.replaceSubject(subject);
  }

  /**
   * Implementation of decompressSubject()
   */
  decompressSubject(): Envelope {
    if (this.subject().isCompressed()) {
      const subject = this.subject().decompress();
      return this.replaceSubject(subject);
    }

    return this;
  }

  /**
   * Implementation of isCompressed()
   */
  isCompressed(): boolean {
    return this.case().type === "compressed";
  }
}

/// The type of incoming edge provided to the visitor.
///
/// This enum identifies how an envelope element is connected to its parent in
/// the hierarchy during traversal. It helps the visitor function understand the
/// semantic relationship between elements.
export enum EdgeType {
  /// No incoming edge (root)
  None = "none",
  /// Element is the subject of a node
  Subject = "subject",
  /// Element is an assertion on a node
  Assertion = "assertion",
  /// Element is the predicate of an assertion
  Predicate = "predicate",
  /// Element is the object of an assertion
  Object = "object",
  /// Element is the content wrapped by another envelope
  Content = "content",
}

/// Returns a short text label for the edge type, or undefined if no label is
/// needed.
///
/// This is primarily used for tree formatting to identify relationships
/// between elements.
///
/// @param edgeType - The edge type
/// @returns A short label or undefined
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

/// A visitor function that is called for each element in the envelope.
///
/// The visitor function takes the following parameters:
/// - `envelope`: The current envelope element being visited
/// - `level`: The depth level in the hierarchy (0 for root)
/// - `incomingEdge`: The type of edge connecting this element to its parent
/// - `state`: Optional context passed down from the parent's visitor call
///
/// The visitor returns a tuple of:
/// - The state that will be passed to child elements
/// - A boolean indicating whether to stop traversal (true = stop)
///
/// This enables accumulating state or passing context during traversal.
export type Visitor<State> = (
  envelope: Envelope,
  level: number,
  incomingEdge: EdgeType,
  state: State,
) => [State, boolean];

/// Recursive implementation of structure-based traversal.
///
/// This internal function performs the actual recursive traversal of the
/// envelope structure, visiting every element and maintaining the
/// correct level and edge relationships.
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
  const c = envelope.case();

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

/// Recursive implementation of tree-based traversal.
///
/// This internal function performs the actual recursive traversal of the
/// envelope's semantic tree, skipping node containers and focusing on
/// the semantic content elements. It maintains the correct level and
/// edge relationships while skipping structural elements.
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

  const c = envelope.case();

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

/// Types of obscuration that can be applied to envelope elements.
///
/// This enum identifies the different ways an envelope element can be obscured.
export enum ObscureType {
  /// The element has been elided, showing only its digest.
  Elided = "elided",

  /// The element has been encrypted using symmetric encryption.
  /// TODO: Implement when encrypt feature is added
  Encrypted = "encrypted",

  /// The element has been compressed to reduce its size.
  /// TODO: Implement when compress feature is added
  Compressed = "compressed",
}

/// Actions that can be performed on parts of an envelope to obscure them.
///
/// Gordian Envelope supports several ways to obscure parts of an envelope while
/// maintaining its semantic integrity and digest tree.
export type ObscureAction =
  { type: "elide" } | { type: "encrypt"; key: unknown } | { type: "compress" };

/// Helper to create elide action
export function elideAction(): ObscureAction {
  return { type: "elide" };
}

/// Late-binding handler for the encrypt obscure action.
/// Registered by extension/encrypt.ts to avoid circular dependencies.

/// Registers the handler for the encrypt obscure action.
/// Called by registerEncryptExtension() during module initialization.

/// Core elision logic
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
    if (action.type === "elide") {
      return envelope.elide();
    } else if (action.type === "encrypt") {
      return encryptWholeEnvelope(envelope, action.key as SymmetricKey);
    } else if (action.type === "compress") {
      return envelope.compress();
    }
  }

  const c = envelope.case();

  // Recursively process structure
  if (c.type === "assertion") {
    const predicate = elideSetWithAction(c.assertion.predicate(), target, isRevealing, action);
    const object = elideSetWithAction(c.assertion.object(), target, isRevealing, action);
    const elidedAssertion = new Assertion(predicate, object);
    return Envelope.newWithAssertion(elidedAssertion);
  } else if (c.type === "node") {
    const elidedSubject = elideSetWithAction(c.subject, target, isRevealing, action);
    const elidedAssertions = c.assertions.map((a) =>
      elideSetWithAction(a, target, isRevealing, action),
    );
    return Envelope.newWithUncheckedAssertions(elidedSubject, elidedAssertions);
  } else if (c.type === "wrapped") {
    const elidedEnvelope = elideSetWithAction(c.envelope, target, isRevealing, action);
    return Envelope.newWrapped(elidedEnvelope);
  }

  return envelope;
}

/// Helper to walk envelope tree
function walkEnvelope(envelope: Envelope, visitor: (e: Envelope) => void): void {
  visitor(envelope);

  const c = envelope.case();
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

/// Helper for walkUnelide with map
function walkUnelideWithMap(envelope: Envelope, envelopeMap: Map<string, Envelope>): Envelope {
  const c = envelope.case();

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

    return Envelope.newWithUncheckedAssertions(newSubject, newAssertions);
  }

  if (c.type === "wrapped") {
    const newEnvelope = walkUnelideWithMap(c.envelope, envelopeMap);
    if (newEnvelope.isIdenticalTo(c.envelope)) {
      return envelope;
    }
    return Envelope.newWrapped(newEnvelope);
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

    return Envelope.newAssertion(newPredicate, newObject);
  }

  return envelope;
}

/// Extracts a string value from an envelope.
///
/// @param envelope - The envelope to extract from
/// @returns The string value
/// @throws {EnvelopeError} If the envelope is not a leaf or cannot be converted
export function extractString(envelope: Envelope): string {
  const cbor = envelope.tryLeaf();
  try {
    return expectText(cbor);
  } catch (error) {
    throw EnvelopeError.cbor(
      "envelope does not contain a string",
      error instanceof Error ? error : undefined,
    );
  }
}

/// Extracts a number value from an envelope.
///
/// @param envelope - The envelope to extract from
/// @returns The number value
/// @throws {EnvelopeError} If the envelope is not a leaf or cannot be converted
export function extractNumber(envelope: Envelope): number {
  const cbor = envelope.tryLeaf();

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

/// Extracts a boolean value from an envelope.
///
/// @param envelope - The envelope to extract from
/// @returns The boolean value
/// @throws {EnvelopeError} If the envelope is not a leaf or cannot be converted
export function extractBoolean(envelope: Envelope): boolean {
  const cbor = envelope.tryLeaf();
  try {
    return expectBoolean(cbor);
  } catch (error) {
    throw EnvelopeError.cbor(
      "envelope does not contain a boolean",
      error instanceof Error ? error : undefined,
    );
  }
}

/// Extracts a byte array value from an envelope.
///
/// @param envelope - The envelope to extract from
/// @returns The byte array value
/// @throws {EnvelopeError} If the envelope is not a leaf or cannot be converted
export function extractBytes(envelope: Envelope): Uint8Array {
  const cbor = envelope.tryLeaf();
  try {
    return expectBytes(cbor);
  } catch (error) {
    throw EnvelopeError.cbor(
      "envelope does not contain bytes",
      error instanceof Error ? error : undefined,
    );
  }
}

/// Extracts null from an envelope.
///
/// @param envelope - The envelope to extract from
/// @throws {EnvelopeError} If the envelope is not a leaf containing null
export function extractNull(envelope: Envelope): null {
  const cbor = envelope.tryLeaf();
  if (isNull(cbor)) {
    return null;
  }
  throw EnvelopeError.cbor("envelope does not contain null");
}

/// Static methods for creating envelopes from CBOR data.
///
/// These are convenience methods that mirror the Rust implementation.
export class EnvelopeDecoder {
  /// Creates an envelope from a CBOR value.
  ///
  /// @param cbor - The CBOR value to convert into an envelope
  /// @returns A new envelope created from the CBOR data
  /// @throws {EnvelopeError} If the CBOR does not represent a valid envelope
  static tryFromCbor(cbor: Cbor): Envelope {
    try {
      return Envelope.fromTaggedCbor(cbor);
    } catch (error) {
      throw EnvelopeError.cbor("invalid envelope CBOR", error instanceof Error ? error : undefined);
    }
  }

  /// Creates an envelope from raw CBOR binary data.
  ///
  /// @param data - The raw CBOR binary data to convert into an envelope
  /// @returns A new envelope created from the CBOR data
  /// @throws {EnvelopeError} If the data is not valid CBOR or does not
  ///   represent a valid envelope structure
  static tryFromCborData(data: Uint8Array): Envelope {
    try {
      const cbor = decodeCbor(data);
      return EnvelopeDecoder.tryFromCbor(cbor);
    } catch (error) {
      throw EnvelopeError.cbor(
        "invalid envelope CBOR data",
        error instanceof Error ? error : undefined,
      );
    }
  }
}

/// Type for CBOR decoder functions
export type CborDecoder<T> = (cbor: Cbor) => T;

/// Extracts the subject of an envelope as type T using a decoder function.
///
/// This is the TypeScript equivalent of Rust's `TryFrom<Envelope>` trait bound.
/// Since TypeScript doesn't have trait bounds on generics, we pass a decoder
/// function explicitly.
///
/// Handles all envelope case types:
/// - leaf: decodes the CBOR value
/// - knownValue: converts to tagged CBOR then decodes
/// - wrapped: recurses into the inner envelope
/// - node: recurses on the subject
///
/// @example
/// ```typescript
/// const envelope = Envelope.new(myEncryptedKey.taggedCbor());
/// const extracted = envelope.extractSubject(EncryptedKey.fromTaggedCbor);
/// ```
///
/// @param decoder - Function to decode CBOR to type T
/// @returns The decoded value of type T
/// @throws {EnvelopeError} If the envelope case is unsupported or decoding fails
export function extractSubject<T>(envelope: Envelope, decoder: CborDecoder<T>): T {
  const subject = envelope.subject();
  const c = subject.case();

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
      return extractSubject(c.envelope, decoder);
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

/// Extracts the object for a predicate as type T using a decoder function.
///
/// @param envelope - The envelope to query
/// @param predicate - The predicate to match
/// @param decoder - Function to decode CBOR to type T
/// @returns The decoded value of type T
/// @throws {EnvelopeError} If predicate not found or decoding fails
export function tryObjectForPredicate<T>(
  envelope: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
): T {
  const obj = envelope.objectForPredicate(predicate);
  return extractSubject(obj, decoder);
}

/// Extracts the optional object for a predicate as type T using a decoder function.
///
/// @param envelope - The envelope to query
/// @param predicate - The predicate to match
/// @param decoder - Function to decode CBOR to type T
/// @returns The decoded value of type T, or undefined if predicate not found
/// @throws {EnvelopeError} If decoding fails (but not if predicate not found)
export function tryOptionalObjectForPredicate<T>(
  envelope: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
): T | undefined {
  const obj = envelope.optionalObjectForPredicate(predicate);
  if (obj === undefined) {
    return undefined;
  }
  return extractSubject(obj, decoder);
}

/// Extracts the object for a predicate as type T, with a default value if not found.
///
/// @param envelope - The envelope to query
/// @param predicate - The predicate to match
/// @param decoder - Function to decode CBOR to type T
/// @param defaultValue - Value to return if predicate not found
/// @returns The decoded value of type T, or the default value
/// @throws {EnvelopeError} If decoding fails (but not if predicate not found)
export function extractObjectForPredicateWithDefault<T>(
  envelope: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
  defaultValue: T,
): T {
  const result = tryOptionalObjectForPredicate(envelope, predicate, decoder);
  return result ?? defaultValue;
}

/// Extracts all objects for a predicate as type T using a decoder function.
///
/// @param envelope - The envelope to query
/// @param predicate - The predicate to match
/// @param decoder - Function to decode CBOR to type T
/// @returns Array of decoded values of type T
/// @throws {EnvelopeError} If any decoding fails
export function extractObjectsForPredicate<T>(
  envelope: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
): T[] {
  const objects = envelope.objectsForPredicate(predicate);
  return objects.map((obj) => extractSubject(obj, decoder));
}

/// Extracts all objects for a predicate as type T, returning empty array if none found.
///
/// @param envelope - The envelope to query
/// @param predicate - The predicate to match
/// @param decoder - Function to decode CBOR to type T
/// @returns Array of decoded values of type T (empty if no matches)
/// @throws {EnvelopeError} If any decoding fails
export function tryObjectsForPredicate<T>(
  envelope: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
): T[] {
  try {
    return extractObjectsForPredicate(envelope, predicate, decoder);
  } catch (error) {
    // If it's a nonexistent predicate error, return empty array
    if (error instanceof EnvelopeError && error.code === ErrorCode.NONEXISTENT_PREDICATE) {
      return [];
    }
    throw error;
  }
}

/**
 * Builds the AAD bytes for a digest, mirroring Rust
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
 * aadBytes]`) matches Rust byte-for-byte.
 */
function encryptWithDigest(
  key: SymmetricKey,
  plaintext: Uint8Array,
  digest: Digest,
): EncryptedMessage {
  const rng = secureRng();
  const nonceBytes = randomBytes(SYMMETRIC_NONCE_SIZE, { rng: rng });
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
 * {@link Digest}; the recovered digest is what callers compare against
 * `Envelope::digest()`.
 */
function decryptWithDigest(key: SymmetricKey, message: EncryptedMessage): Uint8Array {
  const digest = message.aadDigest();
  if (digest === null) {
    throw EnvelopeError.general("Missing digest in encrypted message");
  }
  const aad = message.aad;
  try {
    const ct = message.ciphertext;
    const tag = message.authenticationTag.bytes;
    const sealed = new Uint8Array(ct.length + tag.length);
    sealed.set(ct, 0);
    sealed.set(tag, ct.length);
    return chacha20Poly1305.decrypt(key.bytes, message.nonce.bytes, sealed, { aad });
  } catch (_error) {
    throw EnvelopeError.general("Decryption failed: invalid key or corrupted data");
  }
}

/// Encrypts an entire envelope as a unit, matching Rust's
/// ObscureAction::Encrypt behavior in elide_set_with_action.
/// Unlike encryptSubject which only encrypts a node's subject,
/// this encrypts the entire envelope's tagged CBOR.
export function encryptWholeEnvelope(envelope: Envelope, key: SymmetricKey): Envelope {
  const c = envelope.case();
  if (c.type === "encrypted") {
    throw EnvelopeError.general("Envelope is already encrypted");
  }
  if (c.type === "elided") {
    throw EnvelopeError.general("Cannot encrypt elided envelope");
  }
  const cbor = envelope.taggedCbor();
  const encodedCbor = encodeCbor(cbor);
  const digest = envelope.digest();
  const encryptedMessage = encryptWithDigest(key, encodedCbor, digest);
  return Envelope.fromCase({ type: "encrypted", message: encryptedMessage });
}

/// A predicate-object relationship representing an assertion about a subject.
///
/// In Gordian Envelope, assertions are the basic building blocks for attaching
/// information to a subject. An assertion consists of a predicate (which states
/// what is being asserted) and an object (which provides the assertion's
/// value).
///
/// Assertions can be attached to envelope subjects to form semantic statements
/// like: "subject hasAttribute value" or "document signedBy signature".
///
/// Assertions are equivalent to RDF (Resource Description Framework) triples,
/// where:
/// - The envelope's subject is the subject of the triple
/// - The assertion's predicate is the predicate of the triple
/// - The assertion's object is the object of the triple
///
/// Generally you do not create an instance of this type directly, but
/// instead use `Envelope.newAssertion()`, or the various functions
/// on `Envelope` that create assertions.
export class Assertion implements DigestProvider {
  private readonly _predicate: Envelope;
  private readonly _object: Envelope;
  private readonly _digest: Digest;

  /// Creates a new assertion and calculates its digest.
  ///
  /// This constructor takes a predicate and object, both of which are
  /// converted to envelopes using the `EnvelopeEncodable` trait. It then
  /// calculates the assertion's digest by combining the digests of the
  /// predicate and object.
  ///
  /// The digest is calculated according to the Gordian Envelope
  /// specification, which ensures that semantically equivalent assertions
  /// always produce the same digest.
  ///
  /// @param predicate - The predicate of the assertion, which states what is
  ///   being asserted
  /// @param object - The object of the assertion, which provides the assertion's
  ///   value
  ///
  /// @returns A new assertion with the specified predicate, object, and calculated
  /// digest.
  ///
  /// @example
  /// ```typescript
  /// // Direct method - create an assertion envelope
  /// const assertionEnvelope = Envelope.newAssertion("name", "Alice");
  ///
  /// // Or create and add an assertion to a subject
  /// const person = Envelope.new("person").addAssertion("name", "Alice");
  /// ```
  constructor(predicate: EnvelopeEncodable | Envelope, object: EnvelopeEncodable | Envelope) {
    this._predicate = predicate instanceof Envelope ? predicate : Envelope.new(predicate);
    this._object = object instanceof Envelope ? object : Envelope.new(object);
    this._digest = Digest.fromDigests([this._predicate.digest(), this._object.digest()]);
  }

  /// Returns the predicate of the assertion.
  ///
  /// The predicate states what is being asserted about the subject. It is
  /// typically a string or known value, but can be any envelope.
  ///
  /// @returns A clone of the assertion's predicate envelope.
  predicate(): Envelope {
    return this._predicate;
  }

  /// Returns the object of the assertion.
  ///
  /// The object provides the value or content of the assertion. It can be any
  /// type that can be represented as an envelope.
  ///
  /// @returns A clone of the assertion's object envelope.
  object(): Envelope {
    return this._object;
  }

  /// Returns the digest of this assertion.
  ///
  /// Implementation of the DigestProvider interface.
  ///
  /// @returns The assertion's digest
  digest(): Digest {
    return this._digest;
  }

  /// Checks if two assertions are equal based on digest equality.
  ///
  /// Two assertions are considered equal if they have the same digest,
  /// regardless of how they were constructed.
  ///
  /// @param other - The other assertion to compare with
  /// @returns `true` if the assertions are equal, `false` otherwise
  equals(other: Assertion): boolean {
    return this._digest.equals(other._digest);
  }

  /// Converts this assertion to CBOR.
  ///
  /// The CBOR representation of an assertion is a map with a single key-value
  /// pair, where the key is the predicate's CBOR and the value is the object's
  /// CBOR.
  ///
  /// @returns A CBOR representation of this assertion
  toCbor(): Cbor {
    const map = new CborMap();
    map.set(this._predicate.untaggedCbor(), this._object.untaggedCbor());
    return toCborValue(map);
  }

  /// Attempts to create an assertion from a CBOR value.
  ///
  /// The CBOR must be a map with exactly one entry, where the key represents
  /// the predicate and the value represents the object.
  ///
  /// @param cbor - The CBOR value to convert
  /// @returns A new Assertion instance
  /// @throws {EnvelopeError} If the CBOR is not a valid assertion
  static fromCbor(cbor: Cbor): Assertion {
    // Check if cbor is a Map
    if (!(cbor instanceof CborMap)) {
      throw EnvelopeError.invalidAssertion();
    }

    return Assertion.fromCborMap(cbor);
  }

  /// Attempts to create an assertion from a CBOR map.
  ///
  /// The map must have exactly one entry, where the key represents the
  /// predicate and the value represents the object. This is used in
  /// the deserialization process.
  ///
  /// @param map - The CBOR map to convert
  /// @returns A new Assertion instance
  /// @throws {EnvelopeError} If the map doesn't have exactly one entry
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

  /// Creates a string representation of this assertion for debugging.
  ///
  /// @returns A string representation
  toString(): string {
    return `Assertion(${String(this._predicate)}: ${String(this._object)})`;
  }

  /// Creates a copy of this assertion.
  ///
  /// Since assertions are immutable and envelopes are cheap to clone,
  /// this returns the same instance.
  ///
  /// @returns This assertion instance
  clone(): Assertion {
    return this;
  }
}
