// Mermaid diagram formatting for Gordian Envelopes.
//
// This module provides functionality for creating Mermaid flowchart diagrams
// of envelopes, which is useful for visualizing the hierarchical structure
// of complex envelopes in documentation and debugging.
//
// The Mermaid format displays each component of an envelope as nodes in a
// flowchart graph, with edges showing relationships between components.

import { type Envelope } from "../base/envelope";
import { EdgeType, edgeLabel } from "../base/envelope";
import { type Digest, type DigestProvider, digestKeys } from "../base/digest";
import { summary } from "./envelope-summary.js";
import type { FormatContextOpt } from "./format-context";

// ============================================================================
// Mermaid Types
// ============================================================================

/** The orientation of the Mermaid flowchart. */
export const MermaidOrientation = {
  /** `LR`. */
  LeftToRight: "LR",
  /** `TB`. */
  TopToBottom: "TB",
  /** `RL`. */
  RightToLeft: "RL",
  /** `BT`. */
  BottomToTop: "BT",
} as const;
/** One of the `MermaidOrientation` values. */
export type MermaidOrientation = (typeof MermaidOrientation)[keyof typeof MermaidOrientation];

/** The theme for the Mermaid flowchart. */
export const MermaidTheme = {
  /** Mermaid's default theme. */
  Default: "default",
  /** Greyscale. */
  Neutral: "neutral",
  /** Dark background. */
  Dark: "dark",
  /** Green tones. */
  Forest: "forest",
  /** The customisable base theme. */
  Base: "base",
} as const;
/** One of the `MermaidTheme` values. */
export type MermaidTheme = (typeof MermaidTheme)[keyof typeof MermaidTheme];

/** Options for Mermaid diagram formatting. */
export interface MermaidFormatOptions {
  /** Omit the `NODE` elements (the subject and assertions attach to the parent). */
  hideNodes?: boolean;
  /** No colours on nodes and links. */
  monochrome?: boolean;
  /** The Mermaid theme (`default` by default). */
  theme?: MermaidTheme;
  /** The flowchart direction (`LR` by default). */
  orientation?: MermaidOrientation;
  /** Elements whose digest is in here get a thicker border. */
  highlightingTarget?: Iterable<Digest | DigestProvider>;
  /** Names for tags and known values; the global context by default, `"none"` for codepoints. */
  context?: FormatContextOpt;
}

// ============================================================================
// Internal Types
// ============================================================================

/** Represents an element in the Mermaid diagram */
interface MermaidElement {
  id: number;
  level: number;
  envelope: Envelope;
  incomingEdge: EdgeType;
  showId: boolean;
  isHighlighted: boolean;
  parent: MermaidElement | undefined;
}

