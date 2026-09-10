/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import type { EnvelopeEncodableValue } from "../base/envelope-encodable";
import { secureRng, randomBytes, type RandomNumberGenerator } from "@blockchaincommons/rand";
import { nextInClosedRangeI32 } from "@blockchaincommons/rand/samplers";
import { SALT as SALT_KV, type KnownValue } from "@blockchaincommons/known-values";
import { Salt as SaltComponent } from "@blockchaincommons/components";
import { cborBytes } from "../format/hex.js";

/// Extension for adding salt to envelopes to prevent correlation.
///
/// This module provides functionality for decorrelating envelopes by adding
/// random salt. Salt is added as an assertion with the predicate 'salt' and
/// a random value. When an envelope is elided, this salt ensures that the
/// digest of the elided envelope cannot be correlated with other elided
/// envelopes containing the same information.
///
/// Decorrelation is an important privacy feature that prevents third parties
/// from determining whether two elided envelopes originally contained the same
/// information by comparing their digests.
///
/// Based on bc-envelope-rust/src/extension/salt.rs and bc-components-rust/src/salt.rs
///
/// @example
/// ```typescript
/// // Create a simple envelope
/// const envelope = Envelope.new("Hello");
///
/// // Create a decorrelated version by adding salt
/// const salted = addSalt(envelope);
///
/// // The salted envelope has a different digest than the original
/// console.log(envelope.digest().equals(salted.digest())); // false
/// ```

// ============================================================================
// Envelope Prototype Extensions for Salted Assertions
// ============================================================================

/// The standard predicate for salt assertions (KnownValue matching Rust)
export const SALT: KnownValue = SALT_KV;

/// Minimum salt size in bytes (64 bits)
const MIN_SALT_SIZE = 8;

/// Creates a new SecureRng instance
function createSecureRng(): RandomNumberGenerator {
  return secureRng();
}

/// Generates random bytes using the rand package
function generateRandomBytes(length: number, rng?: RandomNumberGenerator): Uint8Array {
  const actualRng = rng ?? createSecureRng();
  return randomBytes(length, { rng: actualRng });
}

/// Calculates salt size proportional to envelope size
/// This matches the Rust implementation in bc-components-rust/src/salt.rs
function calculateProportionalSaltSize(envelopeSize: number, rng?: RandomNumberGenerator): number {
  const actualRng = rng ?? createSecureRng();
  const count = envelopeSize;
  const minSize = Math.max(8, Math.ceil(count * 0.05));
  const maxSize = Math.max(minSize + 8, Math.ceil(count * 0.25));
  return nextInClosedRangeI32(actualRng, minSize, maxSize);
}

/// Implementation of addSalt()
export function addSalt(envelope: Envelope): Envelope {
  const rng = createSecureRng();
  const envelopeSize = cborBytes(envelope).length;
  const saltSize = calculateProportionalSaltSize(envelopeSize, rng);
  const saltBytes = generateRandomBytes(saltSize, rng);
  return envelope.addAssertion(SALT, SaltComponent.from(saltBytes));
}

/// Implementation of addSaltInstance() — mirrors Rust
/// `Envelope::add_salt_instance(salt)`
/// (`bc-envelope-rust/src/extension/salt.rs:125`).
/// Used by callers that need a specific salt value (e.g. for digest
/// stability across calls), most notably `xid::Key` /
/// `xid::Provenance` whose salts are constructed once and stored on
/// the value type.
export function addSaltInstance(envelope: Envelope, salt: SaltComponent): Envelope {
  return envelope.addAssertion(SALT, salt);
}

/// Implementation of addSaltWithLength()
export function addSaltWithLength(envelope: Envelope, count: number): Envelope {
  if (count < MIN_SALT_SIZE) {
    throw EnvelopeError.general(`Salt must be at least ${MIN_SALT_SIZE} bytes, got ${count}`);
  }
  const saltBytes = generateRandomBytes(count);
  return envelope.addAssertion(SALT, SaltComponent.from(saltBytes));
}

/// Alias for addSaltWithLength (Rust API compatibility)
export function addSaltWithLen(envelope: Envelope, count: number): Envelope {
  return addSaltWithLength(envelope, count);
}

/// Implementation of addSaltBytes()
export function addSaltBytes(envelope: Envelope, saltBytes: Uint8Array): Envelope {
  if (saltBytes.length < MIN_SALT_SIZE) {
    throw EnvelopeError.general(
      `Salt must be at least ${MIN_SALT_SIZE} bytes, got ${saltBytes.length}`,
    );
  }
  return envelope.addAssertion(SALT, SaltComponent.from(saltBytes));
}

/// Implementation of addSaltInRange()
export function addSaltInRange(envelope: Envelope, min: number, max: number): Envelope {
  if (min < MIN_SALT_SIZE) {
    throw EnvelopeError.general(
      `Minimum salt size must be at least ${MIN_SALT_SIZE} bytes, got ${min}`,
    );
  }
  if (max < min) {
    throw EnvelopeError.general(
      `Maximum salt size must be at least minimum, got min=${min} max=${max}`,
    );
  }
  const rng = createSecureRng();
  const saltSize = nextInClosedRangeI32(rng, min, max);
  const saltBytes = generateRandomBytes(saltSize, rng);
  return envelope.addAssertion(SALT, SaltComponent.from(saltBytes));
}

