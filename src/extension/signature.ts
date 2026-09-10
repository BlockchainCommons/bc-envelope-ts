/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Signature Extension for Gordian Envelope
 *
 * Provides functionality for digitally signing Envelopes and verifying signatures,
 * with optional metadata support.
 *
 * The signature extension allows:
 * - Signing envelope subjects to validate their authenticity
 * - Adding metadata to signatures (e.g., signer identity, date, purpose)
 * - Verification of signatures, both with and without metadata
 * - Support for multiple signatures on a single envelope
 *
 * Ported from bc-envelope-rust/src/extension/signature/
 */

import { Envelope } from "../base/envelope";
import type { EnvelopeEncodableValue } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
import {
  SIGNED as SIGNED_KV,
  NOTE as NOTE_KV,
  type KnownValue,
} from "@blockchaincommons/known-values";
import {
  Signature,
  type Signer,
  type Verifier,
  type SigningOptions,
} from "@blockchaincommons/components";

/**
 * Re-export signing types from @blockchaincommons/components for type compatibility.
 */
export {
  Signature,
  SigningPrivateKey,
  SigningPublicKey,
  type Signer,
  type Verifier,
  type SigningOptions,
} from "@blockchaincommons/components";

/**
 * Known value for the 'signed' predicate.
 * This is the standard predicate used for signature assertions.
 */
export const SIGNED: KnownValue = SIGNED_KV;

/**
 * Known value for the 'note' predicate.
 * Used for adding notes/comments to signatures.
 */
export const NOTE: KnownValue = NOTE_KV;

/**
 * Metadata associated with a signature in a Gordian Envelope.
 *
 * `SignatureMetadata` provides a way to attach additional information to
 * signatures, such as the signer's identity, the signing date, or the purpose
 * of the signature. When used with the signature extension, this metadata is
 * included in a structured way that is also signed, ensuring the metadata
 * cannot be tampered with without invalidating the signature.
 *
 * Ported from bc-envelope-rust/src/extension/signature/signature_metadata.rs
 */
export class SignatureMetadata {
  private readonly _assertions: [EnvelopeEncodableValue, unknown][] = [];

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  /**
   * Creates a new empty SignatureMetadata.
   */
  static new(): SignatureMetadata {
    return new SignatureMetadata();
  }

  /**
   * Adds an assertion to the metadata.
   *
   * @param predicate - The predicate for the assertion (accepts KnownValue, string, etc.)
   * @param object - The object for the assertion
   * @returns A new SignatureMetadata with the assertion added
   */
  withAssertion(predicate: EnvelopeEncodableValue, object: unknown): SignatureMetadata {
    const metadata = new SignatureMetadata();
    metadata._assertions.push(...this._assertions);
    metadata._assertions.push([predicate, object]);
    return metadata;
  }

  /**
   * Returns all assertions in this metadata.
   */
  assertions(): readonly [EnvelopeEncodableValue, unknown][] {
    return this._assertions;
  }

  /**
   * Returns whether this metadata contains any assertions.
   */
  hasAssertions(): boolean {
    return this._assertions.length > 0;
  }
}

// ============================================================================
// Note: Type declarations for signature methods are in ../base/envelope.ts
// to ensure they are included in bundled type definitions.
// ============================================================================

// ============================================================================
// Envelope Extension Methods for Signatures
// ============================================================================

/// Creates a signature for the envelope's subject and returns a new
/// envelope with a `'signed': Signature` assertion.
///
/// Matches Rust: add_signature_opt()
export function addSignatureOpt(
  envelope: Envelope,
  signer: Signer,
  options?: SigningOptions,
  metadata?: SignatureMetadata,
): Envelope {
  const digest = envelope.subject().digest();
  let signatureEnvelope = Envelope.new(signer.signWithOptions(digest.bytes, options));

  if (metadata?.hasAssertions() === true) {
    // Add metadata assertions to the signature envelope
    for (const [predicate, object] of metadata.assertions()) {
      signatureEnvelope = signatureEnvelope.addAssertion(
        predicate,
        object as EnvelopeEncodableValue,
      );
    }

    // Wrap the signature envelope (cryptographic binding)
    signatureEnvelope = signatureEnvelope.wrap();

    // Sign the wrapped structure with the same key
    const outerSignature = Envelope.new(
      signer.signWithOptions(signatureEnvelope.digest().bytes, options),
    );

    // Add the outer signature assertion
    signatureEnvelope = signatureEnvelope.addAssertion(SIGNED, outerSignature);
  }

  return envelope.addAssertion(SIGNED, signatureEnvelope);
}

/// Creates a signature without options or metadata.
///
/// Matches Rust: add_signature()
export function addSignature(envelope: Envelope, signer: Signer): Envelope {
  return addSignatureOpt(envelope, signer, undefined, undefined);
}

