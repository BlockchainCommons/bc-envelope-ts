/**
 * Attachment Extension for Gordian Envelope
 *
 * Provides functionality for attaching vendor-specific metadata to envelopes.
 * Attachments enable flexible, extensible data storage without modifying
 * the core data model, facilitating interoperability and future compatibility.
 *
 * Each attachment has:
 * - A payload (arbitrary data)
 * - A required vendor identifier (typically a reverse domain name)
 * - An optional conformsTo URI that indicates the format of the attachment
 *
 * See BCR-2023-006: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2023-006-envelope-attachment.md
 */

import { expectText } from "@blockchaincommons/dcbor";
import { Envelope, tryObjectForPredicate, tryOptionalObjectForPredicate } from "../base/envelope";
import { type Digest } from "../base/digest";
import { EnvelopeError } from "../base/error";
import type { EnvelopeInput } from "../base/envelope-encodable";
import { ATTACHMENT, VENDOR, CONFORMS_TO } from "@blockchaincommons/known-values";

/**
 * A container for vendor-specific metadata attachments.
 *
 * Attachments provides a flexible mechanism for attaching arbitrary metadata
 * to envelopes without modifying their core structure.
 */
export class Attachments {
  private readonly _envelopes = new Map<string, Envelope>();

  /**
   * Creates a new empty attachments container.
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}

  /**
   * Adds a new attachment with the specified payload and metadata.
   *
   * @param payload - The data to attach
   * @param vendor - A string identifying the entity that defined the attachment format
   * @param conformsTo - Optional URI identifying the structure the payload conforms to
   */
  add(payload: EnvelopeInput, vendor: string, conformsTo?: string): void {
    const envelope = attachment(payload, vendor, conformsTo);
    this._envelopes.set(envelope.digest().toHex(), envelope);
  }

  /**
   * Adds a pre-constructed attachment envelope directly.
   *
   * @param envelope - The attachment envelope to add
   */
  addEnvelope(envelope: Envelope): void {
    this._envelopes.set(envelope.digest().toHex(), envelope);
  }

  /**
   * Retrieves an attachment by its digest.
   *
   * @param digest - The unique digest of the attachment to retrieve
   * @returns The envelope if found, or undefined
   */
  get(digest: Digest): Envelope | undefined {
    return this._envelopes.get(digest.toHex());
  }

  /**
   * Removes an attachment by its digest.
   *
   * @param digest - The unique digest of the attachment to remove
   * @returns The removed envelope if found, or undefined
   */
  remove(digest: Digest): Envelope | undefined {
    const envelope = this._envelopes.get(digest.toHex());
    this._envelopes.delete(digest.toHex());
    return envelope;
  }

  /**
   * Removes all attachments from the container.
   */
  clear(): void {
    this._envelopes.clear();
  }

  /** How many attachments are stored. */
  get size(): number {
    return this._envelopes.size;
  }

  /** The stored attachment envelopes. */
  [Symbol.iterator](): IterableIterator<Envelope> {
    return this._envelopes.values();
  }

  /**
   * Check equality with another Attachments container.
   */
  equals(other: Attachments): boolean {
    if (this._envelopes.size !== other._envelopes.size) return false;
    for (const [key] of this._envelopes) {
      if (!other._envelopes.has(key)) return false;
    }
    return true;
  }

  /**
   * Adds all attachments from this container to an envelope, each stored
   * `'attachment'` assertion as it is (they are assertion envelopes already).
   *
   * @param envelope - The envelope to add attachments to
   * @returns A new envelope with all attachments added as assertions
   */
  addToEnvelope(envelope: Envelope): Envelope {
    let result = envelope;
    for (const attachment of this._envelopes.values()) {
      result = result.addAssertionEnvelope(attachment);
    }
    return result;
  }

  /**
   * Creates an Attachments container from an envelope's attachment assertions.
   *
   * @param envelope - The envelope to extract attachments from
   * @returns A new Attachments container with the envelope's attachments
   */
  static fromEnvelope(envelope: Envelope): Attachments {
    const result = new Attachments();
    for (const attachment of attachments(envelope)) {
      result._envelopes.set(attachment.digest().toHex(), attachment);
    }

    return result;
  }
}

// Implementation

/**
 * Creates a new attachment envelope.
 */
export function attachment(payload: EnvelopeInput, vendor: string, conformsTo?: string): Envelope {
  // Create the payload envelope wrapped with vendor assertion
  let attachmentObj = Envelope.from(payload).wrap().addAssertion(VENDOR, vendor);

  // Add optional conformsTo
  if (conformsTo !== undefined) {
    attachmentObj = attachmentObj.addAssertion(CONFORMS_TO, conformsTo);
  }

  // Create an assertion with 'attachment' as predicate and the wrapped payload as object
  // This returns an assertion envelope
  const attachmentPredicate = Envelope.from(ATTACHMENT);
  return attachmentPredicate.addAssertion(ATTACHMENT, attachmentObj).assertions()[0];
}

/**
 * Adds an attachment to an envelope.
 */
