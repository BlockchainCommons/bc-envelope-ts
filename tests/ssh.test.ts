/**
 * SSH signatures over an envelope: the port of the reference's
 * `tests/ssh_tests.rs` (`test_ssh_signed_plaintext`), with the reference's
 * deterministic seeds. Alice signs "Hello." with an SSH Ed25519 key in
 * namespace "test"; Bob verifies it, Carol's key does not, a threshold of
 * one over {Alice, Carol} verifies, a threshold of two does not.
 */
import { describe, it, expect } from "vitest";
import { expectText, decodeCbor } from "@blockchaincommons/dcbor";
import { PrivateKeyBase } from "@blockchaincommons/components";
import { UR, decodeURWith } from "@blockchaincommons/uniform-resources";
import { Envelope, EnvelopeError } from "../src/index.js";
import "../src/all.js";

const seed = (hex: string): Uint8Array => Uint8Array.from(Buffer.from(hex, "hex"));
/** `alice_seed()` / `carol_seed()` from the reference's `tests/common/test_data.rs`. */
const ALICE = PrivateKeyBase.from(seed("82f32c855d3d542256180810797e0073"));
const CAROL = PrivateKeyBase.from(seed("8574afab18e229651c1be8f76ffee523"));
const SSH_ED25519 = { kind: "ed25519" } as const;

describe("SSH signatures (ssh_tests.rs)", () => {
  it("test_ssh_signed_plaintext", () => {
    const aliceKey = ALICE.sshSigningPrivateKey(SSH_ED25519, "alice@example.com");
    const alicePub = aliceKey.publicKey();
    // `add_signature_opt`: the signature assertion goes on the envelope itself (no wrap).
    const envelope = Envelope.from("Hello.").addSignature(aliceKey, {
      signing: { type: "Ssh", namespace: "test", hashAlg: "sha256" },
    });
    expect(envelope.format()).toBe(`"Hello." [\n    'signed': Signature(SshEd25519)\n]`);

    // Bob receives the message, verifies Alice's signature and reads it.
    const received = decodeURWith(UR.parse(envelope.toUR().toString()), Envelope.codec);
    expect(received.isIdenticalTo(Envelope.fromBytes(received.toCbor().toData()))).toBe(true);
    const plaintext = received.verifySignatureFrom(alicePub).expectSubject(expectText);
    expect(plaintext).toBe("Hello.");

    // Not signed by Carol.
    const carolPub = CAROL.sshSigningPrivateKey(SSH_ED25519, "carol@example.com").publicKey();
    expect(() => received.verifySignatureFrom(carolPub)).toThrow(EnvelopeError);

    // Signed by Alice OR Carol; not by Alice AND Carol.
    expect(() => received.verifySignaturesFromThreshold([alicePub, carolPub], 1)).not.toThrow();
    expect(() => received.verifySignaturesFromThreshold([alicePub, carolPub], 2)).toThrow(
      EnvelopeError,
    );
  });

  it("the SSH signature is an sshsig the reference's key format round-trips", () => {
    const aliceKey = ALICE.sshSigningPrivateKey(SSH_ED25519, "alice@example.com");
    const signed = Envelope.from("Hello.").addSignature(aliceKey, {
      signing: { type: "Ssh", namespace: "test", hashAlg: "sha256" },
    });
    expect(signed.signatures()).toHaveLength(1);
    expect(signed.format()).toContain("Signature(SshEd25519)");
    const back = Envelope.fromCbor(decodeCbor(signed.toCbor().toData()));
    expect(back.hasSignatureFrom(aliceKey.publicKey())).toBe(true);
  });
});
