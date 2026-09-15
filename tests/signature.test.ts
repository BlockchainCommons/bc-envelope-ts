import { Envelope, EnvelopeError } from "../src/index.js";
import { PrivateKeyBase, SigningPrivateKey, type Verifier } from "@blockchaincommons/components";
import { SignatureMetadata } from "../src/extension/signature.js";
import { NOTE, SIGNED } from "@blockchaincommons/known-values";
import "../src/all.js";

describe("Signature Extension", () => {
  describe("Key generation", () => {
    it("should generate private and public keys", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();

      expect(privateKey).toBeDefined();
      expect(publicKey).toBeDefined();
      // SigningPublicKey doesn't have toHex() directly, use toString() for validation
      expect(publicKey.toString().length).toBeGreaterThan(0);
    });
  });

  describe("Basic signature", () => {
    it("should sign envelope and add assertion", () => {
      const privateKey = SigningPrivateKey.random();
      const message = Envelope.from("Hello, world!");

      const signed = message.addSignature(privateKey);

      expect(signed.assertions().length).toBeGreaterThan(0);
      expect(signed.signatures().length).toBeGreaterThan(0);
    });
  });

  describe("Signature verification", () => {
    it("should verify valid signature", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();
      const message = Envelope.from("Hello, world!");

      const signed = message.addSignature(privateKey);

      expect(signed.hasSignatureFrom(publicKey)).toBe(true);

      const verified = signed.verifySignatureFrom(publicKey);
      expect(verified.subject().asText()).toBe("Hello, world!");
    });

    it("should reject invalid signature", () => {
      const privateKey = SigningPrivateKey.random();
      const wrongKey = SigningPrivateKey.random();
      const wrongPublicKey = wrongKey.publicKey();
      const message = Envelope.from("Hello, world!");

      const signed = message.addSignature(privateKey);

      expect(signed.hasSignatureFrom(wrongPublicKey)).toBe(false);
    });
  });

  describe("Multiple signatures", () => {
    it("should support multiple signers", () => {
      const alice = SigningPrivateKey.random();
      const bob = SigningPrivateKey.random();
      const charlie = SigningPrivateKey.random();

      const contract = Envelope.from("Multi-party agreement");
      const multiSigned = contract.addSignatures([alice, bob, charlie]);

      expect(multiSigned.signatures().length).toBe(3);
      expect(multiSigned.hasSignatureFrom(alice.publicKey())).toBe(true);
      expect(multiSigned.hasSignatureFrom(bob.publicKey())).toBe(true);
      expect(multiSigned.hasSignatureFrom(charlie.publicKey())).toBe(true);
    });
  });

  describe("Signature with metadata (double-signing)", () => {
    it("should add signature with metadata and double-sign", () => {
      const alice = SigningPrivateKey.random();
      const alicePub = alice.publicKey();
      const metadata = SignatureMetadata.from()
        .withAssertion(NOTE, "Signed by Alice")
        .withAssertion("timestamp", "2024-01-15T10:30:00Z")
        .withAssertion("purpose", "Contract approval");

      const document = Envelope.from("Important document");
      const signedWithMetadata = document.addSignature(alice, { metadata: metadata });

      expect(signedWithMetadata.assertions().length).toBeGreaterThan(0);
      expect(signedWithMetadata.hasSignatureFrom(alicePub)).toBe(true);

      // Verify double-signed structure:
      // The signature object should contain a wrapped envelope (metadata)
      // with an outer 'signed' assertion
      const sigs = signedWithMetadata.signatures();
      expect(sigs.length).toBe(1);
      const sigObj = sigs[0];
      // Subject should be wrapped (contains metadata)
      expect(sigObj.subject().isWrapped()).toBe(true);
      // Should have an outer 'signed' assertion
      expect(sigObj.assertionsWithPredicate(SIGNED).length).toBe(1);
    });

    it("should verify and return metadata envelope", () => {
      const alice = SigningPrivateKey.random();
      const alicePub = alice.publicKey();
      const metadata = SignatureMetadata.from()
        .withAssertion(NOTE, "Alice signed this.")
        .withAssertion("date", "2024-04-02");

      const envelope = Envelope.from("Important document")
        .wrap()
        .addSignature(alice, { metadata: metadata });

      // verify_returning_metadata returns (unwrapped envelope, metadata envelope)
      const result = envelope.verifyReturningMetadata(alicePub);

      // The unwrapped envelope should be the original content
      expect(result.envelope.subject().asText()).toBe("Important document");

      // The metadata envelope should contain the note
      const noteObj = result.metadata.objectForPredicate(NOTE);
      expect(noteObj.subject().asText()).toBe("Alice signed this.");
    });

    it("should reject metadata signature from wrong key", () => {
      const alice = SigningPrivateKey.random();
      const bob = SigningPrivateKey.random();
      const metadata = SignatureMetadata.from().withAssertion(NOTE, "Signed by Alice");

      const document = Envelope.from("Secret");
      const signedWithMetadata = document.addSignature(alice, { metadata: metadata });

      expect(signedWithMetadata.hasSignatureFrom(bob.publicKey())).toBe(false);
    });
  });

  describe("Key serialization", () => {
    it("should serialize key to CBOR data", () => {
      // SigningPrivateKey doesn't expose toData() directly
      // Use taggedCborData() to verify serialization works
      const key1 = SigningPrivateKey.random();
      const key1Data = key1.toCbor().toData();

      // Should produce non-empty data
      expect(key1Data.length).toBeGreaterThan(0);

      // Key should still work after getting data
      const testMsg = Envelope.from("Test message");
      const sig1 = testMsg.addSignature(key1);

      expect(sig1.hasSignatureFrom(key1.publicKey())).toBe(true);
    });
  });

  describe("Signature preservation", () => {
    it("should preserve signature through operations", () => {
      const alice = SigningPrivateKey.random();
      const original = Envelope.from("Alice").addAssertion("age", 30).addSignature(alice);

      expect(original.hasSignatureFrom(alice.publicKey())).toBe(true);

      original.wrap();
      expect(original.hasSignatureFrom(alice.publicKey())).toBe(true);
    });
  });

  describe("Verifier failures", () => {
    it("propagate a verifier's own error unchanged, on bare and metadata signatures", () => {
      // The reference calls `key.verify` outside any mapping: only a
      // signature object that is not a `Signature` gives a signature-type code.
      const alice = SigningPrivateKey.random();
      const boom = new Error("verifier failed");
      const throwing: Verifier = {
        verify: () => {
          throw boom;
        },
      };
      const bare = Envelope.from("Secret").addSignature(alice);
      expect(() => bare.hasSignatureFrom(throwing)).toThrow(boom);
      const metadata = SignatureMetadata.from().withAssertion(NOTE, "Signed by Alice");
      const withMetadata = Envelope.from("Secret").addSignature(alice, { metadata });
      expect(() => withMetadata.hasSignatureFrom(throwing)).toThrow(boom);
      // A verifier that returns `false` is not a failure.
      const denying: Verifier = { verify: () => false };
      expect(bare.hasSignatureFrom(denying)).toBe(false);
      expect(withMetadata.hasSignatureFrom(denying)).toBe(false);
    });

    it("map a signature object that is not a Signature to the signature-type codes", () => {
      const alice = SigningPrivateKey.random();
      const bare = Envelope.from("Secret").addAssertion(SIGNED, "not a signature");
      expect(() => bare.hasSignatureFrom(alice.publicKey())).toThrow(EnvelopeError);
      try {
        bare.hasSignatureFrom(alice.publicKey());
      } catch (e) {
        expect((e as EnvelopeError).code).toBe("InvalidSignatureType");
      }
      const inner = Envelope.from("Secret").addAssertion(
        SIGNED,
        Envelope.from("not a signature").addAssertion(NOTE, "n").wrap(),
      );
      try {
        inner.hasSignatureFrom(alice.publicKey());
      } catch (e) {
        expect((e as EnvelopeError).code).toBe("InvalidInnerSignatureType");
      }
    });
  });

  describe("Signer failures", () => {
    it("an SSH key signed without its options is Components with components' message", () => {
      // The reference's `sign_with_options(...).unwrap()` panics there.
      const key = PrivateKeyBase.from(new Uint8Array(32)).sshSigningPrivateKey(
        { kind: "ed25519" },
        "alice@example.com",
      );
      let error: unknown;
      try {
        Envelope.from("Secret").addSignature(key);
      } catch (e) {
        error = e;
      }
      expect(EnvelopeError.isEnvelopeError(error)).toBe(true);
      if (EnvelopeError.isEnvelopeError(error)) {
        expect(error.code).toBe("Components");
        expect(error.message).toBe(
          "components error: invalid data: Missing namespace and hash algorithm for SSH signing",
        );
        expect(error.cause?.name).toBe("ComponentsError");
      }
    });
  });
});
