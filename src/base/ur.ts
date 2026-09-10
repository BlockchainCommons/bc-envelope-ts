/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

/// UR (Uniform Resource) support for Gordian Envelope.
///
/// This module adds urString() and fromUrString() methods to the Envelope class,
/// enabling serialization to and from UR format as specified in BCR-2020-005.

import { UR } from "@blockchaincommons/uniform-resources";

import { Envelope } from "./envelope";

// ============================================================================
// Envelope Prototype Extensions for UR Support
// ============================================================================

/// Implementation of urString
Envelope.prototype.urString = function (this: Envelope): string {
  // Use untaggedCbor() per Rust implementation - the UR type "envelope" implies the tag
  const ur = UR.from("envelope", this.untaggedCbor());
  return ur.toString();
};

/// Implementation of ur
Envelope.prototype.ur = function (this: Envelope): UR {
  // Use untaggedCbor() per Rust implementation - the UR type "envelope" implies the tag
  return UR.from("envelope", this.untaggedCbor());
};

/// Implementation of taggedCborData (alias for cborBytes)
Envelope.prototype.taggedCborData = function (this: Envelope): Uint8Array {
  return this.cborBytes();
};

/// Implementation of fromUrString
Envelope.fromUrString = function (urString: string): Envelope {
  const ur = UR.parse(urString);
  return Envelope.fromUR(ur);
};

/// Implementation of fromURString (alias)
Envelope.fromURString = Envelope.fromUrString;

/// Implementation of fromUR
Envelope.fromUR = function (ur: UR): Envelope {
  ur.expectType("envelope");
  // Use fromUntaggedCbor() per Rust implementation - the UR type "envelope" implies the tag
  return Envelope.fromUntaggedCbor(ur.cbor);
};
