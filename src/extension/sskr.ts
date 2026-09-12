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
import { Secret, type Spec } from "@blockchaincommons/sskr";
import type { RngOptions } from "@blockchaincommons/rand";
import { SSKR_SHARE } from "@blockchaincommons/known-values";

import { type Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { SymmetricKey } from "@blockchaincommons/components";

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
  { rng }: RngOptions = {},
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

      // Every share object must decode (the reference's `?`); obscured ones are `InvalidFormat`.
      const share = obj.expectSubject((cbor) => SskrShare.fromCbor(cbor));
      const existing = result.get(share.identifier);
      if (existing !== undefined) {
        existing.push(share);
      } else {
        result.set(share.identifier, [share]);
      }
    }
  }

  return result;
};

/**
 * Recovers the envelope from a quorum of `sskrSplit` shares; `InvalidShares` / `Sskr` otherwise.
 *
 * @throws EnvelopeError with code `InvalidShares`.
 */
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
