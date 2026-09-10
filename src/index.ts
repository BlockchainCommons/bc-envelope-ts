/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

/// Gordian Envelope TypeScript Library
///
/// A TypeScript implementation of Blockchain Commons' Gordian Envelope
/// specification for structured, privacy-focused data containers.
///
/// This is a 1:1 port of the Rust bc-envelope library, maintaining the same
/// API structure and functionality.
///
/// @module bc-envelope

// Re-export everything from the base module
export * from "./base";

// Re-export everything from the extension module
export * from "./extension";

// Import registration functions and call them to ensure proper initialization order
import { registerProofExtension } from "./extension/proof";
import { registerSecretExtension } from "./extension/secret";
import { registerSskrExtension } from "./extension/sskr";

registerProofExtension();
registerSecretExtension();
registerSskrExtension();

// Re-export everything from the format module
// Import for side effects (registers prototype extensions like treeFormat)
import "./format";
export * from "./format";

// Import edge module for side effects (registers prototype extensions)
import "./extension/edge";

// Import seal module for side effects (registers prototype extensions)
import "./seal";
export { registerSealExtension } from "./seal";

// Re-export everything from the utils module
export * from "./utils";

// Wire up the request/response/event tag summarizers' inner-envelope
// formatter. This breaks the circular import between
// `base/envelope.ts` and `format/format-context.ts` by deferring the
// hook installation until both modules have finished loading. See
// `format/format-context.ts::setEnvelopeFormatHook` for context.
import { Envelope as EnvelopeForHook } from "./base/envelope";
import { setEnvelopeFormatHook } from "./format/format-context";
setEnvelopeFormatHook((cbor, _flat) => {
  // The summarizer hands us the *untagged* inner CBOR; wrap it as a
  // leaf envelope and format. Mirrors Rust's
  // `Envelope::new(untagged_cbor).format_opt(...)`.
  const innerEnv = EnvelopeForHook.newLeaf(cbor);
  return innerEnv.format();
});

// Version information
export const VERSION = "0.37.0";
