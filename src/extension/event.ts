/**
 * Event type for notifications and messages.
 *
 * An Event represents a notification or message that doesn't expect a
 * response.
 *
 * Unlike Request and Response which form a pair, an Event is a
 * standalone message that can be used for broadcasting information, logging,
 * or publishing notifications. Events are used when the sender does not expect
 * or require a response from the recipients.
 *
 * Each event contains:
 * - Content of a generic type that holds the event payload
 * - A unique identifier (ARID) for tracking and correlation
 * - Optional metadata like a note and timestamp
 *
 * When serialized to an envelope, events are tagged with EVENT tag.
 */

import { type ARID } from "@blockchaincommons/components";
import { TAG_EVENT } from "@blockchaincommons/tags";
import { taggedValue, CborDate, expectText } from "@blockchaincommons/dcbor";
import { CONTENT, NOTE, DATE } from "@blockchaincommons/known-values";

import { Envelope } from "../base/envelope";
import { type ToEnvelope, type EnvelopeInput } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
import { decodeTaggedId } from "./tagged-id";
import { datesEqual } from "./request";
import { formatFlat } from "../format/notation.js";

/**
 * An Event represents a notification or message that doesn't expect a response.
 *
 * @example
 * ```typescript
 * import { Event, ARID } from '@blockchaincommons/envelope';
 *
 * // Create a status update event
 * const eventId = ARID.new();
 * const timestamp = new Date("2024-08-15T13:45:30Z");
 *
 * const statusEvent = Event.from("System online", eventId)
 *   .withNote("Regular status update")
 *   .withDate(timestamp);
 *
 * // Convert to an envelope for transmission
 * const envelope = statusEvent.toEnvelope();
 * ```
 *
 * @typeParam T - The type of content this event carries
 */
export class Event<T extends EnvelopeInput> implements ToEnvelope {
  private readonly _content: T;
  private readonly _id: ARID;
  private readonly _note: string;
  private readonly _date: CborDate | undefined;

  private constructor(content: T, id: ARID, note = "", date?: CborDate) {
    this._content = content;
    this._id = id;
    this._note = note;
    this._date = date;
  }

  /**
   * Creates a new event with the specified content and ID.
   */
  static from<T extends EnvelopeInput>(content: T, id: ARID): Event<T> {
    return new Event(content, id);
  }

  /**
   * Returns a human-readable summary of the event.
   */
  summary(): string {
    const contentEnvelope = Envelope.from(this._content);
    return `id: ${this._id.shortDescription()}, content: ${formatFlat(contentEnvelope)}`;
  }

  /**
   * Adds a note to the event.
   */
  withNote(note: string): Event<T> {
    // Builders return a new event; the receiver is unchanged.
    return new Event(this._content, this._id, note, this._date);
  }

  /**
   * Adds a date to the event: a `CborDate` is kept as it is (the
   * reference's `Date`, exact to the nanosecond); a JavaScript `Date`
   * converts through `CborDate.fromDate`.
   */
  withDate(date: Date | CborDate): Event<T> {
    return new Event(
      this._content,
      this._id,
      this._note,
      date instanceof Date ? CborDate.fromDate(date) : date,
    );
  }

  /**
   * Returns the content of the event.
   */
  get content(): T {
    return this._content;
  }

  /**
   * Returns the unique identifier (ARID) of the event.
   */
  get id(): ARID {
    return this._id;
  }

  /**
   * Returns the note attached to the event, or an empty string if none exists.
   */
  get note(): string {
    return this._note;
  }

  /**
   * The date attached to the event as a JavaScript `Date` (millisecond
   * precision), if any; `cborDate` is the exact value.
   */
  get date(): Date | undefined {
    return this._date?.toDate();
  }

  /** The date attached to the event, if any: the stored `CborDate`, exact as decoded or given. */
  get cborDate(): CborDate | undefined {
    return this._date;
  }

  /**
   * Converts the event to an envelope.
   *
   * The envelope's subject is the event's ID tagged with TAG_EVENT,
   * and assertions include the event's content, note (if not empty), and date
   * (if present).
   */
  toEnvelope(): Envelope {
    // The subject is the tagged ARID inside the event tag, as the
    // reference's `CBOR::to_tagged_value(TAG_EVENT, event.id)` builds it;
    // the outer tag is the bare number, as the reference's constant is.
    const taggedArid = taggedValue(TAG_EVENT.value, this._id.toCbor());
    const contentEnvelope = Envelope.from(this._content);

    let envelope = Envelope.leaf(taggedArid).addAssertion(CONTENT, contentEnvelope);

    if (this._note !== "") {
      envelope = envelope.addAssertion(NOTE, this._note);
    }

    if (this._date !== undefined) {
      // The stored date's own tag-1 encoding, as the reference's
      // `add_optional_assertion(DATE, self.date)` dispatches through `Date → CBOR`.
      envelope = envelope.addAssertion(DATE, this._date);
    }

    return envelope;
  }

  /**
   * Reads an event from an envelope (the reference's
   * `Event::try_from(envelope)`): the `'content'` object through
   * `contentExtractor`, the subject as `TAG_EVENT(ARID)`, the `'note'` and
   * `'date'` objects by subject extraction.
   *
   * @typeParam T - The type to extract the content as
   *
   * @throws EnvelopeError `NonexistentPredicate` when there is no content; `General`
   *   (`Failed to parse content`) when the extractor fails; `NotLeaf` / `Cbor` when the
   *   subject is not `TAG_EVENT(ARID)`; `Cbor` / `InvalidFormat` when a `'note'` is not
   *   text or a `'date'` is not a tag-1 date
   */
  static fromEnvelope<T extends EnvelopeInput>(
    envelope: Envelope,
    contentExtractor: (env: Envelope) => T,
  ): Event<T> {
    const contentEnvelope = envelope.objectForPredicate(CONTENT);
    let content: T;
    try {
      content = contentExtractor(contentEnvelope);
    } catch (error) {
      throw EnvelopeError.general(
        "Failed to parse content",
        error instanceof Error ? error : undefined,
      );
    }

    const id = decodeTaggedId(envelope, TAG_EVENT.value);

    const note = envelope.objectForPredicateOr(NOTE, expectText, "");
    const date = envelope.optionalObjectForPredicateAs(DATE, (cbor) =>
      CborDate.fromTaggedCbor(cbor),
    );

    return new Event(content, id, note, date);
  }

  /**
   * Returns a string representation of the event.
   */
  toString(): string {
    return `Event(${this.summary()})`;
  }

  /**
   * Checks equality with another event: the content (as envelopes), the id,
   * the note and the exact date must all be equal (the reference's derived
   * `PartialEq`).
   */
  equals(other: Event<T>): boolean {
    return (
      this._id.equals(other._id) &&
      this._note === other._note &&
      datesEqual(this._date, other._date) &&
      Envelope.from(this._content).digest().equals(Envelope.from(other._content).digest())
    );
  }
}
