/** `/seal`: sign-then-encrypt to a recipient, and the reverse. */
import { describe, it, expect } from "vitest";
import { Nonce, PrivateKeyBase, PrivateKeys } from "@blockchaincommons/components";
import { SeededRng, TEST_SEED } from "@blockchaincommons/rand";
import { Envelope, EnvelopeError, seal, unseal, SignatureMetadata } from "../src/all.js";
import { NOTE } from "@blockchaincommons/known-values";

const rng = SeededRng.forTesting();
const alice = PrivateKeys.random({ rng });
const bob = PrivateKeys.random({ rng });
const mallory = PrivateKeys.random({ rng });
const message = Envelope.from("Hello, Bob.").addAssertion("from", "Alice");

describe("seal / unseal", () => {
  it("round-trips between the sender and the recipient", () => {
    const sealed = seal(message, alice, bob.publicKeys());
    expect(sealed.isSubjectEncrypted()).toBe(true);
    expect(sealed.format()).toContain("'hasRecipient'");
    const opened = unseal(sealed, alice.publicKeys(), bob);
    expect(opened.digest().equals(message.digest())).toBe(true);
    expect(message.seal(alice, bob.publicKeys()).unseal(alice.publicKeys(), bob).format()).toBe(
      message.format(),
    );
  });

  it("threads signing options through", () => {
    const md = SignatureMetadata.from([[NOTE, "sealed by Alice"]]);
    const sealed = seal(message, alice, bob.publicKeys(), { metadata: md });
    const opened = unseal(sealed, alice.publicKeys(), bob);
    expect(opened.digest().equals(message.digest())).toBe(true);
  });

  it("is byte-deterministic under a fixed nonce and rng with a deterministic signer", () => {
    // Ed25519 signs deterministically; `rng` draws the content key, the
    // subject's nonce and the ephemeral key; `nonce` pins the sealed message's.
    const ed25519 = PrivateKeyBase.from(
      Uint8Array.from({ length: 32 }, (_, i) => i + 1),
    ).ed25519SigningPrivateKey();
    const nonce = Nonce.from(Uint8Array.from({ length: 12 }, (_, i) => i));
    const once = (): Envelope =>
      seal(message, ed25519, bob.publicKeys(), { nonce, rng: new SeededRng(TEST_SEED) });
    const a = once();
    const b = once();
    expect(Buffer.from(a.toCbor().toData()).toString("hex")).toBe(
      Buffer.from(b.toCbor().toData()).toString("hex"),
    );
    expect(a.recipients()[0].message.nonce.equals(nonce)).toBe(true);
    expect(unseal(a, ed25519.publicKey(), bob).digest().equals(message.digest())).toBe(true);
    // Without the options every seal is fresh.
    expect(seal(message, ed25519, bob.publicKeys()).isIdenticalTo(a)).toBe(false);
  });

  it("refuses the wrong recipient and the wrong sender", () => {
    const sealed = seal(message, alice, bob.publicKeys());
    expect(() => unseal(sealed, alice.publicKeys(), mallory)).toThrow(EnvelopeError);
    expect(() => unseal(sealed, mallory.publicKeys(), bob)).toThrow(EnvelopeError);
    try {
      unseal(sealed, mallory.publicKeys(), bob);
    } catch (e) {
      expect((e as EnvelopeError).code).toBe("UnverifiedSignature");
    }
  });
});