export function addAttachment(
  envelope: Envelope,
  payload: EnvelopeInput,
  vendor: string,
  conformsTo?: string,
): Envelope {
  let attachmentObj = Envelope.from(payload).wrap().addAssertion(VENDOR, vendor);

  if (conformsTo !== undefined) {
    attachmentObj = attachmentObj.addAssertion(CONFORMS_TO, conformsTo);
  }

  return envelope.addAssertion(ATTACHMENT, attachmentObj);
}

/**
 * Returns the payload of an attachment envelope.
 *
 * @throws EnvelopeError with code `General`.
 */
export function attachmentPayload(envelope: Envelope): Envelope {
  const c = envelope.case;
  if (c.type !== "assertion") {
    throw EnvelopeError.invalidAttachment();
  }

  const obj = c.assertion.object();
  return obj.unwrap();
}

/**
 * Returns the vendor of an attachment envelope: the object's `'vendor'`
 * read by subject extraction (the reference's
 * `extract_object_for_predicate`), so a salted or otherwise annotated vendor
 * is read too; an empty vendor is a vendor.
 *
 * @throws EnvelopeError with code `InvalidAttachment` when the envelope is
 *   not an assertion; `NonexistentPredicate` / `AmbiguousPredicate` when
 *   there is not exactly one vendor; `Cbor` (`dcbor error: <Display>`) when
 *   it is not text.
 */
export function attachmentVendor(envelope: Envelope): string {
  const c = envelope.case;
  if (c.type !== "assertion") {
    throw EnvelopeError.invalidAttachment();
  }
  return tryObjectForPredicate(c.assertion.object(), VENDOR, expectText);
}

/**
 * Returns the conformsTo of an attachment envelope, or `undefined` when it
 * has none (the reference's `extract_optional_object_for_predicate`).
 *
 * @throws EnvelopeError with code `InvalidAttachment` when the envelope is
 *   not an assertion; `AmbiguousPredicate` when there are several; `Cbor`
 *   when it is not text.
 */
export function attachmentConformsTo(envelope: Envelope): string | undefined {
  const c = envelope.case;
  if (c.type !== "assertion") {
    throw EnvelopeError.invalidAttachment();
  }
  return tryOptionalObjectForPredicate(c.assertion.object(), CONFORMS_TO, expectText);
}

/** Which attachments `attachments` and `expectAttachment` select. */
export interface AttachmentFilter {
  /** Only attachments from this vendor. */
  vendor?: string;
  /** Only attachments whose `conformsTo` equals this. */
  conformsTo?: string;
}

/**
 * The envelope's `attachment` assertions, optionally only those matching
 * `filter`; read each with `attachmentPayload`, `attachmentVendor` and
 * `attachmentConformsTo`.
 */
export function attachments(envelope: Envelope, filter: AttachmentFilter = {}): Envelope[] {
  const all = envelope.assertionsWithPredicate(ATTACHMENT);
  // Every `attachment` assertion must be well formed, as the reference checks.
  for (const a of all) validateAttachment(a);
  if (filter.vendor === undefined && filter.conformsTo === undefined) return all;
  return all.filter((a) => {
    try {
      if (filter.vendor !== undefined && attachmentVendor(a) !== filter.vendor) return false;
      return filter.conformsTo === undefined || attachmentConformsTo(a) === filter.conformsTo;
    } catch {
      return false;
    }
  });
}

/**
 * Validates that this envelope is a valid attachment, in the reference's
 * order (`validate_attachment`): the payload is read (`NotWrapped` when the
 * object is not wrapped), then the vendor and the conformsTo, then the
 * attachment is rebuilt from them and must be equivalent to this envelope
 * (which also checks that the predicate is `'attachment'`).
 *
 * @throws EnvelopeError with code `InvalidAttachment` when the envelope is
 *   not an assertion or does not rebuild; `NotWrapped`,
 *   `NonexistentPredicate`, `AmbiguousPredicate` or `Cbor` from the parts.
 */
export function validateAttachment(envelope: Envelope): void {
  const payload = attachmentPayload(envelope);
  const vendor = attachmentVendor(envelope);
  const conformsTo = attachmentConformsTo(envelope);
  const reconstructed = attachment(payload, vendor, conformsTo);
  if (!envelope.isEquivalentTo(reconstructed)) {
    throw EnvelopeError.invalidAttachment();
  }
}

/**
 * Finds a single attachment matching the given vendor and conformsTo.
 *
 * Unlike `attachments` which returns an array,
 * this method requires exactly one attachment to match.
 *
 * @param filter - Optional `vendor` and `conformsTo` to match
 * @returns The matching attachment envelope
 * @throws EnvelopeError if not exactly one attachment matches
 */
export function expectAttachment(envelope: Envelope, filter: AttachmentFilter = {}): Envelope {
  const matches = attachments(envelope, filter);

  if (matches.length === 0) {
    throw EnvelopeError.nonexistentAttachment();
  }
  if (matches.length > 1) {
    throw EnvelopeError.ambiguousAttachment();
  }

  return matches[0];
}
