/**
 * Diagnostic notation formatting for Gordian Envelopes: the CBOR diagnostic
 * notation of [RFC-8949 §8](https://www.rfc-editor.org/rfc/rfc8949.html#name-diagnostic-notation)
 * as dcbor renders it, plain (`diagnostic`) or annotated with tag names
 * through a format context (`diagnostic_annotated`); the annotated form
 * names tags through the context's own store, the global context's
 * snapshot by default.
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
