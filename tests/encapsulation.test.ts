/**
 * Encapsulation tests for Gordian Envelope
 *
 * This test file is ported from bc-envelope-rust/tests/encapsulation_tests.rs
 *
 * These tests verify that envelope encryption/decryption round-trips work
 * correctly with different key encapsulation mechanisms (KEMs).
 *
 * Currently supported:
 * - X25519: Curve25519-based key exchange (default, always available)
 *
 * Future support (post-quantum):
 * - MLKEM512, MLKEM768, MLKEM1024: ML-KEM at various security levels
 */

import { describe, it, expect } from "vitest";
import { Envelope, EnvelopeError } from "../src/index.js";
import {
  ComponentsError,
  PrivateKeys as PrivateKeyBase,
  SealedMessage,
  SymmetricKey,
  type Encrypter,
} from "@blockchaincommons/components";
import { EncapsulationScheme, createEncapsulationKeypair } from "@blockchaincommons/components";
import { encodeCbor } from "@blockchaincommons/dcbor";
import { HAS_RECIPIENT } from "@blockchaincommons/known-values";
import { MLKEMLevel, MLKEMPrivateKey } from "@blockchaincommons/components/pq";
import "../src/all.js";

/**
 * Helper function to create a hello envelope (equivalent to Rust's hello_envelope())
 */
function helloEnvelope(): Envelope {
  return Envelope.from("Hello.");
}

/**
 * Test encryption and decryption round-trip for X25519 scheme.
 *
 * This tests the Envelope's recipient encryption using the PrivateKeyBase API,
 * which internally uses X25519 key exchange.
 */
function testX25519Scheme(): void {
  // Generate keypair using PrivateKeyBase (X25519 internally)
  const privateKey = PrivateKeyBase.generate();
  const publicKey = privateKey.publicKeys();

  // Create and encrypt envelope
  const envelope = helloEnvelope();
  const encryptedEnvelope = envelope.encryptToRecipients([publicKey]);

  // Decrypt the envelope
  const decryptedEnvelope = encryptedEnvelope.decryptToRecipient(privateKey);

  // Verify structural digest matches
  expect(envelope.digest().toHex()).toEqual(decryptedEnvelope.digest().toHex());
}

/**
 * Test encryption and decryption round-trip using EncapsulationScheme API.
 *
 * This tests the lower-level encapsulation API from @blockchaincommons/components.
 */
function testEncapsulationScheme(scheme: EncapsulationScheme): void {
  // Generate keypair for the given scheme
  const [privateKey, publicKey] = createEncapsulationKeypair(scheme);

  // Plaintext would be encrypted with the shared secret in a real scenario

  // Encapsulate a shared secret
  const [sharedSecret, ciphertext] = publicKey.encapsulateNewSharedSecret();

  // Decapsulate the shared secret
  const decapsulated = privateKey.decapsulateSharedSecret(ciphertext);

  // Verify shared secrets match
  expect(sharedSecret.bytes).toEqual(decapsulated.bytes);
}

/**
 * Test ML-KEM (post-quantum) encapsulation at a specific security level.
 *
 * This tests the ML-KEM implementation directly from @blockchaincommons/components.
 */
function testMLKEMLevel(level: MLKEMLevel): void {
  // Generate ML-KEM keypair
  const [privateKey, publicKey] = MLKEMPrivateKey.keypair(level);

  // Encapsulate a shared secret (returns object, not tuple)
  const { sharedSecret, ciphertext } = publicKey.encapsulate();

  // Decapsulate the shared secret (returns SymmetricKey)
  const decapsulated = privateKey.decapsulate(ciphertext);

  // Verify shared secrets match
  expect(sharedSecret.bytes).toEqual(decapsulated.bytes);
}

