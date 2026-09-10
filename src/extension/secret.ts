/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Secret-based envelope locking and unlocking.
//
// This module provides functionality for encrypting envelope subjects using
// password-based or key-based derivation methods, allowing envelopes to be
// locked with secrets and later unlocked.
//
// The implementation uses `EncryptedKey` from bc-components for key
// derivation and encryption.

import { SymmetricKey as ComponentsSymmetricKey } from "@blockchaincommons/components";
import { EncryptedKey, type KeyDerivationMethod } from "@blockchaincommons/components/kdf";
import { HAS_SECRET } from "@blockchaincommons/known-values";

import { type Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { SymmetricKey } from "@blockchaincommons/components";

// ============================================================================
// Envelope Prototype Extensions for Secret Locking
// ============================================================================

export function lockSubject(
  envelope: Envelope,
  method: KeyDerivationMethod,
  secret: Uint8Array,
): Envelope {
  // Generate a new content key using local SymmetricKey
  const contentKey = SymmetricKey.random();

  // Convert to components SymmetricKey for EncryptedKey.lock
  const componentsKey = ComponentsSymmetricKey.from(contentKey.bytes);

  // Lock the content key using the specified derivation method
  const encryptedKey = EncryptedKey.lock(method, secret, componentsKey);

  // Encrypt the subject and add the hasSecret assertion
  const encrypted = envelope.encryptSubject(contentKey);
  return encrypted.addAssertion(HAS_SECRET, encryptedKey);
}

export function unlockSubject(envelope: Envelope, secret: Uint8Array): Envelope {
  // Find all hasSecret assertions
  const assertions = envelope.assertionsWithPredicate(HAS_SECRET);

  // Try each one until we find one that unlocks
  for (const assertion of assertions) {
    const obj = assertion.asObject();
    if (obj === undefined) continue;

    // Skip obscured (elided/encrypted/compressed) assertions
    if (obj.isObscured()) continue;

    try {
      // Try to extract the EncryptedKey
      const encryptedKey = obj.expectSubject((cbor) => EncryptedKey.fromCbor(cbor));

      // Try to unlock with the provided secret (returns ComponentsSymmetricKey)
      const componentsKey = encryptedKey.unlock(secret);

      // Convert to local SymmetricKey for decryptSubject
      const contentKey = SymmetricKey.from(componentsKey.bytes);

      // If successful, decrypt the subject
      return envelope.decryptSubject(contentKey);
    } catch {
      // This assertion didn't work, try the next one
      continue;
    }
  }

  // No matching secret found
  throw EnvelopeError.unknownSecret();
}

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

export function addSecret(
  envelope: Envelope,
  method: KeyDerivationMethod,
  secret: Uint8Array,
  contentKey: SymmetricKey,
): Envelope {
  // Convert to components SymmetricKey for EncryptedKey.lock
  const componentsKey = ComponentsSymmetricKey.from(contentKey.bytes);

  // Lock the content key using the specified derivation method
  const encryptedKey = EncryptedKey.lock(method, secret, componentsKey);

  // Add a hasSecret assertion with the EncryptedKey
  return envelope.addAssertion(HAS_SECRET, encryptedKey);
}

export function lock(
  envelope: Envelope,
  method: KeyDerivationMethod,
  secret: Uint8Array,
): Envelope {
  return lockSubject(envelope.wrap(), method, secret);
}

export function unlock(envelope: Envelope, secret: Uint8Array): Envelope {
  return unlockSubject(envelope, secret).unwrap();
}

// ============================================================================
// Module Registration
// ============================================================================
