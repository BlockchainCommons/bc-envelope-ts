import { type Envelope } from "../base/envelope";
import { type EdgeType, edgeLabel } from "../base/envelope";
import type { FormatContextOpt } from "./format-context";
import { type Digest, type DigestProvider, digestKeys } from "../base/digest";
import { summary } from "./envelope-summary.js";

// ============================================================================
// DigestDisplayFormat - Enum for digest display formatting
// ============================================================================

/**
 * Specifies the format for displaying envelope digests in tree output.
 *
 */
export const DigestDisplayFormat = {
  /**
   * Short format: hex-encoded first 4 bytes of the digest (8 chars),
   * matching the reference `Digest::short_description`.
   * This is the default format.
   */
  Short: "short",

  /**
   * Full format: complete 64 hex character digest.
   */
  Full: "full",

  /**
   * UR format: digest encoded as a UR string.
   */
  UR: "ur",
} as const;
/** One of the `DigestDisplayFormat` values. */
export type DigestDisplayFormat = (typeof DigestDisplayFormat)[keyof typeof DigestDisplayFormat];

// Tree formatting for Gordian Envelopes.
//
// This module provides functionality for creating textual tree
// representations of envelopes, which is useful for debugging and visualizing
// the hierarchical structure of complex envelopes.
//
// The tree format displays each component of an envelope (subject and
// assertions) as nodes in a tree, making it easy to understand the
// hierarchical structure of nested envelopes. Each node includes:
//
// - The first 8 characters of the element's digest (for easy reference)
// - The type of the element (NODE, ASSERTION, ELIDED, etc.)
// - The content of the element (for leaf nodes)

/** Options for tree formatting */
export interface TreeFormatOptions {
  /** Omit the `NODE` lines (the subject and assertions attach to the parent). */
  hideNodes?: boolean;
  /** Elements whose digest is in here are marked with `*`. */
  highlightingTarget?: Iterable<Digest | DigestProvider>;
  /** How each element's digest is shown: `short` (8 hex chars), `full` (64) or `ur`. */
  digestDisplay?: DigestDisplayFormat | "short" | "full" | "ur";
  /** Names for tags and known values; the global context by default, `"none"` for codepoints. */
  context?: FormatContextOpt;
}

/** Represents an element in the tree representation */
interface TreeElement {
  /** Indentation level */
  level: number;
  /** The envelope element */
  envelope: Envelope;
  /** Type of incoming edge */
  incomingEdge: EdgeType;
  /** Whether to show the digest ID */
  showId: boolean;
  /** Whether this element is highlighted */
  isHighlighted: boolean;
}

/** The digest as `short` (8 hex chars), `full` (64) or `ur` (`ur:digest/…`). */
export function shortId(envelope: Envelope, format: "short" | "full" | "ur" = "short"): string {
  const digest = envelope.digest();
  if (format === "full") {
    return digest.toHex();
  }
  if (format === "ur") {
    return digest.toUR().toString();
  }
  return digest.shortDescription();
}

/**
 * The tree rendering: one line per element, indented by depth, as
 *
 *   `[*]<short_id> [edge_label] <summary>`
 *
 * Summaries are rendered with a format context, so known values appear
 * under their registered names (`'isA'`, `'note'`) rather than as raw
 * numbers. The context defaults to the global one (see
 * {@link getGlobalFormatContext}); override it per call with
 * {@link TreeFormatOptions.context}.
 */
export function treeFormat(envelope: Envelope, options: TreeFormatOptions = {}): string {
  const hideNodes = options.hideNodes ?? false;
  const highlighted = digestKeys(options.highlightingTarget);
  const digestDisplay = options.digestDisplay ?? "short";
  const context = options.context ?? "global";

  const elements: TreeElement[] = [];

  envelope.walk(hideNodes, undefined, (envelope, level, incomingEdge, _state) => {
    const isHighlighted = highlighted.has(envelope.digest().toHex());

    elements.push({
      level,
      envelope,
      incomingEdge,
      showId: !hideNodes,
      isHighlighted,
    });

    return [undefined, false];
  });

  // Format each element as a line
  const lines = elements.map((elem) => {
    const parts: string[] = [];

    if (elem.isHighlighted) {
      parts.push("*");
    }

    if (elem.showId) {
      parts.push(shortId(elem.envelope, digestDisplay));
    }

    const label = edgeLabel(elem.incomingEdge);
    if (label !== undefined && label !== "") {
      parts.push(label);
    }

    parts.push(summary(elem.envelope, { context }));

    const line = parts.join(" ");
    const indent = " ".repeat(elem.level * 4);
    return indent + line;
  });

  return lines.join("\n");
}
