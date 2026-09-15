/**
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
 */

import { Envelope } from "../base/envelope";
import type { EnvelopeInput } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
import { viaComponents } from "../base/foreign-errors.js";
import { SIGNED, NOTE } from "@blockchaincommons/known-values";
import {
  Signature,
  type Signer,
  type Verifier,
  type SigningOptions,
} from "@blockchaincommons/components";

/**
 * Metadata associated with a signature in a Gordian Envelope.
 *
 * `SignatureMetadata` provides a way to attach additional information to
 * signatures, such as the signer's identity, the signing date, or the purpose
 * of the signature. When used with the signature extension, this metadata is
 * included in a structured way that is also signed, ensuring the metadata
 * cannot be tampered with without invalidating the signature.
 *
 */
export class SignatureMetadata {
  private readonly _assertions: [EnvelopeInput, unknown][] = [];

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  /** Metadata with the given `[predicate, object]` assertions. */
  static from(assertions: readonly [EnvelopeInput, unknown][] = []): SignatureMetadata {
    const m = new SignatureMetadata();
    for (const [predicate, object] of assertions) m._assertions.push([predicate, object]);
    return m;
  }

  /**
   * Adds an assertion to the metadata.
   *
   * @param predicate - The predicate for the assertion (accepts KnownValue, string, etc.)
   * @param object - The object for the assertion
   * @returns A new SignatureMetadata with the assertion added
   */
  withAssertion(predicate: EnvelopeInput, object: unknown): SignatureMetadata {
    const metadata = new SignatureMetadata();
    metadata._assertions.push(...this._assertions);
    metadata._assertions.push([predicate, object]);
    return metadata;
  }

  /**
   * Returns all assertions in this metadata.
   */
  get assertions(): readonly [EnvelopeInput, unknown][] {
    // a copy: pushing into it must not change the next `sign`
    return this._assertions.slice();
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

/** Options for `sign` and `addSignature`. */
export interface SignOptions {
  /** Scheme-specific signing options (Schnorr `rng`, SSH namespace and hash). */
  signing?: SigningOptions;
  /** Assertions to bind to the signature (a signed, wrapped signature envelope). */
  metadata?: SignatureMetadata;
}

/**
 * Adds a `signed` assertion: a signature over the subject's digest, with
 * `metadata` bound to it when given.
 */
export function addSignature(
  envelope: Envelope,
  signer: Signer,
  { signing: options, metadata }: SignOptions = {},
): Envelope {
  const digest = envelope.subject().digest();
  // A components failure (an SSH key without signing options) is `Components`
  // with components' message, where the reference's `add_signature_opt` unwraps.
  const sign = (message: Uint8Array): Signature =>
    viaComponents(() => signer.signWithOptions(message, options));
  let signatureEnvelope = Envelope.from(sign(digest.bytes));

  if (metadata?.hasAssertions() === true) {
    // Add metadata assertions to the signature envelope
    for (const [predicate, object] of metadata.assertions) {
      signatureEnvelope = signatureEnvelope.addAssertion(predicate, object as EnvelopeInput);
    }

    // Wrap the signature envelope (cryptographic binding)
    signatureEnvelope = signatureEnvelope.wrap();

    // Sign the wrapped structure with the same key
    const outerSignature = Envelope.from(sign(signatureEnvelope.digest().bytes));

    // Add the outer signature assertion
    signatureEnvelope = signatureEnvelope.addAssertion(SIGNED, outerSignature);
  }

  return envelope.addAssertion(SIGNED, signatureEnvelope);
}

/** `addSignature` for each signer, each with its own options when given as `{ signer, ...options }`. */
export function addSignatures(
  envelope: Envelope,
  signers: readonly (Signer | ({ signer: Signer } & SignOptions))[],
): Envelope {
  return signers.reduce<Envelope>(
    (e, s) =>
      "signer" in s && !(s instanceof Object && "sign" in s)
        ? addSignature(e, s.signer, s)
        : addSignature(e, s as Signer),
    envelope,
  );
}

/** Convenience constructor for a `'signed': Signature` assertion envelope. */
export function makeSignedAssertion(
  _envelope: Envelope,
  signature: Signature,
  note?: string,
): Envelope {
  let assertion = Envelope.assertion(SIGNED, signature);
  if (note !== undefined) {
    assertion = assertion.addAssertion(NOTE, note);
  }
  return assertion;
}

/** Returns whether the given signature is valid. */
export function isVerifiedSignature(
  envelope: Envelope,
  signature: Signature,
  verifier: Verifier,
): boolean {
  return verifier.verify(signature, envelope.subject().digest().bytes);
}

/**
 * Checks whether the given signature is valid for the given public key.
 *
 * @throws EnvelopeError with code `UnverifiedSignature`.
 */
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

/**
 * Returns the signature metadata envelope if the given verifier has signed
 * this envelope, or undefined if no matching signature is found.
 *
 * Handles both simple signatures and wrapped (double-signed) signatures
 * with metadata.
 *
 * @throws EnvelopeError with code `InvalidOuterSignatureType`, `UnverifiedInnerSignature`, `InvalidInnerSignatureType`, `InvalidSignatureType`.
 */
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
      // A signature with metadata: `{Signature [metadata]} ['signed': OuterSignature]`.
      // Only the extractions map to the signature-type codes; a verifier's
      // own failure propagates, as the reference's `key.verify` is never
      // wrapped.
      let outerSignatureObject: Envelope | undefined;
      try {
        outerSignatureObject = signatureObject.objectForPredicate(SIGNED);
      } catch {
        // No single outer `signed` assertion: the outer check is skipped,
        // as the reference's `if let Ok(...)` does.
        outerSignatureObject = undefined;
      }
      if (outerSignatureObject !== undefined) {
        let outerSignature: Signature;
        try {
          outerSignature = outerSignatureObject.expectSubject((cbor) => Signature.fromCbor(cbor));
        } catch {
          throw EnvelopeError.invalidOuterSignatureType();
        }
        if (!verifier.verify(outerSignature, signatureObjectSubject.digest().bytes)) {
          continue; // The outer signature is not this key's: try the next object.
        }
      }

      const signatureMetadataEnvelope = signatureObjectSubject.unwrap();
      let innerSignature: Signature;
      try {
        innerSignature = signatureMetadataEnvelope.expectSubject((cbor) =>
          Signature.fromCbor(cbor),
        );
      } catch {
        throw EnvelopeError.invalidInnerSignatureType();
      }
      if (!verifier.verify(innerSignature, envelope.subject().digest().bytes)) {
        throw EnvelopeError.unverifiedInnerSignature();
      }
      return signatureMetadataEnvelope;
    }

