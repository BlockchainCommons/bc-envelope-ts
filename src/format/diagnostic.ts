/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Diagnostic notation formatting for Gordian Envelopes.
 *
 * This module provides methods for converting envelopes to CBOR diagnostic
 * notation, a human-readable text format defined in
 * [RFC-8949 §8](https://www.rfc-editor.org/rfc/rfc8949.html#name-diagnostic-notation).
 *
 * Mirrors Rust `bc-envelope-rust/src/format/diagnostic.rs`, which delegates
 * to `dcbor::diagnostic_opt` / `dcbor::diagnostic_annotated`. We do the same
 * — the {@link diagnostic} and {@link diagnosticAnnotated} methods reuse the
 * canonical formatters in `@blockchaincommons/dcbor-compat` so envelope diagnostic output stays
 * byte-for-byte compatible with the rest of the suite (and with Rust output
 * in the parity-test fixtures).
 */

import { type Envelope } from "../base/envelope";
import {
  diagnostic as cborDiagnostic,
  type DiagFormatOpts,
} from "@blockchaincommons/dcbor/diagnostic";

import { type FormatContextOpt, resolveFormatContext } from "./format-context";

// Note: Method declarations are in the base Envelope class.
// This module provides the prototype implementations.

/// Implementation of diagnostic()
///
/// Mirrors Rust `Envelope::diagnostic` (`bc-envelope-rust/src/format/
/// diagnostic.rs:27`):
///
///     pub fn diagnostic(&self) -> String { diagnostic(self.tagged_cbor()) }
///
/// Plain CBOR diagnostic notation, no tag-name annotations. The annotated
/// variant lives on `diagnosticAnnotated()` below.
/** Options for `diagnostic`. */
export interface DiagnosticOptions {
  /** Comment each item with its tag name and summary (off by default). */
  annotate?: boolean;
  /** Names for tags; the global context by default. */
  context?: FormatContextOpt;
}

/** The envelope's CBOR in diagnostic notation. */
export function diagnostic(
  envelope: Envelope,
  { annotate = false, context }: DiagnosticOptions = {},
): string {
  if (!annotate) return cborDiagnostic(envelope.toCbor());
  const ctx = resolveFormatContext(context);
  const opts: DiagFormatOpts = { annotate: true };
  if (ctx !== undefined) opts.tags = ctx.tags;
  return cborDiagnostic(envelope.toCbor(), opts);
}
