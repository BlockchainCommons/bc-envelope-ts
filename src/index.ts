/**
 * Gordian Envelope: the base specification. Structured, privacy-focused
 * data containers with a digest tree, elision, wrapping and CBOR / UR forms.
 *
 * Extensions live on subpaths (`/signature`, `/recipient`, `/sskr`,
 * `/proof`, `/attachment`, `/edge`, `/types`, `/secret`,
 * `/expression`, `/seal`, `/format`) as functions over an envelope;
 * `@blockchaincommons/envelope/all` installs them as methods for the fluent
 * style.
 *
 * @packageDocumentation
 */
export * from "./base/index.js";
export * from "./utils/index.js";
