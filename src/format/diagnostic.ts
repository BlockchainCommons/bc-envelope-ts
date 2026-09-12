/**
 * Diagnostic notation formatting for Gordian Envelopes.
 *
 * This module provides methods for converting envelopes to CBOR diagnostic
 * notation, a human-readable text format defined in
 * [RFC-8949 §8](https://www.rfc-editor.org/rfc/rfc8949.html#name-diagnostic-notation).
 *
 * to `dcbor::diagnostic_opt` / `dcbor::diagnostic_annotated`. We do the same
 * — the {@link diagnostic} and {@link diagnosticAnnotated} methods reuse the
 * canonical formatters in `@blockchaincommons/dcbor-compat` so envelope diagnostic output stays
 * byte-for-byte compatible with the rest of the suite (and with the reference output
 * in the parity-test fixtures).
 */

import { type Envelope } from "../base/envelope";
import {
  diagnostic as cborDiagnostic,
  type DiagFormatOpts,
} from "@blockchaincommons/dcbor/diagnostic";

import { type FormatContextOpt, tagsStoreFor } from "./format-context";

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
  const opts: DiagFormatOpts = { annotate: true, tags: tagsStoreFor(context) };
  return cborDiagnostic(envelope.toCbor(), opts);
}
