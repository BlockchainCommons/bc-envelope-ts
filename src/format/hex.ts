/**
 * Hex formatting for Gordian Envelopes: the annotated multi-line hex dump
 * (tag names, column-aligned notes) that dcbor's `hexAnnotated` renders,
 * the reference's `Envelope::hex` over `dcbor::HexFormatOpts`.
 */

import { type Envelope } from "../base/envelope";
import { hexAnnotated } from "@blockchaincommons/dcbor/diagnostic";

import { type FormatContextOpt, hexTagsStoreFor } from "./format-context";

/** Options for `hex`. */
export interface HexOptions {
  /** Annotate each CBOR item with its type and tag name (on by default). */
  annotate?: boolean;
  /** Names for tags; the global context by default. */
  context?: FormatContextOpt;
}

/**
 * The envelope's CBOR as hex, annotated line by line unless `annotate` is
 * false. With the global context the tag names come from dcbor's live
 * global store (the reference's `hex()` resolves `FormatContextOpt::Global`
 * to `TagsStoreOpt::Global`), not from the snapshot the global format
 * context holds.
 */
export function hex(envelope: Envelope, { annotate = true, context }: HexOptions = {}): string {
  if (!annotate) return envelope.toCbor().toHex();
  return hexAnnotated(envelope.toCbor(), { tagsStore: hexTagsStoreFor(context) });
}
