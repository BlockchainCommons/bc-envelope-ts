/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import type { KnownValue } from "@blockchaincommons/known-values";
import type { ToCbor } from "@blockchaincommons/dcbor";

import type { Envelope } from "./envelope";

/**
 * A trait for types that can be encoded as a Gordian Envelope.
 *
 * This interface defines the contract for converting a value into an envelope.
 * Types implementing this interface can be used directly with envelope
 * construction functions without explicit conversion.
 *
 * There are numerous built-in implementations for common types including:
 * - Primitive types (numbers, strings, booleans)
 * - CBOR values
 * - Cryptographic types (digests, keys, etc.)
 * - Assertions
 * - Other envelopes
 *
 * @example
 * ```typescript
 * // String implements ToEnvelope
 * const e1 = Envelope.from("Hello");
 *
 * // Numbers implement ToEnvelope
 * const e2 = Envelope.from(42);
 *
 * // Using in envelope construction
 * const envelope = Envelope.from("subject")
 *     .addAssertion("name", "Alice")  // Uses ToEnvelope for both predicate and object
 *     .addAssertion("age", 30);       // Uses ToEnvelope for the numeric object
 * ```
 */
export interface ToEnvelope {
  /**
   * Converts this value into a Gordian Envelope.
   *
   * This is the core method of the interface, converting the implementing type
   * into an envelope representation. Most implementations will convert the
   * value to a leaf envelope containing the value.
   *
   * @returns A new envelope containing the value.
   */
  toEnvelope(): Envelope;
}

/**
 * Type guard to check if a value implements ToEnvelope.
 *
 * @param value - The value to check
 * @returns `true` if the value implements ToEnvelope, `false` otherwise
 */
export function isToEnvelope(value: unknown): value is ToEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "toEnvelope" in value &&
    typeof (value as ToEnvelope).toEnvelope === "function"
  );
}

/**
 * Helper type for values that can be encoded as envelopes.
 *
 * This includes:
 * - Types that directly implement ToEnvelope
 * - Primitive types (string, number, boolean)
 * - Uint8Array (for binary data)
 * - null and undefined
 *
 * The Envelope class will handle conversion of these types automatically.
 */
export type EnvelopeInput =
  | ToEnvelope
  | string
  | number
  | boolean
  | bigint
  | Uint8Array
  | null
  | undefined
  | Envelope
  | KnownValue
  | ToCbor;
