/**
 * Keypair Signing Tests for Gordian Envelope
 *
 * This test file is a TypeScript port of the Rust keypair_signing_tests.rs
 * from bc-envelope-rust, covering the ECDSA (secp256k1) scheme. Schnorr,
 * Ed25519 and SSH signing are covered in the other signature test files
 * (`tests/ssh.test.ts` covers SSH).
 *
 * The tests verify the complete flow:
 * 1. Generate a keypair
 * 2. Sign an envelope with the private key
 * 3. Verify the signature with the public key
 */

import { describe, it, expect } from "vitest";
import { Envelope } from "../src/index.js";
import { SigningPrivateKey } from "@blockchaincommons/components";
import "../src/all.js";

/**
 * The "Hello." plaintext used in many tests, matching the Rust test_data.
 */
const PLAINTEXT_HELLO = "Hello.";

/**
 * Creates a "Hello." envelope, matching the Rust hello_envelope() helper.
 */
function helloEnvelope(): Envelope {
  return Envelope.from(PLAINTEXT_HELLO);
}

/**
 * Checks that an envelope can round-trip through CBOR encoding.
 * This matches the Rust check_encoding() trait method.
 *
 * @param envelope - The envelope to check
 * @returns The same envelope if encoding is valid
 * @throws Error if encoding round-trip fails
 */
function checkEncoding(envelope: Envelope): Envelope {
  // Get the tagged CBOR representation
  const cbor = envelope.toCbor();

  // Restore from CBOR
  const restored = Envelope.fromCbor(cbor);

  // Verify digests match
  const originalDigest = envelope.digest().toHex();
  const restoredDigest = restored.digest().toHex();

  if (originalDigest !== restoredDigest) {
    throw new Error(
      `Digest mismatch after encoding round-trip: expected ${originalDigest}, got ${restoredDigest}`,
    );
  }

  return envelope;
}

/**
 * Tests signing with ECDSA (the signature scheme available in the envelope package).
 *
 * This corresponds to the Rust test_scheme() function which:
 * 1. Creates a keypair
 * 2. Signs the hello envelope
 * 3. Checks encoding round-trip
 * 4. Verifies the signature
 */
function testEcdsaScheme(): void {
  // Generate a new keypair
  const privateKey = SigningPrivateKey.random();
  const publicKey = privateKey.publicKey();

  // Sign the hello envelope (sign() wraps then adds signature)
  const signedEnvelope = helloEnvelope().sign(privateKey);

  // Check encoding round-trip
  checkEncoding(signedEnvelope);

  // Verify the signature and unwrap
  const verified = signedEnvelope.verify(publicKey);

  // The verified envelope should have the original content
  expect(verified.subject().asText()).toBe(PLAINTEXT_HELLO);
}

