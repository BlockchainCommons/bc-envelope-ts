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
import { taggedValue, CborDate } from "@blockchaincommons/dcbor";
import { CONTENT, NOTE, DATE } from "@blockchaincommons/known-values";

import { Envelope } from "../base/envelope";
import { type ToEnvelope, type EnvelopeInput } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
import { decodeTaggedId } from "./tagged-id";
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
  private readonly _date: Date | undefined;

  private constructor(content: T, id: ARID, note = "", date?: Date) {
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
   * Adds a date to the event.
   */
  withDate(date: Date): Event<T> {
    return new Event(this._content, this._id, this._note, date);
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
   * Returns the date attached to the event, if any.
   */
  get date(): Date | undefined {
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
    // Wrap the **tagged** ARID inside the event tag — mirrors the reference
    // `CBOR::to_tagged_value(TAG_EVENT, event.id)` which dispatches
    // via `From<ARID> for CBOR` (the tagged form). See request.ts
    // for the same fix and rationale.
    const taggedArid = taggedValue(TAG_EVENT, this._id.toCbor());
    const contentEnvelope = Envelope.from(this._content);

    let envelope = Envelope.leaf(taggedArid).addAssertion(CONTENT, contentEnvelope);

    if (this._note !== "") {
      envelope = envelope.addAssertion(NOTE, this._note);
    }

    if (this._date !== undefined) {
      // Pass a tagged-CBOR Date (tag 1); mirrors the reference
      // `Envelope::add_assertion(DATE, self.date)`. The earlier port
      // emitted an ISO 8601 string here.
      envelope = envelope.addAssertion(DATE, CborDate.fromDate(this._date));
    }

    return envelope;
  }

  /**
   * Creates an event from an envelope.
   *
   * @typeParam T - The type to extract the content as
   *
   * @throws EnvelopeError with code `General`.
   */
  static fromEnvelope<T extends EnvelopeInput>(
    envelope: Envelope,
    contentExtractor: (env: Envelope) => T,
  ): Event<T> {
    // `NonexistentPredicate` when there is no content; the extractor's failure is `General`.
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

    // The subject is TAG_EVENT(ARID); `NotLeaf` / `Cbor` when it is not.
    const id = decodeTaggedId(envelope, TAG_EVENT.value);

    // A `'note'` must be text and a `'date'` a tag-1 date when present (`Cbor` otherwise).
    const note = envelope.optionalObjectForPredicate(NOTE)?.expectString() ?? "";
    const date = envelope.optionalObjectForPredicate(DATE)?.expectDate();

    return new Event(content, id, note, date);
  }

  /**
   * Returns a string representation of the event.
   */
  toString(): string {
    return `Event(${this.summary()})`;
  }

  /**
   * Checks equality with another event.
   */
  equals(other: Event<T>): boolean {
    return (
      this._id.equals(other._id) &&
      this._note === other._note &&
      this._date?.getTime() === other._date?.getTime()
    );
  }
}
