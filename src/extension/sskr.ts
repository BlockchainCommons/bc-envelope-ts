/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 */

// SSKR-based envelope splitting and joining.
//
// This module provides functionality for splitting encrypted envelopes
// using SSKR (Sharded Secret Key Reconstruction), which is an implementation
// of Shamir's Secret Sharing. SSKR allows splitting a secret (the symmetric
// encryption key) into multiple shares, with a threshold required for
// reconstruction.
//
// SSKR provides social recovery for encrypted envelopes by allowing the owner
// to distribute shares to trusted individuals or storage locations, with a
// specified threshold required to reconstruct the original envelope.

import { SskrShare } from "@blockchaincommons/components/sskr";
import { Secret, Spec, GroupSpec } from "@blockchaincommons/sskr";
import type { RandomNumberGenerator } from "@blockchaincommons/rand";
import { SSKR_SHARE } from "@blockchaincommons/known-values";

import { type Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { SymmetricKey } from "@blockchaincommons/components";

// Re-export useful types
export { Spec, GroupSpec, SskrShare, Secret };

// ============================================================================
// Envelope Prototype Extensions for SSKR
// ============================================================================

/** Helper function to add an SSKR share assertion to the envelope */
const addSskrShare = (envelope: Envelope, share: SskrShare): Envelope => {
  return envelope.addAssertion(SSKR_SHARE, share);
};

/**
 * Splits `contentKey` into SSKR shares per `spec` and returns one copy of
 * the envelope per share, each carrying its share as an `sskrShare`
 * assertion, grouped as the spec groups them. `sskrJoin` recovers the
 * envelope from a quorum.
 */
export function sskrSplit(
  envelope: Envelope,
  spec: Spec,
  contentKey: SymmetricKey,
  { rng }: { rng?: RandomNumberGenerator } = {},
): Envelope[][] {
  const masterSecret = Secret.from(contentKey.bytes);
  const shareGroups: SskrShare[][] = SskrShare.generate(
    spec,
    masterSecret,
    rng === undefined ? {} : { rng },
  );

  // Create envelope copies with SSKR share assertions
  const result: Envelope[][] = [];
  for (const group of shareGroups) {
    const groupResult: Envelope[] = [];
    for (const share of group) {
      const shareEnvelope = addSskrShare(envelope, share);
      groupResult.push(shareEnvelope);
    }
    result.push(groupResult);
  }

  return result;
}

/** Helper function to extract SSKR shares from envelopes, grouped by identifier */
const extractSskrSharesGrouped = (envelopes: Envelope[]): Map<number, SskrShare[]> => {
  const result = new Map<number, SskrShare[]>();

  for (const envelope of envelopes) {
    const assertions = envelope.assertionsWithPredicate(SSKR_SHARE);

    for (const assertion of assertions) {
      const obj = assertion.asObject();
      if (obj === undefined) continue;

      // Skip obscured (elided/encrypted/compressed) assertions
      if (obj.isObscured()) continue;

      try {
        // Try to extract the SskrShare
        const share = obj.expectSubject((cbor) => SskrShare.fromCbor(cbor));
        const identifier = share.identifier;

        const existing = result.get(identifier);
        if (existing !== undefined) {
          existing.push(share);
        } else {
          result.set(identifier, [share]);
        }
      } catch {
        // This assertion didn't contain a valid SSKR share, skip it
        continue;
      }
    }
  }

  return result;
};

export function sskrJoin(envelopes: Envelope[]): Envelope {
  if (envelopes.length === 0) {
    throw EnvelopeError.invalidShares();
  }

  // Extract and group shares by identifier
  const groupedShares = extractSskrSharesGrouped(envelopes);

  // Try each group of shares (shares with same identifier)
  for (const shares of groupedShares.values()) {
    try {
      // Try to combine the shares
      const secret: Secret = SskrShare.combine(shares);

      // Convert secret back to symmetric key (local SymmetricKey uses `from`)
      const contentKey = SymmetricKey.from(secret.bytes);

      // Try to decrypt the envelope subject
      const decrypted = envelopes[0].decryptSubject(contentKey);

      // Return the decrypted subject
      return decrypted.subject();
    } catch {
      // This group of shares didn't work, try the next one
      continue;
    }
  }

  // No valid combination found
  throw EnvelopeError.invalidShares();
}

// ============================================================================
// Module Registration
// ============================================================================
