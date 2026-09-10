/** `/seal`: sign-then-encrypt to a recipient, and the reverse. */
import { describe, it, expect } from "vitest";
import { PrivateKeys } from "@blockchaincommons/components";
import { SeededRng } from "@blockchaincommons/rand";
import { Envelope, EnvelopeError, seal, unseal, NOTE, SignatureMetadata } from "../src/all.js";

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