/// Creates a signature with optional metadata but no options.
///
/// Convenience method matching the common use case.
export function addSignatureWithMetadata(
  envelope: Envelope,
  signer: Signer,
  metadata?: SignatureMetadata,
): Envelope {
  return addSignatureOpt(envelope, signer, undefined, metadata);
}

/// Creates several signatures for the envelope's subject.
///
/// Matches Rust: add_signatures()
export function addSignatures(envelope: Envelope, signers: Signer[]): Envelope {
  return signers.reduce<Envelope>((envelope, signer) => addSignature(envelope, signer), envelope);
}

/// Creates several signatures with individual options and metadata.
///
/// Matches Rust: add_signatures_opt()
export function addSignaturesOpt(
  envelope: Envelope,
  signersWithOptions: { signer: Signer; options?: SigningOptions; metadata?: SignatureMetadata }[],
): Envelope {
  return signersWithOptions.reduce<Envelope>(
    (envelope, { signer, options, metadata }) =>
      addSignatureOpt(envelope, signer, options, metadata),
    envelope,
  );
}

/// Creates several signatures with metadata (no options).
export function addSignaturesWithMetadata(
  envelope: Envelope,
  signersWithMetadata: { signer: Signer; metadata?: SignatureMetadata }[],
): Envelope {
  return signersWithMetadata.reduce<Envelope>(
    (envelope, { signer, metadata }) => addSignatureWithMetadata(envelope, signer, metadata),
    envelope,
  );
}

/// Convenience constructor for a `'signed': Signature` assertion envelope.
///
/// Matches Rust: make_signed_assertion()
export function makeSignedAssertion(
  _envelope: Envelope,
  signature: Signature,
  note?: string,
): Envelope {
  let assertion = Envelope.newAssertion(SIGNED, signature);
  if (note !== undefined) {
    assertion = assertion.addAssertion(NOTE, note);
  }
  return assertion;
}

/// Returns whether the given signature is valid.
///
/// Matches Rust: is_verified_signature()
export function isVerifiedSignature(
  envelope: Envelope,
  signature: Signature,
  verifier: Verifier,
): boolean {
  return verifier.verify(signature, envelope.subject().digest().bytes);
}

/// Checks whether the given signature is valid for the given public key.
///
/// Matches Rust: verify_signature()
export function verifySignature(
  envelope: Envelope,
  signature: Signature,
  verifier: Verifier,
): Envelope {
  if (!verifier.verify(signature, envelope.subject().digest().bytes)) {
    throw EnvelopeError.unverifiedSignature();
  }
  return envelope;
}

// ============================================================================
// Internal: Core signature verification with metadata support
// ============================================================================

/// Returns the signature metadata envelope if the given verifier has signed
/// this envelope, or undefined if no matching signature is found.
///
/// Handles both simple signatures and wrapped (double-signed) signatures
/// with metadata.
///
/// Matches Rust: has_some_signature_from_key_returning_metadata()
export function hasSignatureFromReturningMetadata(
  envelope: Envelope,
  verifier: Verifier,
): Envelope | undefined {
  // Valid signature objects are either:
  // - `Signature` objects, or
  // - `Signature` objects with additional metadata assertions, wrapped
  //   and then signed by the same key.
  const signatureObjects = envelope.objectsForPredicate(SIGNED);

  for (const signatureObject of signatureObjects) {
    const signatureObjectSubject = signatureObject.subject();

    if (signatureObjectSubject.isWrapped()) {
      // Wrapped case: signature with metadata
      // The structure is:
      //   {Signature ['note': "..."]} ['signed': OuterSignature]

      // Step 1: Verify outer signature if present
      let outerSigFound = false;
      try {
        const outerSignatureObject = signatureObject.objectForPredicate(SIGNED);
        outerSigFound = true;
        const outerSignature = outerSignatureObject.extractSubject((cbor) =>
          Signature.fromCbor(cbor),
        );
        if (!verifier.verify(outerSignature, signatureObjectSubject.digest().bytes)) {
          continue; // Outer signature doesn't match key, try next
        }
      } catch (_e) {
        if (outerSigFound) {
          // Found 'signed' assertion but couldn't extract Signature
          throw EnvelopeError.invalidOuterSignatureType();
        }
        // No 'signed' assertion on the signature object — skip outer check
        // (object_for_predicate failed with NONEXISTENT_PREDICATE)
      }

      // Step 2: Unwrap and verify inner signature
      const signatureMetadataEnvelope = signatureObjectSubject.tryUnwrap();
      try {
        const innerSignature = signatureMetadataEnvelope.extractSubject((cbor) =>
          Signature.fromCbor(cbor),
        );
        if (!verifier.verify(innerSignature, envelope.subject().digest().bytes)) {
          throw EnvelopeError.unverifiedInnerSignature();
        }
        return signatureMetadataEnvelope;
      } catch (e) {
        if (e instanceof EnvelopeError) throw e;
        throw EnvelopeError.invalidInnerSignatureType();
      }
    } else {
      // Simple case: no metadata
      try {
        const signature = signatureObject.extractSubject((cbor) => Signature.fromCbor(cbor));
        if (verifier.verify(signature, envelope.subject().digest().bytes)) {
          return signatureObject;
        }
      } catch {
        throw EnvelopeError.invalidSignatureType();
      }
    }
  }

  return undefined;
}

