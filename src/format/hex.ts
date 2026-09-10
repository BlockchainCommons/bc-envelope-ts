/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Hex formatting for Gordian Envelopes.
 *
 * Mirrors Rust `bc-envelope-rust/src/format/hex.rs`, which delegates to
 * `dcbor::HexFormatOpts` for an annotated multi-line hex dump (tag names,
 * column-aligned notes). We do the same — both {@link Envelope.hex} and
 * {@link Envelope.hexOpt} reuse the canonical {@link hexOpt} formatter in
 * `@blockchaincommons/dcbor-compat` so envelope hex output stays byte-for-byte compatible with
 * Rust's parity-test fixtures.
 */

import { type Envelope } from "../base/envelope";
import { hexAnnotated } from "@blockchaincommons/dcbor/diagnostic";

import { type FormatContextOpt, resolveFormatContext } from "./format-context";

// Note: Method declarations are in the base Envelope class.
// This module provides the prototype implementations.

/// Implementation of hex()
///
/// Mirrors Rust `Envelope::hex`
/// (`bc-envelope-rust/src/format/hex.rs`): the default is the **annotated**
/// multi-line dump because that's the call most consumers expect when
/// they ask for a debuggable hex view of an envelope.
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
  const ctx = resolveFormatContext(context);
  return hexAnnotated(envelope.toCbor(), ctx === undefined ? {} : { tagsStore: ctx.tags });
}
