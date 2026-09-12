/**
 * Edge Extension for Gordian Envelope (BCR-2026-003)
 *
 * Provides functionality for creating and managing edge envelopes that
 * represent verifiable relationships between entities. An edge envelope
 * contains three required assertions:
 * - `'isA'`: The type of relationship
 * - `'source'`: The source entity
 * - `'target'`: The target entity
 *
 * Edges may optionally be wrapped and signed. When accessing edge properties,
 * the implementation handles both wrapped (signed) and unwrapped edges
 * transparently.
 *
 * @module edge
 */

import { type Envelope } from "../base/envelope";
import { type Digest } from "../base/digest";
import { EnvelopeError } from "../base/error";
import {
  EDGE,
  IS_A,
  KNOWN_VALUE_CODEPOINTS,
  SOURCE,
  TARGET,
} from "@blockchaincommons/known-values";

// -------------------------------------------------------------------
// Edges Container
// -------------------------------------------------------------------

/**
 * A container for edge envelopes on a document.
 *
 * `Edges` stores pre-constructed edge envelopes keyed by their digest,
 * mirroring the `Attachments` container but for edges as defined in
 * BCR-2026-003.
 *
 */
export class Edges {
  private readonly _envelopes: Map<string, Envelope>;

  /**
   * Creates a new empty edges container.
   */
  constructor() {
    this._envelopes = new Map();
  }

  /**
   * Adds a pre-constructed edge envelope.
   *
   * @param edgeEnvelope - The edge envelope to add
   */
  add(edgeEnvelope: Envelope): void {
    const digest = edgeEnvelope.digest();
    this._envelopes.set(digest.toHex(), edgeEnvelope);
  }

  /**
   * Retrieves an edge by its digest.
   *
   * @param digest - The digest of the edge to retrieve
   * @returns The edge envelope if found, or undefined
   */
  get(digest: Digest): Envelope | undefined {
    return this._envelopes.get(digest.toHex());
  }

  /**
   * Removes an edge by its digest.
   *
   * @param digest - The digest of the edge to remove
   * @returns The removed edge envelope if found, or undefined
   */
  remove(digest: Digest): Envelope | undefined {
    const key = digest.toHex();
    const envelope = this._envelopes.get(key);
    this._envelopes.delete(key);
    return envelope;
  }

  /**
   * Removes all edges from the container.
   */
  clear(): void {
    this._envelopes.clear();
  }

  /** How many edges are stored. */
  get size(): number {
    return this._envelopes.size;
  }

  /** The stored edge envelopes. */
  [Symbol.iterator](): IterableIterator<Envelope> {
    return this._envelopes.values();
  }
  /**
   * Check equality with another Edges container.
   */
  equals(other: Edges): boolean {
    if (this._envelopes.size !== other._envelopes.size) return false;
    for (const [key] of this._envelopes) {
      if (!other._envelopes.has(key)) return false;
    }
    return true;
  }

  /**
   * Adds all edges as `'edge'` assertion envelopes to the given envelope.
   *
   * @param envelope - The envelope to add edges to
   * @returns A new envelope with all edges added as assertions
   */
  addToEnvelope(envelope: Envelope): Envelope {
    let result = envelope;
    for (const edgeEnvelope of this._envelopes.values()) {
      result = result.addAssertion(EDGE, edgeEnvelope);
    }
    return result;
  }

  /**
   * Extracts edges from an envelope's `'edge'` assertions.
   *
   * @param envelope - The envelope to extract edges from
   * @returns A new Edges container with the envelope's edges
   */
  static fromEnvelope(envelope: Envelope): Edges {
    const result = new Edges();
    for (const edge of edges(envelope)) {
      result._envelopes.set(edge.digest().toHex(), edge);
    }
    return result;
  }
}

// -------------------------------------------------------------------
// Edgeable Interface
// -------------------------------------------------------------------

/**
 * A type that carries edges (the reference's `Edgeable` trait); XID
 * documents implement it.
 */
export interface Edgeable {
  /** The edges container. */
  edges(): Edges;
  /** The edges container, for mutation. */
  edgesMut(): Edges;
  /** Adds a pre-constructed edge envelope. */
  addEdge(edgeEnvelope: Envelope): void;
  /** The edge with `digest`, or `undefined`. */
  getEdge(digest: Digest): Envelope | undefined;
  /** Removes and returns the edge with `digest`, or `undefined`. */
  removeEdge(digest: Digest): Envelope | undefined;
  /** Removes every edge. */
  clearEdges(): void;
  /** `true` when there is at least one edge. */
  hasEdges(): boolean;
}

// -------------------------------------------------------------------
// Envelope Prototype Methods
// -------------------------------------------------------------------

/**
 * Returns a new envelope with an added `'edge': <edge>` assertion.
 *
 */
export function addEdgeEnvelope(envelope: Envelope, edge: Envelope): Envelope {
  return envelope.addAssertion(EDGE, edge);
}

/**
 * Returns all edge object envelopes (assertions with predicate `'edge'`).
 *
 */
export function edges(envelope: Envelope): Envelope[] {
  return envelope.objectsForPredicate(EDGE);
}

