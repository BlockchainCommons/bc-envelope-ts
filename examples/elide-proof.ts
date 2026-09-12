/**
 * Elide most of a document, prove that a sentence is in it, and confirm the
 * proof against the original's digest — without revealing the rest.
 *
 *   bun examples/elide-proof.ts
 */
import { Envelope } from "@blockchaincommons/envelope";
import "@blockchaincommons/envelope/all";

const doc = Envelope.from("Alice")
  .addAssertion("knows", "Bob")
  .addAssertion("knows", "Carol")
  .addAssertion("age", 30);

// The holder reveals only that Alice knows Bob.
const knowsBob = Envelope.assertion("knows", "Bob");
const redacted = doc.elide({ revealing: [doc, Envelope.from("Alice"), knowsBob] });
console.log(redacted.format());

// A proof for the same target, then a verifier checks it against the root digest.
const proof = doc.proofContainsTarget(knowsBob);
const confirmed = proof !== undefined && redacted.confirmContainsTarget(knowsBob, proof);
console.log();
console.log("proof confirms 'knows Bob':", confirmed);
console.log("redacted digest equals original:", redacted.digest().equals(doc.digest()));
