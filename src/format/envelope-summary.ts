/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

/// Envelope summary functionality for generating short text representations.
///
/// This module provides the EnvelopeSummary interface and implementations
/// for generating concise text summaries of CBOR values and envelopes.

import {
  type Cbor,
  isUnsigned,
  isNegative,
  isBytes,
  isText,
  isSimple,
  isArray,
  isMap,
  isTagged,
  asText,
  expectNumber,
} from "@blockchaincommons/dcbor";
import { diagnostic, type DiagFormatOpts } from "@blockchaincommons/dcbor/diagnostic";

import { type Envelope } from "../base/envelope";
import { type FormatContextOpt, resolveFormatContext } from "./format-context";

/** Types that render their own one-line summary. */
export interface EnvelopeSummary {
  envelopeSummary(maxLength: number, context: FormatContextOpt): string;
}

// ============================================================================
// CBOR Summary Implementation
// ============================================================================

/// Helper to flank a string with prefix and suffix
const flankedBy = (s: string, prefix: string, suffix: string): string => {
  return `${prefix}${s}${suffix}`;
};

/// Generate an envelope summary for a CBOR value.
export const cborEnvelopeSummary = (
  cbor: Cbor,
  maxLength: number,
  context: FormatContextOpt,
): string => {
  // Integers print as their value.
  if (isUnsigned(cbor) || isNegative(cbor)) {
    return String(expectNumber(cbor));
  }

  // Handle byte strings
  if (isBytes(cbor)) {
    const bytes = cbor.value;
    return `Bytes(${bytes.length})`;
  }

  // Handle text strings
  if (isText(cbor)) {
    let text = asText(cbor) ?? "";
    if (text.length > maxLength) {
      text = `${text.substring(0, maxLength)}…`;
    }
    // Replace newlines with escaped version
    text = text.replace(/\n/g, "\\n");
    return flankedBy(text, '"', '"');
  }

  // Handle simple values (bool, null, undefined, float)
  if (isSimple(cbor)) {
    const value = cbor as unknown;
    if (value === true) return "true";
    if (value === false) return "false";
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "number") {
      if (Number.isNaN(value)) return "NaN";
      if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
      return String(value);
    }
    // Fallback for other simple values - use diagnostic notation
    return diagnostic(cbor, { summarize: true });
  }

  // Handle arrays, maps, and tagged values - use diagnostic notation
  if (isArray(cbor) || isMap(cbor) || isTagged(cbor)) {
    const opts: DiagFormatOpts = { summarize: true };

    const ctx = resolveFormatContext(context);
    return diagnostic(cbor, ctx === undefined ? opts : { ...opts, tags: ctx.tags });
  }

  // Fallback
  return diagnostic(cbor);
};

// ============================================================================
// Envelope Summary Method Extension
// ============================================================================

/** Options for `summary`. */
export interface SummaryOptions {
  /** Truncate text leaves beyond this many characters (40 by default). */
  maxLength?: number;
  /** Names for tags and known values; the global context by default. */
  context?: FormatContextOpt;
}

/**
 * A one-line summary of an envelope: its leaf value (text truncated to
 * `maxLength`), a known value's name, or the case name (`NODE`, `WRAPPED`,
 * `ELIDED`, …) for structure.
 */
export function summary(envelope: Envelope, options: SummaryOptions = {}): string {
  const maxLength = options.maxLength ?? 40;
  const context = resolveFormatContext(options.context);
  const c = envelope.case;

  switch (c.type) {
    case "node":
      return "NODE";

    case "leaf":
      return cborEnvelopeSummary(c.cbor, maxLength, context ?? "none");

    case "wrapped":
      return "WRAPPED";

    case "assertion":
      return "ASSERTION";

    case "elided":
      return "ELIDED";

    case "knownValue": {
      const name = context === undefined ? c.value.name : context.knownValues.nameOf(c.value);
      return flankedBy(name, "'", "'");
    }

    case "encrypted":
      return "ENCRYPTED";

    case "compressed":
      return "COMPRESSED";

    default:
      return "UNKNOWN";
  }
}

// ============================================================================
// Exports
// ============================================================================

export { cborEnvelopeSummary as envelopeSummary };
