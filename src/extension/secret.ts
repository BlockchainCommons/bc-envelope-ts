// Secret-based envelope locking and unlocking.
//
// This module provides functionality for encrypting envelope subjects using
// password-based or key-based derivation methods, allowing envelopes to be
// locked with secrets and later unlocked.
//
// The implementation uses `EncryptedKey` from bc-components for key
// derivation and encryption.

import { EncryptedKey, KeyDerivationMethod } from "@blockchaincommons/components/kdf";
import { HAS_SECRET } from "@blockchaincommons/known-values";

import { type Envelope } from "../base/envelope";
import type { RngOptions } from "@blockchaincommons/rand";
import { EnvelopeError } from "../base/error";
import { SymmetricKey } from "@blockchaincommons/components";

/**
 * Encrypts the subject with a fresh content key and adds a `hasSecret`
 * assertion holding that key locked by `secret` via `method`.
 */
export function lockSubject(
  envelope: Envelope,
  method: KeyDerivationMethod,
  secret: Uint8Array,
  options: RngOptions = {},
): Envelope {
  if (!Object.values(KeyDerivationMethod).includes(method)) {
    throw EnvelopeError.invalidParameter("method", "a KeyDerivationMethod", method);
  }
  const contentKey = SymmetricKey.random(options);
  let encryptedKey: EncryptedKey;
  try {
    encryptedKey = EncryptedKey.lock(method, secret, contentKey);
  } catch (error) {
    throw EnvelopeError.components(
      "could not lock the content key",
      error instanceof Error ? error : undefined,
    );
  }
  const encrypted = envelope.encryptSubject(contentKey, options);
  return encrypted.addAssertion(HAS_SECRET, encryptedKey);
}

/**
 * Decrypts the subject with the content key that `secret` unlocks; `UnknownSecret` when none does.
 *
 * @throws EnvelopeError with code `UnknownSecret`.
 */
export function unlockSubject(envelope: Envelope, secret: Uint8Array): Envelope {
  // Find all hasSecret assertions
  const assertions = envelope.assertionsWithPredicate(HAS_SECRET);

  // Try each one until we find one that unlocks
  for (const assertion of assertions) {
    const obj = assertion.asObject();
    if (obj === undefined) continue;

    if (obj.isObscured()) continue;

    // A present key must decode (the reference's `?`); a key this secret does not open is skipped.
    const encryptedKey = obj.expectSubject((cbor) => EncryptedKey.fromCbor(cbor));
    let contentKey: SymmetricKey;
    try {
      contentKey = encryptedKey.unlock(secret);
    } catch {
      continue;
    }
    return envelope.decryptSubject(contentKey);
  }

  // No matching secret found
  throw EnvelopeError.unknownSecret();
}

/** `true` when some `hasSecret` assertion was locked by a password method. */
export function isLockedWithPassword(envelope: Envelope): boolean {
  const assertions = envelope.assertionsWithPredicate(HAS_SECRET);

  for (const assertion of assertions) {
    const obj = assertion.asObject();
    if (obj === undefined) continue;

    try {
      const encryptedKey = obj.expectSubject((cbor) => EncryptedKey.fromCbor(cbor));
      if (encryptedKey.isPasswordBased()) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

/** `true` when some `hasSecret` assertion was locked by the SSH-agent method. */
export function isLockedWithSshAgent(envelope: Envelope): boolean {
  const assertions = envelope.assertionsWithPredicate(HAS_SECRET);

  for (const assertion of assertions) {
    const obj = assertion.asObject();
    if (obj === undefined) continue;

    try {
      const encryptedKey = obj.expectSubject((cbor) => EncryptedKey.fromCbor(cbor));
      if (encryptedKey.isSshAgent()) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

/** Adds a `hasSecret` assertion holding `contentKey` locked by `secret` via `method`. */
export function addSecret(
  envelope: Envelope,
  method: KeyDerivationMethod,
  secret: Uint8Array,
  contentKey: SymmetricKey,
): Envelope {
  // Lock the content key using the specified derivation method
  const encryptedKey = EncryptedKey.lock(method, secret, contentKey);

  // Add a hasSecret assertion with the EncryptedKey
  return envelope.addAssertion(HAS_SECRET, encryptedKey);
}

/** Wraps the envelope and locks the wrapper's subject (see `lockSubject`). */
export function lock(
  envelope: Envelope,
  method: KeyDerivationMethod,
  secret: Uint8Array,
  options: RngOptions = {},
): Envelope {
  return lockSubject(envelope.wrap(), method, secret, options);
}

/** Unlocks a subject locked with `lock` and unwraps it. */
export function unlock(envelope: Envelope, secret: Uint8Array): Envelope {
  return unlockSubject(envelope, secret).unwrap();
}
