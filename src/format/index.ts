// Format module exports for Gordian Envelope.
//
// This module provides various formatting options for displaying and
// serializing envelopes, including hex, diagnostic, notation, tree,
// UR, and mermaid diagram formats.

/**
 * Formatting: notation, tree, mermaid, diagnostic, annotated hex and
 * summaries, as functions over an envelope, plus the format context.
 *
 * Subpath entry `@blockchaincommons/envelope/format`.
 *
 * @module format
 */
export * from "./tree.js";
export {
  FormatContext,
  getGlobalFormatContext,
  withFormatContext,
  registerTagsIn,
} from "./format-context.js";
export type { FormatContextOpt } from "./format-context.js";
export { summary } from "./envelope-summary.js";
export type { SummaryOptions } from "./envelope-summary.js";
export * from "./notation.js";
export * from "./mermaid.js";
export * from "./hex.js";
export * from "./diagnostic.js";