describe("Keypair Signing Tests", () => {
  /**
   * Main test corresponding to Rust's test_keypair_signing().
   *
   * The Rust version tests multiple schemes:
   * - Schnorr
   * - ECDSA
   * - Ed25519
   * - MLDSA44, MLDSA65, MLDSA87
   *
   * The TypeScript envelope package currently only has built-in support for
   * ECDSA (secp256k1). For other schemes, the @blockchaincommons/components package
   * provides SigningPrivateKey with full scheme support.
   */
  describe("test_keypair_signing", () => {
    it("should sign and verify with ECDSA scheme", () => {
      testEcdsaScheme();
    });

    it("should generate different keypairs each time", () => {
      const key1 = SigningPrivateKey.random();
      const key2 = SigningPrivateKey.random();

      // Keys should be different - compare via taggedCborData()
      const key1Hex = Array.from(key1.toCbor().toData())
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const key2Hex = Array.from(key2.toCbor().toData())
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      expect(key1Hex).not.toBe(key2Hex);
    });

    it("should derive consistent public key from private key", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey1 = privateKey.publicKey();
      const publicKey2 = privateKey.publicKey();

      // SigningPublicKey doesn't have toHex() directly - use taggedCborData()
      const hex1 = Array.from(publicKey1.toCbor().toData())
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const hex2 = Array.from(publicKey2.toCbor().toData())
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expect(hex1).toBe(hex2);
    });
  });

  describe("Signing workflow", () => {
    it("should sign envelope and preserve subject content", () => {
      const privateKey = SigningPrivateKey.random();
      const envelope = helloEnvelope();

      // sign() wraps then adds signature
      const signed = envelope.sign(privateKey);

      // The signed envelope should have assertions (the signature)
      expect(signed.assertions().length).toBeGreaterThan(0);
    });

    it("should verify valid signature", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();
      const envelope = helloEnvelope();

      const signed = envelope.sign(privateKey);
      const verified = signed.verify(publicKey);

      expect(verified.subject().asText()).toBe(PLAINTEXT_HELLO);
    });

    it("should reject signature from wrong key", () => {
      const signingKey = SigningPrivateKey.random();
      const wrongKey = SigningPrivateKey.random();
      const wrongPublicKey = wrongKey.publicKey();

      const signed = helloEnvelope().sign(signingKey);

      // Verification with wrong key should fail
      expect(() => signed.verify(wrongPublicKey)).toThrow();
    });
  });

  describe("CBOR encoding round-trip", () => {
    it("should preserve signed envelope through CBOR round-trip", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();

      const signed = helloEnvelope().sign(privateKey);

      // Round-trip through CBOR
      const cbor = signed.toCbor();
      const restored = Envelope.fromCbor(cbor);

      // Digests should match
      expect(restored.digest().toHex()).toBe(signed.digest().toHex());

      // Should still verify with original public key
      const verified = restored.verify(publicKey);
      expect(verified.subject().asText()).toBe(PLAINTEXT_HELLO);
    });

    it("should maintain signature validity after CBOR round-trip", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();

      const envelope = Envelope.from("Test message");
      const signed = envelope.sign(privateKey);

      // First verify
      expect(() => signed.verify(publicKey)).not.toThrow();

      // Round-trip
      const restored = Envelope.fromCbor(signed.toCbor());

      // Second verify
      expect(() => restored.verify(publicKey)).not.toThrow();
    });
  });

  describe("Key serialization", () => {
    it("should serialize private key to CBOR data", () => {
      // SigningPrivateKey doesn't expose toData() directly
      // Use taggedCborData() to verify serialization works
      const key1 = SigningPrivateKey.random();
      const key1Data = key1.toCbor().toData();

      // Should produce non-empty data
      expect(key1Data.length).toBeGreaterThan(0);

      // Key should still work after getting data
      const message = Envelope.from("Test");
      const sig1 = message.sign(key1);

      // Should verify with the key's public key
      expect(sig1.hasSignatureFrom(key1.publicKey())).toBe(true);
    });
  });

  describe("Multiple envelope types", () => {
    it("should sign string envelope", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();

      const envelope = Envelope.from("Hello, World!");
      const signed = envelope.sign(privateKey);
      const verified = signed.verify(publicKey);

      expect(verified.subject().asText()).toBe("Hello, World!");
    });

    it("should sign number envelope", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();

      const envelope = Envelope.from(42);
      const signed = envelope.sign(privateKey);
      const verified = signed.verify(publicKey);

      expect(verified.subject().expectNumber()).toBe(42);
    });

    it("should sign boolean envelope", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();

      const envelope = Envelope.from(true);
      const signed = envelope.sign(privateKey);
      const verified = signed.verify(publicKey);

      expect(verified.subject().expectBoolean()).toBe(true);
    });

    it("should sign envelope with assertions", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();

      const envelope = Envelope.from("Alice").addAssertion("knows", "Bob").addAssertion("age", 30);

      const signed = envelope.sign(privateKey);
      const verified = signed.verify(publicKey);

      // After verification and unwrap, we should have the original envelope
      expect(verified.subject().asText()).toBe("Alice");
    });

    it("should sign wrapped envelope", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();

      const envelope = helloEnvelope().wrap();
      const signed = envelope.sign(privateKey);
      const verified = signed.verify(publicKey);

      // The verified envelope is the wrapped hello envelope
      const unwrapped = verified.unwrap();
      expect(unwrapped.subject().asText()).toBe(PLAINTEXT_HELLO);
    });

    it("should sign double-wrapped envelope", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();

      const envelope = helloEnvelope().wrap().wrap();
      const signed = envelope.sign(privateKey);
      const verified = signed.verify(publicKey);

      // Unwrap twice to get original
      const once = verified.unwrap();
      const twice = once.unwrap();
      expect(twice.subject().asText()).toBe(PLAINTEXT_HELLO);
    });
  });

  describe("Signature assertions", () => {
    it("should create signature assertion on envelope", () => {
      const privateKey = SigningPrivateKey.random();

      const envelope = helloEnvelope();
      const signed = envelope.sign(privateKey);

      // Should have at least one signature
      expect(signed.signatures().length).toBeGreaterThan(0);
    });

    it("should detect signature presence", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();

      const signed = helloEnvelope().sign(privateKey);

      expect(signed.hasSignatureFrom(publicKey)).toBe(true);
    });

    it("should not detect signature from different key", () => {
      const signingKey = SigningPrivateKey.random();
      const otherKey = SigningPrivateKey.random();
      const otherPublicKey = otherKey.publicKey();

      const signed = helloEnvelope().sign(signingKey);

      expect(signed.hasSignatureFrom(otherPublicKey)).toBe(false);
    });
  });
});
