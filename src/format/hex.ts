/**
 * Hex formatting for Gordian Envelopes.
 *
 * `dcbor::HexFormatOpts` for an annotated multi-line hex dump (tag names,
 * column-aligned notes). We do the same — both {@link Envelope.hex} and
 * {@link Envelope.hexOpt} reuse the canonical {@link hexOpt} formatter in
 * `@blockchaincommons/dcbor-compat` so envelope hex output stays byte-for-byte compatible with
 * the reference's parity-test fixtures.
 */

import { type Envelope } from "../base/envelope";
import { hexAnnotated } from "@blockchaincommons/dcbor/diagnostic";

import { type FormatContextOpt, tagsStoreFor } from "./format-context";

/** Options for `hex`. */
export interface HexOptions {
  /** Annotate each CBOR item with its type and tag name (on by default). */
  annotate?: boolean;
  /** Names for tags; the global context by default. */
  context?: FormatContextOpt;
}

/** The envelope's CBOR as hex, annotated line by line unless `annotate` is false. */
export function hex(envelope: Envelope, { annotate = true, context }: HexOptions = {}): string {
  if (!annotate) return envelope.toCbor().toHex();
  return hexAnnotated(envelope.toCbor(), { tagsStore: tagsStoreFor(context) });
}
