/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 *
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

import { ARID } from "@blockchaincommons/components";
import { EVENT as TAG_EVENT } from "@blockchaincommons/tags";
import { taggedValue, CborDate, expectTaggedContent } from "@blockchaincommons/dcbor";
import { CONTENT, NOTE, DATE } from "@blockchaincommons/known-values";

import { Envelope } from "../base/envelope";
import { type ToEnvelope, type EnvelopeInput } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
import { formatFlat } from "../format/notation.js";

/**
 * Interface that defines the behavior of an event.
 */
export interface EventBehavior<T extends EnvelopeInput> {
  /**
   * Adds a note to the event.
   */
  withNote(note: string): Event<T>;

  /**
   * Adds a date to the event.
   */
  withDate(date: Date): Event<T>;

  /**
   * Returns the content of the event.
   */
  readonly content: T;

  /**
   * Returns the unique identifier (ARID) of the event.
   */
  readonly id: ARID;

  /**
   * Returns the note attached to the event, or an empty string if none exists.
   */
  readonly note: string;

  /**
   * Returns the date attached to the event, if any.
   */
  readonly date: Date | undefined;

  /**
   * Converts the event to an envelope.
   */
  toEnvelope(): Envelope;
}

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
export class Event<T extends EnvelopeInput> implements EventBehavior<T>, ToEnvelope {
  private readonly _content: T;
  private readonly _id: ARID;
  private _note: string;
  private _date: Date | undefined;

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

  // EventBehavior implementation

  withNote(note: string): Event<T> {
    this._note = note;
    return this;
  }

  withDate(date: Date): Event<T> {
    this._date = date;
    return this;
  }

  get content(): T {
    return this._content;
  }

  get id(): ARID {
    return this._id;
  }

  get note(): string {
    return this._note;
  }

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
    // Wrap the **tagged** ARID inside the event tag — mirrors Rust
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
      // Pass a tagged-CBOR Date (tag 1); mirrors Rust
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
   */
  static fromEnvelope<T extends EnvelopeInput>(
    envelope: Envelope,
    contentExtractor: (env: Envelope) => T,
  ): Event<T> {
    // Extract content
    const contentEnvelope = envelope.objectForPredicate(CONTENT);
    if (contentEnvelope === undefined) {
      throw EnvelopeError.general("Event envelope missing content");
    }
    const content = contentExtractor(contentEnvelope);

    // Extract the ARID from the subject
    // Subject is TAG_EVENT(ARID_bytes)
    const subject = envelope.subject();
    const leaf = subject.asLeaf();
    if (leaf === undefined) {
      throw EnvelopeError.general("Event envelope has invalid subject");
    }

    // The subject is TAG_EVENT(tag_40012(arid_bytes)) — see
    // `toEnvelope` above. Extract the inner tagged-ARID and decode.
    const aridCbor = expectTaggedContent(leaf, TAG_EVENT.value);
    const id = ARID.fromCbor(aridCbor);

    // Extract optional note
    let note = "";
    try {
      const noteObj = envelope.objectForPredicate(NOTE);
      if (noteObj !== undefined) {
        note = noteObj.asText() ?? "";
      }
    } catch {
      // Note is optional
    }

    // Extract optional date — mirrors Rust
    // `extract_optional_object_for_predicate::<Date>(DATE)` (tag 1).
    let date: Date | undefined;
    try {
      const dateObj = envelope.objectForPredicate(DATE);
      if (dateObj !== undefined) {
        const leaf = dateObj.asLeaf();
        if (leaf !== undefined) {
          date = CborDate.fromTaggedCbor(leaf).toDate();
        } else {
          // Back-compat shim for legacy ISO-string producers.
          const dateStr = dateObj.asText();
          if (dateStr !== undefined) {
            date = new Date(dateStr);
          }
        }
      }
    } catch {
      // Date is optional
    }

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
