/**
 * Public key encryption extension for Gordian Envelope.
 *
 * This module implements public key encryption for Gordian Envelope, allowing
 * encrypted content to be selectively shared with one or more recipients. Each
 * recipient needs their own public/private key pair, and only recipients with
 * the corresponding private key can decrypt the envelope's content.
 *
 * The recipient extension builds on the basic envelope encryption capabilities
 * by adding:
 *
 * - **Multiple Recipients** - A single envelope can be encrypted to multiple
 *   recipients
 * - **Content Key Distribution** - Uses public key cryptography to securely
 *   distribute the symmetric key that encrypts the actual content
 * - **Privacy** - Recipients can decrypt the envelope independently without
 *   revealing their identity or access to other recipients
 *
 * ## How It Works
 *
 * The envelope's subject is encrypted using a random symmetric key (the
 * "content key"), and then this content key is encrypted to each recipient's
 * public key using a `SealedMessage`. Each encrypted content key is attached
 * to the envelope with a `hasRecipient` assertion.
 *
 * When recipients want to decrypt the envelope, they use their private key to
 * decrypt the content key from the appropriate `SealedMessage`, and then use
 * that content key to decrypt the envelope's subject.
 */

import { type Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { SymmetricKey } from "@blockchaincommons/components";
import {
  type Encrypter,
  type Decrypter,
  type Nonce,
  SealedMessage,
  isEncrypter,
} from "@blockchaincommons/components";
import { HAS_RECIPIENT } from "@blockchaincommons/known-values";
import { decodeCbor, encodeCbor } from "@blockchaincommons/dcbor";
import type { RngOptions, RandomNumberGenerator } from "@blockchaincommons/rand";

/** Options for `addRecipient` and the `encrypt*ToRecipient*` functions. */
export interface RecipientOptions extends RngOptions {
  /** Use exactly this nonce for the sealed content key; tests and vectors only. */
  nonce?: Nonce | undefined;
}

// ============================================================================
// Envelope Extension Methods
// ============================================================================

/**
 * Adds a recipient assertion to this envelope.
 *
 * This method adds a `hasRecipient` assertion containing a `SealedMessage`
 * that holds the content key encrypted to the recipient's public key.
 *
 * @param recipient - The recipient's public key (implements Encrypter)
 * @param contentKey - The symmetric key used to encrypt the envelope's subject
 * @param options - A fixed `nonce` or an `rng` for the ephemeral key and nonce
 * @returns A new envelope with the recipient assertion added
 */
export function addRecipient(
  envelope: Envelope,
  recipient: Encrypter,
  contentKey: SymmetricKey,
  options: RecipientOptions = {},
): Envelope {
  // The plaintext is the key's tagged CBOR (37 bytes), as the reference seals it;
  // components' option type does not admit an explicit `undefined` member.
  const opts: { nonce?: Nonce; rng?: RandomNumberGenerator } = {};
  if (options.nonce !== undefined) opts.nonce = options.nonce;
  if (options.rng !== undefined) opts.rng = options.rng;
  const sealedMessage = SealedMessage.seal(
    encodeCbor(contentKey.toCbor()),
    recipient.encapsulationPublicKey(),
    opts,
  );
  return envelope.addAssertion(HAS_RECIPIENT, sealedMessage);
}

/**
 * Encrypts the envelope's subject and adds a recipient assertion.
 *
 * This is a convenience method that:
 * 1. Generates a random content key
 * 2. Encrypts the subject with the content key
 * 3. Adds a recipient assertion with the sealed content key
 *
 * @param recipient - The recipient's public key (implements Encrypter)
 * @returns A new envelope with encrypted subject and recipient assertion
 *
 * @throws EnvelopeError with code `General`.
 */
export function encryptSubjectToRecipient(
  envelope: Envelope,
  recipient: Encrypter,
  options: RngOptions = {},
): Envelope {
  if (!isEncrypter(recipient)) {
    throw EnvelopeError.invalidParameter("recipient", "an Encrypter", recipient);
  }

  const contentKey = SymmetricKey.random(options);
  const encrypted = envelope.encryptSubject(contentKey, options);
  return addRecipient(encrypted, recipient, contentKey, options);
}

/**
 * Encrypts the envelope's subject and adds recipient assertions for multiple recipients.
 *
 * @param recipients - Array of recipient public keys (each implements Encrypter)
 * @returns A new envelope with encrypted subject and recipient assertions
 *
 * @throws EnvelopeError with code `General`.
 */
export function encryptSubjectToRecipients(
  envelope: Envelope,
  recipients: Encrypter[],
  options: RngOptions = {},
): Envelope {
  const contentKey = SymmetricKey.random(options);
  let result = envelope.encryptSubject(contentKey, options);

  // Add each recipient
  for (const recipient of recipients) {
    if (!isEncrypter(recipient)) {
      throw EnvelopeError.invalidParameter("recipients", "Encrypters", recipient);
    }
    result = addRecipient(result, recipient, contentKey, options);
  }

  return result;
}

/**
 * Returns all SealedMessages from the envelope's `hasRecipient` assertions.
 *
 * @returns Array of SealedMessage objects
 *
 * @throws EnvelopeError with code `General`.
 */
export function recipients(envelope: Envelope): SealedMessage[] {
  // Obscured objects are skipped, as the reference does; a present one must decode.
  return envelope
    .assertionsWithPredicate(HAS_RECIPIENT)
    .map((assertion) => assertion.asObject())
    .filter((obj): obj is Envelope => obj !== undefined && !obj.isObscured())
    .map((obj) => obj.expectSubject((cbor) => SealedMessage.fromCbor(cbor)));
}

/**
 * Decrypts the envelope's subject using the recipient's private key.
 *
 * This method:
 * 1. Finds all `hasRecipient` assertions
 * 2. Tries to decrypt each sealed message until one succeeds
 * 3. Uses the recovered content key to decrypt the subject
 *
 * @param recipient - The recipient's private key (implements Decrypter)
 * @returns A new envelope with decrypted subject
 *
 * @throws EnvelopeError with code `General`.
 */
export function decryptSubjectToRecipient(envelope: Envelope, recipient: Decrypter): Envelope {
  // The reference's order: find the first sealed message this key opens, then decrypt.
  let contentKeyData: Uint8Array | undefined;
  for (const sealedMessage of recipients(envelope)) {
    try {
      contentKeyData = sealedMessage.decrypt(recipient.encapsulationPrivateKey());
      break;
    } catch {
      continue;
    }
  }
  if (contentKeyData === undefined) {
    throw EnvelopeError.unknownRecipient();
  }

  // The sealed plaintext is the key's tagged CBOR.
  let contentKey: SymmetricKey;
  try {
    contentKey = SymmetricKey.fromCbor(decodeCbor(contentKeyData));
  } catch (error) {
    throw EnvelopeError.cbor("invalid content key", error instanceof Error ? error : undefined);
  }
  return envelope.decryptSubject(contentKey);
}

/**
 * Decrypts an envelope that was encrypted to a recipient and unwraps it.
 *
 * This is a convenience method that:
 * 1. Decrypts the subject using the recipient's private key
 * 2. Unwraps the resulting envelope
 *
 * @param recipient - The recipient's private key (implements Decrypter)
 * @returns The unwrapped, decrypted envelope
 */
export function decryptToRecipient(envelope: Envelope, recipient: Decrypter): Envelope {
  const decrypted = decryptSubjectToRecipient(envelope, recipient);
  return decrypted.unwrap();
}

/**
 * Wraps and encrypts an envelope to multiple recipients.
 *
 * @param recipients - Array of recipient public keys (each implements Encrypter)
 * @returns A wrapped and encrypted envelope
 */
export function encryptToRecipients(
  envelope: Envelope,
  recipients: Encrypter[],
  options: RngOptions = {},
): Envelope {
  return encryptSubjectToRecipients(envelope.wrap(), recipients, options);
}

// Import side-effect to register prototype extensions
