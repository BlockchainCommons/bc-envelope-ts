/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Type system for Gordian Envelopes.
 *
 * Mirrors `bc-envelope-rust/src/extension/types.rs`. Types are represented as
 * `'isA'` (KnownValue 1) assertions, with the object specifying the type. The
 * type object is typically a string, an envelope, or a registered KnownValue.
 *
 * @example
 * ```typescript
 * // Tag with a string type
 * const person = Envelope.new("Alice")
 *   .addType("Person")
 *   .addAssertion("age", 30);
 *
 * // Tag with a KnownValue (e.g. the SEED_TYPE registry entry)
 * const seed = addType(Envelope.new(seedData), SEED_TYPE);
 * if (hasTypeValue(seed, SEED_TYPE)) { ... }
 * ```
 */

import { Envelope } from "../base/envelope";
import { type EnvelopeEncodableValue } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
import { IS_A, type KnownValue } from "@blockchaincommons/known-values";

/// Implementation of addType()
export function addType(envelope: Envelope, object: EnvelopeEncodableValue): Envelope {
  return envelope.addAssertion(IS_A, object);
}

/// Implementation of types()
export function types(envelope: Envelope): Envelope[] {
  return envelope.objectsForPredicate(IS_A);
}

/// Implementation of getType()
///
/// Mirrors Rust `Envelope::get_type`
/// (`bc-envelope-rust/src/extension/types.rs:209-216`):
/// returns the single type if there is exactly one, otherwise raises
/// `Error::AmbiguousType`. Earlier revisions of this port returned
/// `InvalidType` when the count was 0 — Rust uses the same
/// `AmbiguousType` variant for both 0 and >1 cases.
export function getType(envelope: Envelope): Envelope {
  const t = types(envelope);
  if (t.length === 1) {
    return t[0];
  }
  throw EnvelopeError.ambiguousType();
}

/// Implementation of hasType()
export function hasType(envelope: Envelope, t: EnvelopeEncodableValue): boolean {
  const e = Envelope.new(t);
  return types(envelope).some((x) => x.digest().equals(e.digest()));
}

/// Implementation of checkType()
export function checkType(envelope: Envelope, t: EnvelopeEncodableValue): void {
  if (!hasType(envelope, t)) {
    throw EnvelopeError.invalidType();
  }
}

/// Implementation of hasTypeValue()
///
/// Mirrors Rust `Envelope::has_type_value`
/// (`bc-envelope-rust/src/extension/types.rs:280-285`).
/// Specialised counterpart to {@link Envelope.hasType} for checking
/// against registered KnownValue types (e.g. `SEED_TYPE`).
export function hasTypeValue(envelope: Envelope, t: KnownValue): boolean {
  const typeEnvelope = Envelope.newWithKnownValue(t);
  return types(envelope).some((x) => x.digest().equals(typeEnvelope.digest()));
}

/// Implementation of checkTypeValue()
///
/// Mirrors Rust `Envelope::check_type_value`
/// (`bc-envelope-rust/src/extension/types.rs:332-338`).
/// Throws {@link EnvelopeError.invalidType} if the envelope does not
/// carry the supplied KnownValue as its type.
export function checkTypeValue(envelope: Envelope, t: KnownValue): void {
  if (!hasTypeValue(envelope, t)) {
    throw EnvelopeError.invalidType();
  }
}
