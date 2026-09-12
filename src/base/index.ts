// Base module exports for Gordian Envelope.
//
// This module provides the core functionality for working with Gordian
// Envelopes, including the main Envelope class, assertions, digests,
// error handling, and various utility functions.

// Core types
export { Envelope, type EnvelopeCase } from "./envelope";
export { Assertion } from "./envelope";
export type { DigestProvider } from "./digest";

// Error handling
export {
  EnvelopeError,
  EnvelopeErrorCode,
  type EnvelopeErrorDetails,
  type InvalidParameterDetails,
  type MessageDetails,
} from "./error";

// Encodable/Decodable traits
export { type ToEnvelope, type EnvelopeInput, isToEnvelope } from "./envelope-encodable";

export { type CborDecoder } from "./envelope";

// Elision and selective disclosure
export {
  ObscureType,
  type ObscureAction,
  type ElideOptions,
  type AddAssertionOptions,
  type SaltOptions,
  type EncryptOptions,
} from "./envelope";

// Walking/traversal
export { EdgeType, edgeLabel, type Visitor } from "./envelope";