/// Test-determinism overloads for the salt builders, mirroring Rust's
/// `*_using` variants (`bc-envelope-rust/src/extension/salt.rs`):
/// `add_salt_using`, `add_salt_with_len_using`, `add_salt_in_range_using`.
/// They thread a caller-supplied {@link RandomNumberGenerator} through
/// the salt-bytes generation so tests can pin the entropy and assert on
/// exact share / digest bytes.

/// Implementation of addSaltUsing()
export function addSaltUsing(envelope: Envelope, rng: RandomNumberGenerator): Envelope {
  const envelopeSize = cborBytes(envelope).length;
  const saltSize = calculateProportionalSaltSize(envelopeSize, rng);
  const saltBytes = generateRandomBytes(saltSize, rng);
  return envelope.addAssertion(SALT, SaltComponent.from(saltBytes));
}

/// Implementation of addSaltWithLenUsing()
export function addSaltWithLenUsing(
  envelope: Envelope,
  count: number,
  rng: RandomNumberGenerator,
): Envelope {
  if (count < MIN_SALT_SIZE) {
    throw EnvelopeError.general(`Salt must be at least ${MIN_SALT_SIZE} bytes, got ${count}`);
  }
  const saltBytes = generateRandomBytes(count, rng);
  return envelope.addAssertion(SALT, SaltComponent.from(saltBytes));
}

/// Implementation of addSaltInRangeUsing()
export function addSaltInRangeUsing(
  envelope: Envelope,
  min: number,
  max: number,
  rng: RandomNumberGenerator,
): Envelope {
  if (min < MIN_SALT_SIZE) {
    throw EnvelopeError.general(
      `Minimum salt size must be at least ${MIN_SALT_SIZE} bytes, got ${min}`,
    );
  }
  if (max < min) {
    throw EnvelopeError.general(
      `Maximum salt size must be at least minimum, got min=${min} max=${max}`,
    );
  }
  const saltSize = nextInClosedRangeI32(rng, min, max);
  const saltBytes = generateRandomBytes(saltSize, rng);
  return envelope.addAssertion(SALT, SaltComponent.from(saltBytes));
}

/// Implementation of addAssertionSalted()
export function addAssertionSalted(
  envelope: Envelope,
  predicate: EnvelopeEncodableValue,
  object: EnvelopeEncodableValue,
  salted: boolean,
): Envelope {
  // Create the assertion envelope
  const assertion = Envelope.newAssertion(predicate, object);

  // If not salted, use the normal addAssertionEnvelope
  if (!salted) {
    return envelope.addAssertionEnvelope(assertion);
  }

  // Add salt to the assertion envelope (envelope creates a node with assertion as subject)
  const saltedAssertion = addSalt(assertion);

  // When salted, we need to use newWithUncheckedAssertions because the salted
  // assertion is a node (not pure assertion type) and would fail normal validation
  const c = envelope.case();
  if (c.type === "node") {
    return Envelope.newWithUncheckedAssertions(c.subject, [...c.assertions, saltedAssertion]);
  }
  return Envelope.newWithUncheckedAssertions(envelope, [saltedAssertion]);
}

/// Implementation of addAssertionEnvelopeSalted()
export function addAssertionEnvelopeSalted(
  envelope: Envelope,
  assertionEnvelope: Envelope,
  salted: boolean,
): Envelope {
  // If not salted, use the normal addAssertionEnvelope
  if (!salted) {
    return envelope.addAssertionEnvelope(assertionEnvelope);
  }

  // Add salt to the assertion envelope (envelope creates a node with assertion as subject)
  const saltedAssertion = addSalt(assertionEnvelope);

  // When salted, we need to use newWithUncheckedAssertions because the salted
  // assertion is a node (not pure assertion type) and would fail normal validation
  const c = envelope.case();
  if (c.type === "node") {
    return Envelope.newWithUncheckedAssertions(c.subject, [...c.assertions, saltedAssertion]);
  }
  return Envelope.newWithUncheckedAssertions(envelope, [saltedAssertion]);
}

/// Implementation of addOptionalAssertionEnvelopeSalted()
export function addOptionalAssertionEnvelopeSalted(
  envelope: Envelope,
  assertionEnvelope: Envelope | undefined,
  salted: boolean,
): Envelope {
  if (assertionEnvelope === undefined) {
    return envelope;
  }

  // If not salted, use the normal addOptionalAssertionEnvelope
  if (!salted) {
    return envelope.addOptionalAssertionEnvelope(assertionEnvelope);
  }

  // Add salt to the assertion envelope (envelope creates a node with assertion as subject)
  const saltedAssertion = addSalt(assertionEnvelope);

  // When salted, we need to use newWithUncheckedAssertions because the salted
  // assertion is a node (not pure assertion type) and would fail normal validation
  const c = envelope.case();
  if (c.type === "node") {
    // Check for duplicate assertions
    const isDuplicate = c.assertions.some((a) => a.digest().equals(saltedAssertion.digest()));
    if (isDuplicate) {
      return envelope;
    }
    return Envelope.newWithUncheckedAssertions(c.subject, [...c.assertions, saltedAssertion]);
  }
  return Envelope.newWithUncheckedAssertions(envelope.subject(), [saltedAssertion]);
}