/**
 * Validates an edge envelope's structure per BCR-2026-003.
 *
 * An edge may be wrapped (signed) or unwrapped. The inner envelope
 * must have exactly three assertion predicates: `'isA'`, `'source'`,
 * and `'target'`. No other assertions are permitted on the edge
 * subject. Mirrors the reference `Envelope::validate_edge`
 *
 * @throws {EnvelopeError} If a required predicate is missing or
 *   duplicated, or if any other assertion is present
 *   (`edgeUnexpectedAssertion`).
 */
export function validateEdge(envelope: Envelope): void {
  const inner = envelope.subject().isWrapped() ? envelope.subject().unwrap() : envelope;

  let seenIsA = false;
  let seenSource = false;
  let seenTarget = false;

  for (const assertion of inner.assertions()) {
    const predicateEnv = assertion.expectPredicate();
    const kv = predicateEnv.asKnownValue();
    if (kv === undefined) {
      // the reference: `try_known_value().map_err(|_| EdgeUnexpectedAssertion)`.
      throw EnvelopeError.edgeUnexpectedAssertion();
    }
    const raw = kv.value;
    switch (raw) {
      case KNOWN_VALUE_CODEPOINTS.IS_A:
        if (seenIsA) {
          throw EnvelopeError.edgeDuplicateIsA();
        }
        seenIsA = true;
        break;
      case KNOWN_VALUE_CODEPOINTS.SOURCE:
        if (seenSource) {
          throw EnvelopeError.edgeDuplicateSource();
        }
        seenSource = true;
        break;
      case KNOWN_VALUE_CODEPOINTS.TARGET:
        if (seenTarget) {
          throw EnvelopeError.edgeDuplicateTarget();
        }
        seenTarget = true;
        break;
      default:
        // Any predicate other than the three required ones is rejected.
        throw EnvelopeError.edgeUnexpectedAssertion();
    }
  }

  if (!seenIsA) {
    throw EnvelopeError.edgeMissingIsA();
  }
  if (!seenSource) {
    throw EnvelopeError.edgeMissingSource();
  }
  if (!seenTarget) {
    throw EnvelopeError.edgeMissingTarget();
  }
}

/**
 * Extracts the `'isA'` assertion object from an edge envelope.
 *
 */
export function edgeIsA(envelope: Envelope): Envelope {
  const inner = envelope.subject().isWrapped() ? envelope.subject().unwrap() : envelope;
  return inner.objectForPredicate(IS_A);
}

/**
 * Extracts the `'source'` assertion object from an edge envelope.
 *
 */
export function edgeSource(envelope: Envelope): Envelope {
  const inner = envelope.subject().isWrapped() ? envelope.subject().unwrap() : envelope;
  return inner.objectForPredicate(SOURCE);
}

/**
 * Extracts the `'target'` assertion object from an edge envelope.
 *
 */
export function edgeTarget(envelope: Envelope): Envelope {
  const inner = envelope.subject().isWrapped() ? envelope.subject().unwrap() : envelope;
  return inner.objectForPredicate(TARGET);
}

/**
 * Extracts the edge's subject identifier (the inner envelope's subject).
 *
 */
export function edgeSubject(envelope: Envelope): Envelope {
  const inner = envelope.subject().isWrapped() ? envelope.subject().unwrap() : envelope;
  return inner.subject();
}

/** Which edges `edgesMatching` selects; every given field must match (by digest). */
export interface EdgeFilter {
  /** Only edges whose `'isA'` is equivalent to this. */
  isA?: Envelope;
  /** Only edges whose `'source'` is equivalent to this. */
  source?: Envelope;
  /** Only edges whose `'target'` is equivalent to this. */
  target?: Envelope;
  /** Only edges whose subject is equivalent to this. */
  subject?: Envelope;
}

/**
 * The edges matching every field of `filter` (all of them when it is empty).
 *
 * @param filter - The `'isA'`, `'source'`, `'target'` and subject to match
 * @returns Array of matching edge envelopes
 */
export function edgesMatching(envelope: Envelope, filter: EdgeFilter = {}): Envelope[] {
  const { isA, source, target, subject } = filter;
  const allEdges = edges(envelope);
  const matching: Envelope[] = [];

  for (const edge of allEdges) {
    if (isA !== undefined) {
      try {
        const isAValue = edgeIsA(edge);
        if (!isAValue.isEquivalentTo(isA)) {
          continue;
        }
      } catch {
        continue;
      }
    }

    if (source !== undefined) {
      try {
        const sourceValue = edgeSource(edge);
        if (!sourceValue.isEquivalentTo(source)) {
          continue;
        }
      } catch {
        continue;
      }
    }

    if (target !== undefined) {
      try {
        const targetValue = edgeTarget(edge);
        if (!targetValue.isEquivalentTo(target)) {
          continue;
        }
      } catch {
        continue;
      }
    }

    if (subject !== undefined) {
      try {
        const subjectValue = edgeSubject(edge);
        if (!subjectValue.isEquivalentTo(subject)) {
          continue;
        }
      } catch {
        continue;
      }
    }

    matching.push(edge);
  }

  return matching;
}
