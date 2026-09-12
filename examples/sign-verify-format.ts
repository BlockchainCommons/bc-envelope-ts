/**
 * Build an envelope, sign it, verify the signature and print every format.
 *
 *   bun examples/sign-verify-format.ts
 */
import { PrivateKeyBase } from "@blockchaincommons/components";
import { Envelope } from "@blockchaincommons/envelope";
import "@blockchaincommons/envelope/all";

const alice = PrivateKeyBase.from(Uint8Array.from(Buffer.from("82f32c855d3d542256180810797e0073", "hex")));
const signingKey = alice.ed25519SigningPrivateKey();

// `sign` wraps the envelope and signs the wrapper, so the assertions are covered too.
const doc = Envelope.from("Alice")
  .addAssertion("knows", "Bob")
  .addAssertion("knows", "Carol")
  .sign(signingKey);

console.log(doc.format());
console.log();
console.log(doc.treeFormat());
console.log();
console.log(doc.toUR().toString());

const verified = doc.verifySignatureFrom(signingKey.publicKey()).unwrap();
console.log();
console.log("verified subject:", verified.subject().expectString());