describe("Encapsulation", () => {
  describe("X25519 Envelope Encryption", () => {
    it("should encrypt and decrypt envelope using X25519", () => {
      testX25519Scheme();
    });

    it("should preserve structural digest after round-trip", () => {
      const privateKey = PrivateKeyBase.generate();
      const publicKey = privateKey.publicKeys();

      const envelope = helloEnvelope();
      const originalDigest = envelope.digest();

      const encrypted = envelope.encryptToRecipients([publicKey]);
      const decrypted = encrypted.decryptToRecipient(privateKey);

      expect(decrypted.digest().equals(originalDigest)).toBe(true);
    });

    it("should work with encryptSubjectToRecipient for subject-only encryption", () => {
      const privateKey = PrivateKeyBase.generate();
      const publicKey = privateKey.publicKeys();

      const envelope = helloEnvelope();
      const encrypted = envelope.encryptSubjectToRecipient(publicKey);
      const decrypted = encrypted.decryptSubjectToRecipient(privateKey);

      // Note: The envelope digest won't match because encryptSubjectToRecipient
      // adds recipient assertions. But the subject content should match.
      expect(decrypted.subject().asText()).toBe("Hello.");
    });
  });

  describe("EncapsulationScheme API", () => {
    it("should encapsulate and decapsulate with X25519 scheme", () => {
      testEncapsulationScheme(EncapsulationScheme.X25519);
    });

    it("should generate unique keypairs", () => {
      const [priv1, pub1] = createEncapsulationKeypair(EncapsulationScheme.X25519);
      const [priv2, pub2] = createEncapsulationKeypair(EncapsulationScheme.X25519);

      expect(priv1.equals(priv2)).toBe(false);
      expect(pub1.equals(pub2)).toBe(false);
    });

    it("should produce matching shared secrets", () => {
      const [privateKey, publicKey] = createEncapsulationKeypair(EncapsulationScheme.X25519);

      const [senderSecret, ciphertext] = publicKey.encapsulateNewSharedSecret();
      const receiverSecret = privateKey.decapsulateSharedSecret(ciphertext);

      expect(senderSecret.bytes).toEqual(receiverSecret.bytes);
    });
  });

  describe("ML-KEM Post-Quantum Encapsulation", () => {
    it("should encapsulate and decapsulate with MLKEM512", () => {
      testMLKEMLevel(MLKEMLevel.MLKEM512);
    });

    it("should encapsulate and decapsulate with MLKEM768", () => {
      testMLKEMLevel(MLKEMLevel.MLKEM768);
    });

    it("should encapsulate and decapsulate with MLKEM1024", () => {
      testMLKEMLevel(MLKEMLevel.MLKEM1024);
    });

    it("should generate correct key sizes for MLKEM512", () => {
      const [privateKey, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM512);
      expect(privateKey.bytes.length).toBe(1632);
      expect(publicKey.bytes.length).toBe(800);
    });

    it("should generate correct key sizes for MLKEM768", () => {
      const [privateKey, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);
      expect(privateKey.bytes.length).toBe(2400);
      expect(publicKey.bytes.length).toBe(1184);
    });

    it("should generate correct key sizes for MLKEM1024", () => {
      const [privateKey, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM1024);
      expect(privateKey.bytes.length).toBe(3168);
      expect(publicKey.bytes.length).toBe(1568);
    });

    it("should produce 32-byte shared secrets for all levels", () => {
      for (const level of [MLKEMLevel.MLKEM512, MLKEMLevel.MLKEM768, MLKEMLevel.MLKEM1024]) {
        const [, publicKey] = MLKEMPrivateKey.keypair(level);
        const { sharedSecret } = publicKey.encapsulate();
        expect(sharedSecret.bytes.length).toBe(32);
      }
    });
  });

  describe("Combined Encapsulation Tests", () => {
    /**
     * This test mirrors the original Rust test structure:
     * test_scheme(EncapsulationScheme::X25519);
     * test_scheme(EncapsulationScheme::MLKEM512);
     * test_scheme(EncapsulationScheme::MLKEM768);
     * test_scheme(EncapsulationScheme::MLKEM1024);
     */
    it("should test X25519 encapsulation", () => {
      testEncapsulationScheme(EncapsulationScheme.X25519);
    });

    // Note: The following tests use the ML-KEM API directly since
    // EncapsulationScheme currently only supports X25519 at the scheme level.
    // When ML-KEM support is added to EncapsulationScheme, these can be updated.

    it("should test MLKEM512 encapsulation", () => {
      testMLKEMLevel(MLKEMLevel.MLKEM512);
    });

    it("should test MLKEM768 encapsulation", () => {
      testMLKEMLevel(MLKEMLevel.MLKEM768);
    });

    it("should test MLKEM1024 encapsulation", () => {
      testMLKEMLevel(MLKEMLevel.MLKEM1024);
    });
  });

  describe("Error Cases", () => {
    it("should fail decryption with wrong private key", () => {
      const alice = PrivateKeyBase.generate();
      const bob = PrivateKeyBase.generate();

      const envelope = helloEnvelope();
      const encrypted = envelope.encryptToRecipients([alice.publicKeys()]);

      // Bob cannot decrypt Alice's message
      expect(() => encrypted.decryptToRecipient(bob)).toThrow();
    });

    it("should fail ML-KEM decapsulation with wrong private key", () => {
      const [, alicePublic] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);
      const [bobPrivate] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);

      const { sharedSecret: aliceSecret, ciphertext } = alicePublic.encapsulate();

      // Bob's private key cannot decapsulate Alice's ciphertext correctly
      // (it will produce a different shared secret due to ML-KEM's implicit rejection)
      const bobDecapsulated = bobPrivate.decapsulate(ciphertext);

      // The secrets should NOT match (demonstrating authentication)
      expect(aliceSecret.bytes).not.toEqual(bobDecapsulated.bytes);
    });

    it("accepts an empty recipient list, as the reference does", () => {
      const envelope = helloEnvelope();
      const encrypted = envelope.encryptSubjectToRecipients([]);
      expect(encrypted.isSubjectEncrypted()).toBe(true);
      expect(encrypted.recipients()).toEqual([]);
    });

    it("reports a sealed plaintext that is not a symmetric key as Cbor with dcbor's message", () => {
      // The reference's `SymmetricKey::from_tagged_cbor_data(content_key_data)?`.
      const bob = PrivateKeyBase.generate();
      const key = SymmetricKey.random();
      const keyCbor = encodeCbor(key.toCbor());
      const trailing = new Uint8Array(keyCbor.length + 1);
      trailing.set(keyCbor);
      const rows: [string, Uint8Array, string, string][] = [
        ["not CBOR", new TextEncoder().encode("garbage"), "Underrun", "early end of CBOR data"],
        [
          "an integer",
          new Uint8Array([1]),
          "WrongType",
          "the decoded CBOR value was not the expected type",
        ],
        [
          "a trailing byte",
          trailing,
          "UnusedData",
          "the decoded CBOR had 1 extra bytes at the end",
        ],
      ];
      for (const [name, plaintext, cause, message] of rows) {
        const sealed = SealedMessage.seal(plaintext, bob.publicKeys().encapsulationPublicKey());
        const envelope = helloEnvelope().encryptSubject(key).addAssertion(HAS_RECIPIENT, sealed);
        let error: unknown;
        try {
          envelope.decryptSubjectToRecipient(bob);
        } catch (e) {
          error = e;
        }
        expect(EnvelopeError.isEnvelopeError(error), name).toBe(true);
        if (EnvelopeError.isEnvelopeError(error)) {
          expect(error.code, name).toBe("Cbor");
          expect(error.message, name).toBe(`dcbor error: ${message}`);
          expect((error.cause as { code?: string } | undefined)?.code, name).toBe(cause);
        }
      }
    });

    it("reports a components failure while sealing as Components with components' message", () => {
      // The reference's `?` into `Error::Components` around `SealedMessage::new`.
      const broken: Encrypter = {
        encapsulationPublicKey: () => {
          throw ComponentsError.invalidData("no key");
        },
      } as unknown as Encrypter;
      let error: unknown;
      try {
        helloEnvelope().addRecipient(broken, SymmetricKey.random());
      } catch (e) {
        error = e;
      }
      expect(EnvelopeError.isEnvelopeError(error)).toBe(true);
      if (EnvelopeError.isEnvelopeError(error)) {
        expect(error.code).toBe("Components");
        expect(error.message).toBe("components error: invalid data: no key");
        expect(error.cause?.name).toBe("ComponentsError");
      }
    });
  });

  describe("Multiple Recipients", () => {
    it("should encrypt to multiple recipients", () => {
      const alice = PrivateKeyBase.generate();
      const bob = PrivateKeyBase.generate();
      const charlie = PrivateKeyBase.generate();

      const envelope = helloEnvelope();
      const encrypted = envelope.encryptToRecipients([
        alice.publicKeys(),
        bob.publicKeys(),
        charlie.publicKeys(),
      ]);

      // All recipients should be able to decrypt
      const aliceDecrypted = encrypted.decryptToRecipient(alice);
      const bobDecrypted = encrypted.decryptToRecipient(bob);
      const charlieDecrypted = encrypted.decryptToRecipient(charlie);

      const originalDigest = envelope.digest();
      expect(aliceDecrypted.digest().equals(originalDigest)).toBe(true);
      expect(bobDecrypted.digest().equals(originalDigest)).toBe(true);
      expect(charlieDecrypted.digest().equals(originalDigest)).toBe(true);
    });
  });
});
