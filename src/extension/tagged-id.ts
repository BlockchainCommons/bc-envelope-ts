import type { Cbor } from "@blockchaincommons/dcbor";
import { expectTaggedContent } from "@blockchaincommons/dcbor";
import { ARID } from "@blockchaincommons/components";
import { KnownValue } from "@blockchaincommons/known-values";

import type { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import { cborErrorAt } from "../base/foreign-errors.js";

// The request / response / event subjects: `tag(ARID)` (or `tag('Unknown')`
// for an id-less failure). Decoding follows the reference's
// `subject().try_leaf()?.try_into_expected_tagged_value(tag)?.try_into()?`:
// `NotLeaf` for a structural subject, `Cbor` with the dcbor Display
// (`dcbor error: expected CBOR tag 40005, but got 40004`) for the wrong tag
// or a bad id.

/**
 * The content under `tag` of the envelope's leaf subject.
 *
 * @throws EnvelopeError `NotLeaf` when the subject is not a leaf, `Cbor`
 *   (`dcbor error: <Display>`) when the leaf is untagged or carries another tag
 */
export function expectTaggedSubject(envelope: Envelope, tag: number | bigint): Cbor {
  const leaf = envelope.subject().asLeaf();
  if (leaf === undefined) {
    throw EnvelopeError.notLeaf();
  }
  try {
    return expectTaggedContent(leaf, tag);
  } catch (error) {
    throw cborErrorAt(error);
  }
}

/**
 * `content` as an ARID.
 *
 * @throws EnvelopeError `Cbor` (`dcbor error: <Display>`) when it is not one
 */
export function decodeId(content: Cbor): ARID {
  try {
    return ARID.fromCbor(content);
  } catch (error) {
    throw cborErrorAt(error);
  }
}

/** The ARID under `tag` in the envelope's subject. */
export function decodeTaggedId(envelope: Envelope, tag: number | bigint): ARID {
  return decodeId(expectTaggedSubject(envelope, tag));
}

/** `content` as a known value when it is one. */
export function tryKnownValue(content: Cbor): KnownValue | undefined {
  try {
    return KnownValue.fromCbor(content);
  } catch {
    return undefined;
  }
}
