/**
 * Envelope sealing and unsealing: signing and public-key encryption in one
 * step (the reference's `seal` and `unseal`).
 *
 * `seal` is `sign(sender)` then `encryptToRecipient(recipient)`: the
 * envelope is wrapped and signed, then wrapped again and encrypted to the
 * recipient, so the sealed envelope is `Wrapped(Encrypted)` over the signed
 * envelope. Only the recipient can decrypt it, the signature names the
 * sender and covers the whole content.
 *
 * `unseal` is `decryptToRecipient(recipient)` then `verify(sender)`: each
 * step decrypts or verifies and unwraps one layer, undoing the two wraps
 * `seal` added.
 */

import { type Envelope } from "./base/envelope";
import type { Signer, Verifier } from "@blockchaincommons/components";
import type { Encrypter, Decrypter } from "@blockchaincommons/components";
import {
  decryptToRecipient,
  encryptSubjectToRecipient,
  type RecipientOptions,
} from "./extension/recipient.js";
import { sign, type SignOptions, verify } from "./extension/signature.js";

/**
 * Wraps the envelope and encrypts the wrapper's subject to `recipient`
 * (the reference's `encrypt_to_recipient`); `options` are those of
 * `encryptSubjectToRecipient`.
 */
export function encryptToRecipient(
  envelope: Envelope,
  recipient: Encrypter,
  options: RecipientOptions = {},
): Envelope {
  return encryptSubjectToRecipient(envelope.wrap(), recipient, options);
}

/**
 * Options for `seal`: the signing options (`signing`, `metadata`) and the
 * recipient options (`rng` for the content key, the subject's nonce and the
 * ephemeral key; `nonce` for the sealed message).
 */
export type SealOptions = SignOptions & RecipientOptions;

/**
 * `sign(sender)` wraps the envelope before signing, so the seal pipeline is
 * `wrap → addSignature → wrap → encryptToRecipient`: the reference's
 * `seal`, `self.sign(sender).encrypt_to_recipient(recipient)`.
 */
export function seal(
  envelope: Envelope,
  sender: Signer,
  recipient: Encrypter,
  { signing, metadata, nonce, rng }: SealOptions = {},
): Envelope {
  const signOptions: SignOptions = {};
  if (signing !== undefined) signOptions.signing = signing;
  if (metadata !== undefined) signOptions.metadata = metadata;
  return encryptToRecipient(sign(envelope, sender, signOptions), recipient, { nonce, rng });
}

/**
 * `decryptToRecipient(recipient)` then `verify(sender)`, the reference's
 * `unseal`: `verify` checks the signature and unwraps the layer `sign`
 * added, as `decryptToRecipient` unwrapped the one `encryptToRecipient` added.
 */
export function unseal(
  envelope: Envelope,
  senderPublicKey: Verifier,
  recipient: Decrypter,
): Envelope {
  return verify(decryptToRecipient(envelope, recipient), senderPublicKey);
}