    // A bare signature.
    let signature: Signature;
    try {
      signature = signatureObject.expectSubject((cbor) => Signature.fromCbor(cbor));
    } catch {
      throw EnvelopeError.invalidSignatureType();
    }
    if (verifier.verify(signature, envelope.subject().digest().bytes)) {
      return signatureObject;
    }
  }

  return undefined;
}

/**
 * Returns whether the envelope's subject has a valid signature from the
 * given public key.
 */
export function hasSignatureFrom(envelope: Envelope, verifier: Verifier): boolean {
  return hasSignatureFromReturningMetadata(envelope, verifier) !== undefined;
}

/**
 * Returns whether the envelope's subject has a valid signature from all
 * the given public keys.
 */
export function hasSignaturesFrom(envelope: Envelope, verifiers: Verifier[]): boolean {
  // Through the threshold form, so an empty list is `false` as the reference has it.
  return hasSignaturesFromThreshold(envelope, verifiers);
}

/** Returns whether the envelope's subject has some threshold of signatures. */
export function hasSignaturesFromThreshold(
  envelope: Envelope,
  verifiers: Verifier[],
  threshold?: number,
): boolean {
  if (threshold !== undefined && (!Number.isSafeInteger(threshold) || threshold < 0)) {
    throw EnvelopeError.invalidParameter("threshold", "a non-negative integer", threshold);
  }
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

/**
 * Checks whether the envelope's subject has a valid signature from the
 * given public key.
 *
 * @throws EnvelopeError with code `UnverifiedSignature`.
 */
export function verifySignatureFrom(envelope: Envelope, verifier: Verifier): Envelope {
  if (!hasSignatureFrom(envelope, verifier)) {
    throw EnvelopeError.unverifiedSignature();
  }
  return envelope;
}

/**
 * Verifies signature and returns the metadata envelope.
 *
 * @throws EnvelopeError with code `UnverifiedSignature`.
 */
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

/**
 * Checks whether the envelope's subject has a set of signatures.
 *
 * @throws EnvelopeError with code `UnverifiedSignature`.
 */
export function verifySignaturesFrom(envelope: Envelope, verifiers: Verifier[]): Envelope {
  if (!hasSignaturesFrom(envelope, verifiers)) {
    throw EnvelopeError.unverifiedSignature();
  }
  return envelope;
}

/**
 * Checks whether the envelope's subject has some threshold of signatures.
 *
 * @throws EnvelopeError with code `UnverifiedSignature`.
 */
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

/** Returns all signature assertion objects. */
export function signatures(envelope: Envelope): Envelope[] {
  return envelope.objectsForPredicate(SIGNED);
}

// ============================================================================
// Convenience methods for signing and verifying entire envelopes.
//
// These wrap the envelope before signing, ensuring all assertions are
// included in the signature.
// ============================================================================

/** Wraps the envelope and signs it: `envelope.wrap()` plus a `signed` assertion. */
export function sign(envelope: Envelope, signer: Signer, options: SignOptions = {}): Envelope {
  return addSignature(envelope.wrap(), signer, options);
}

/**
 * Verifies that the envelope has a valid signature from the specified
 * verifier, and unwraps it.
 */
export function verify(envelope: Envelope, verifier: Verifier): Envelope {
  return verifySignatureFrom(envelope, verifier).unwrap();
}

/**
 * Verifies the envelope's signature and returns both the unwrapped
 * envelope and signature metadata.
 */
export function verifyReturningMetadata(
  envelope: Envelope,
  verifier: Verifier,
): {
  /** The unwrapped envelope. */
  envelope: Envelope;
  /** The metadata bound to the signature (the unit envelope when there was none). */
  metadata: Envelope;
} {
  const metadata = verifySignatureFromReturningMetadata(envelope, verifier);
  return { envelope: envelope.unwrap(), metadata };
}
