import type { Cbor } from "@blockchaincommons/dcbor";
import { expectTaggedContent } from "@blockchaincommons/dcbor";
import { ARID } from "@blockchaincommons/components";
import { KnownValue } from "@blockchaincommons/known-values";

import type { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";

// The request / response / event subjects: `tag(ARID)` (or `tag('Unknown')`
// for an id-less failure). Decoding follows the reference's
// `try_leaf()?.try_into_expected_tagged_value(tag)?.try_into()?`: `NotLeaf`
// for a structural subject, `Cbor` for the wrong tag or a bad id.

/** The content under `tag` of the envelope's leaf subject. */
export function expectTaggedSubject(envelope: Envelope, tag: number | bigint): Cbor {
  const leaf = envelope.subject().asLeaf();
  if (leaf === undefined) {
    throw EnvelopeError.notLeaf();
  }
  try {
    return expectTaggedContent(leaf, tag);
  } catch (error) {
    throw EnvelopeError.cbor(
      `expected CBOR tag ${String(tag)}`,
      error instanceof Error ? error : undefined,
    );
  }
}

/** `content` as an ARID; `Cbor` when it is not one. */
export function decodeId(content: Cbor): ARID {
  try {
    return ARID.fromCbor(content);
  } catch (error) {
    throw EnvelopeError.cbor("invalid id", error instanceof Error ? error : undefined);
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