/** A Mermaid flowchart of the envelope's digest tree. */
export function mermaidFormat(envelope: Envelope, opts: MermaidFormatOptions = {}): string {
  const hideNodes = opts.hideNodes ?? false;
  const monochrome = opts.monochrome ?? false;
  const theme = opts.theme ?? MermaidTheme.Default;
  const orientation = opts.orientation ?? MermaidOrientation.LeftToRight;
  const highlighted = digestKeys(opts.highlightingTarget);
  const context = opts.context ?? "global";

  const elements: MermaidElement[] = [];
  let nextId = 0;

  // Build a stack to track parent elements during traversal
  const parentStack: MermaidElement[] = [];

  // Walk the envelope and collect elements
  envelope.walk(hideNodes, undefined, (envelope, level, incomingEdge, _state) => {
    const id = nextId++;

    // Find the parent (last element at level - 1)
    let parent: MermaidElement | undefined;
    while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= level) {
      parentStack.pop();
    }
    if (parentStack.length > 0) {
      parent = parentStack[parentStack.length - 1];
    }

    const isHighlighted = highlighted.has(envelope.digest().toHex());

    const elem: MermaidElement = {
      id,
      level,
      envelope,
      incomingEdge,
      showId: !hideNodes,
      isHighlighted,
      parent,
    };

    elements.push(elem);
    parentStack.push(elem);

    return [undefined, false];
  });

  // Track which element IDs have been formatted
  const formattedIds = new Set<number>();

  // Build output lines
  const lines: string[] = [
    `%%{ init: { 'theme': '${theme}', 'flowchart': { 'curve': 'basis' } } }%%`,
    `graph ${orientation}`,
  ];

  const nodeStyles: string[] = [];
  const linkStyles: string[] = [];
  let linkIndex = 0;

  for (const element of elements) {
    const indent = "    ".repeat(element.level);

    let content: string;
    if (element.parent !== undefined) {
      // Format as edge
      const thisLinkStyles: string[] = [];

      if (!monochrome) {
        const strokeColor = linkStrokeColor(element.incomingEdge);
        if (strokeColor !== undefined) {
          thisLinkStyles.push(`stroke:${strokeColor}`);
        }
      }

      if (element.isHighlighted && element.parent.isHighlighted) {
        thisLinkStyles.push("stroke-width:4px");
      } else {
        thisLinkStyles.push("stroke-width:2px");
      }

      if (thisLinkStyles.length > 0) {
        linkStyles.push(`linkStyle ${linkIndex} ${thisLinkStyles.join(",")}`);
      }
      linkIndex++;

      content = formatEdge(element, formattedIds, context);
    } else {
      // Format as node (root)
      content = formatNode(element, formattedIds, context);
    }

    // Node styles
    const thisNodeStyles: string[] = [];
    if (!monochrome) {
      const strokeColor = nodeColor(element.envelope);
      thisNodeStyles.push(`stroke:${strokeColor}`);
    }

    if (element.isHighlighted) {
      thisNodeStyles.push("stroke-width:6px");
    } else {
      thisNodeStyles.push("stroke-width:4px");
    }

    if (thisNodeStyles.length > 0) {
      nodeStyles.push(`style ${element.id} ${thisNodeStyles.join(",")}`);
    }

    lines.push(`${indent}${content}`);
  }

  // Add styles
  for (const style of nodeStyles) {
    lines.push(style);
  }
  for (const style of linkStyles) {
    lines.push(style);
  }

  return lines.join("\n");
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Format a node element */
const formatNode = (
  element: MermaidElement,
  formattedIds: Set<number>,
  context: FormatContextOpt,
): string => {
  if (!formattedIds.has(element.id)) {
    formattedIds.add(element.id);

    const lines: string[] = [];

    // Get summary
    lines.push(summary(element.envelope, { maxLength: 20, context }).replace(/"/g, "&quot;"));

    // Add digest if showing IDs
    if (element.showId) {
      const id = element.envelope.digest().shortDescription();
      lines.push(id);
    }

    const content = lines.join("<br>");
    const [frameL, frameR] = mermaidFrame(element.envelope);
    return `${element.id}${frameL}"${content}"${frameR}`;
  } else {
    return `${element.id}`;
  }
};

/** Format an edge element */
const formatEdge = (
  element: MermaidElement,
  formattedIds: Set<number>,
  context: FormatContextOpt,
): string => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Parent is always defined for edge elements
  const parent = element.parent!;
  const label = edgeLabel(element.incomingEdge);
  const arrow = label !== undefined ? `-- ${label} -->` : "-->";

  return `${formatNode(parent, formattedIds, context)} ${arrow} ${formatNode(element, formattedIds, context)}`;
};

/** Get the Mermaid frame characters for an envelope type */
const mermaidFrame = (envelope: Envelope): [string, string] => {
  const c = envelope.case;

  switch (c.type) {
    case "node":
      return ["((", "))"];
    case "leaf":
      return ["[", "]"];
    case "wrapped":
      return ["[/", "\\]"];
    case "assertion":
      return ["([", "])"];
    case "elided":
      return ["{{", "}}"];
    case "knownValue":
      return ["[/", "/]"];
    case "encrypted":
      return [">", "]"];
    case "compressed":
      return ["[[", "]]"];
    default:
      return ["[", "]"];
  }
};

/** Get the node color for an envelope type */
const nodeColor = (envelope: Envelope): string => {
  const c = envelope.case;

  switch (c.type) {
    case "node":
      return "red";
    case "leaf":
      return "teal";
    case "wrapped":
      return "blue";
    case "assertion":
      return "green";
    case "elided":
      return "gray";
    case "knownValue":
      return "goldenrod";
    case "encrypted":
      return "coral";
    case "compressed":
      return "purple";
    default:
      return "gray";
  }
};

/** Get the link stroke color for an edge type */
const linkStrokeColor = (edgeType: EdgeType): string | undefined => {
  switch (edgeType) {
    case EdgeType.Subject:
      return "red";
    case EdgeType.Content:
      return "blue";
    case EdgeType.Predicate:
      return "cyan";
    case EdgeType.Object:
      return "magenta";
    case EdgeType.None:
    case EdgeType.Assertion:
      return undefined;
  }
};