/// Returns whether the envelope's subject has a valid signature from the
/// given public key.
///
/// Matches Rust: has_signature_from()
export function hasSignatureFrom(envelope: Envelope, verifier: Verifier): boolean {
  return hasSignatureFromReturningMetadata(envelope, verifier) !== undefined;
}

/// Returns whether the envelope's subject has a valid signature from all
/// the given public keys.
///
/// Matches Rust: has_signatures_from()
export function hasSignaturesFrom(envelope: Envelope, verifiers: Verifier[]): boolean {
  return verifiers.every((verifier) => hasSignatureFrom(envelope, verifier));
}

/// Returns whether the envelope's subject has some threshold of signatures.
///
/// Matches Rust: has_signatures_from_threshold()
export function hasSignaturesFromThreshold(
  envelope: Envelope,
  verifiers: Verifier[],
  threshold?: number,
): boolean {
  const t = threshold ?? verifiers.length;
  let count = 0;
  for (const verifier of verifiers) {
    if (hasSignatureFrom(envelope, verifier)) {
      count++;
      if (count >= t) {
        return true;
      }
    }
  }
  return false;
}

/// Checks whether the envelope's subject has a valid signature from the
/// given public key.
///
/// Matches Rust: verify_signature_from()
export function verifySignatureFrom(envelope: Envelope, verifier: Verifier): Envelope {
  if (!hasSignatureFrom(envelope, verifier)) {
    throw EnvelopeError.unverifiedSignature();
  }
  return envelope;
}

/// Verifies signature and returns the metadata envelope.
///
/// Matches Rust: verify_signature_from_returning_metadata()
export function verifySignatureFromReturningMetadata(
  envelope: Envelope,
  verifier: Verifier,
): Envelope {
  const metadata = hasSignatureFromReturningMetadata(envelope, verifier);
  if (metadata === undefined) {
    throw EnvelopeError.unverifiedSignature();
  }
  return metadata;
}

/// Checks whether the envelope's subject has a set of signatures.
///
/// Matches Rust: verify_signatures_from()
export function verifySignaturesFrom(envelope: Envelope, verifiers: Verifier[]): Envelope {
  if (!hasSignaturesFrom(envelope, verifiers)) {
    throw EnvelopeError.unverifiedSignature();
  }
  return envelope;
}

/// Checks whether the envelope's subject has some threshold of signatures.
///
/// Matches Rust: verify_signatures_from_threshold()
export function verifySignaturesFromThreshold(
  envelope: Envelope,
  verifiers: Verifier[],
  threshold?: number,
): Envelope {
  const t = threshold ?? verifiers.length;
  if (!hasSignaturesFromThreshold(envelope, verifiers, t)) {
    throw EnvelopeError.unverifiedSignature();
  }
  return envelope;
}

/// Returns all signature assertion objects.
///
/// Matches Rust: objects_for_predicate(SIGNED) via signatures()
export function signatures(envelope: Envelope): Envelope[] {
  return envelope.objectsForPredicate(SIGNED);
}

// ============================================================================
// Convenience methods for signing and verifying entire envelopes.
//
// These wrap the envelope before signing, ensuring all assertions are
// included in the signature.
// ============================================================================

/// Signs the entire envelope by wrapping it first.
///
/// Matches Rust: sign()
export function sign(envelope: Envelope, signer: Signer): Envelope {
  return signOpt(envelope, signer, undefined);
}

/// Signs the entire envelope with options but no metadata.
///
/// Matches Rust: sign_opt()
export function signOpt(envelope: Envelope, signer: Signer, options?: SigningOptions): Envelope {
  return addSignatureOpt(envelope.wrap(), signer, options, undefined);
}

/// Signs the entire envelope with optional metadata.
export function signWithMetadata(
  envelope: Envelope,
  signer: Signer,
  metadata?: SignatureMetadata,
): Envelope {
  return addSignatureOpt(envelope.wrap(), signer, undefined, metadata);
}

/// Verifies that the envelope has a valid signature from the specified
/// verifier, and unwraps it.
///
/// Matches Rust: verify()
export function verify(envelope: Envelope, verifier: Verifier): Envelope {
  return verifySignatureFrom(envelope, verifier).tryUnwrap();
}

/// Verifies the envelope's signature and returns both the unwrapped
/// envelope and signature metadata.
///
/// Matches Rust: verify_returning_metadata()
export function verifyReturningMetadata(
  envelope: Envelope,
  verifier: Verifier,
): { envelope: Envelope; metadata: Envelope } {
  const metadata = verifySignatureFromReturningMetadata(envelope, verifier);
  return { envelope: envelope.tryUnwrap(), metadata };
}
