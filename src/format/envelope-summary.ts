// Envelope summary functionality for generating short text representations.
//
// This module provides the EnvelopeSummary interface and implementations
// for generating concise text summaries of CBOR values and envelopes.

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
import { type FormatContextOpt, resolveFormatContext, tagsStoreFor } from "./format-context";

// ============================================================================
// CBOR Summary Implementation
// ============================================================================

/** Helper to flank a string with prefix and suffix */
const flankedBy = (s: string, prefix: string, suffix: string): string => {
  return `${prefix}${s}${suffix}`;
};

/** The UTF-8 length of `text` (Rust's `str::len()`), without encoding it. */
const utf8Length = (text: string): number => {
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return n;
};

/** Generate an envelope summary for a CBOR value. */
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
    // The reference's rule (`envelope_summary.rs`): the UTF-8 byte length
    // decides whether to truncate (`string.len() > max_length`), the cut
    // keeps the first `max_length` *characters* (`chars().take(max_length)`)
    // — so a non-ASCII text can gain an ellipsis without losing a character.
    // Matched exactly: byte length via a code-point walk, cut by code point.
    if (utf8Length(text) > maxLength) {
      text = `${[...text].slice(0, maxLength).join("")}…`;
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

    return diagnostic(cbor, { ...opts, tags: tagsStoreFor(context) });
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
      // Only the context's registered name counts (the reference looks the raw
      // value up in the context's store); `"none"` prints the codepoint.
      const name = context?.knownValues.assignedNameOf(c.value) ?? String(c.value.value);
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
