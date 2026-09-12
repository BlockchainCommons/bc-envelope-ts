/**
 * Type system for Gordian Envelopes.
 *
 * `'isA'` (KnownValue 1) assertions, with the object specifying the type. The
 * type object is typically a string, an envelope, or a registered KnownValue.
 *
 * @example
 * ```typescript
 * // Tag with a string type
 * const person = Envelope.from("Alice")
 *   .addType("Person")
 *   .addAssertion("age", 30);
 *
 * // Tag with a KnownValue (e.g. the SEED_TYPE registry entry)
 * const seed = addType(Envelope.from(seedData), SEED_TYPE);
 * if (hasTypeValue(seed, SEED_TYPE)) { ... }
 * ```
 */

import { Envelope } from "../base/envelope";
import { type EnvelopeInput } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
import { IS_A, type KnownValue } from "@blockchaincommons/known-values";

/** Adds an `isA` assertion with `object`. */
export function addType(envelope: Envelope, object: EnvelopeInput): Envelope {
  return envelope.addAssertion(IS_A, object);
}

/** The objects of every `isA` assertion. */
export function types(envelope: Envelope): Envelope[] {
  return envelope.objectsForPredicate(IS_A);
}

/**
 * returns the single type if there is exactly one, otherwise raises
 * `Error::AmbiguousType`. Earlier revisions of this port returned
 * `InvalidType` when the count was 0 — the reference uses the same
 * `AmbiguousType` variant for both 0 and >1 cases.
 *
 * @throws EnvelopeError with code `AmbiguousType`.
 */
export function getType(envelope: Envelope): Envelope {
  const t = types(envelope);
  if (t.length === 1) {
    return t[0];
  }
  throw EnvelopeError.ambiguousType();
}

/** `true` when some `isA` assertion has `t` as object. */
export function hasType(envelope: Envelope, t: EnvelopeInput): boolean {
  const e = Envelope.from(t);
  return types(envelope).some((x) => x.digest().equals(e.digest()));
}

/**
 * Throws `InvalidType` unless some `isA` assertion has `t` as object.
 *
 * @throws EnvelopeError with code `InvalidType`.
 */
export function expectType(envelope: Envelope, t: EnvelopeInput): void {
  if (!hasType(envelope, t)) {
    throw EnvelopeError.invalidType();
  }
}

/**
 * Specialised counterpart to {@link Envelope.hasType} for checking
 * against registered KnownValue types (e.g. `SEED_TYPE`).
 */
export function hasTypeValue(envelope: Envelope, t: KnownValue): boolean {
  const typeEnvelope = Envelope.knownValue(t);
  return types(envelope).some((x) => x.digest().equals(typeEnvelope.digest()));
}

/**
 * Throws {@link EnvelopeError.invalidType} if the envelope does not
 * carry the supplied KnownValue as its type.
 *
 * @throws EnvelopeError with code `InvalidType`.
 */
export function expectTypeValue(envelope: Envelope, t: KnownValue): void {
  if (!hasTypeValue(envelope, t)) {
    throw EnvelopeError.invalidType();
  }
}
