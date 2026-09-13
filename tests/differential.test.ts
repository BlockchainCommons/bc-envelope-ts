/**
 * Differential suite: every corpus recipe through the frozen baseline
 * bundle and the working tree; outcomes must be identical except for
 * enumerated tombstones.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import * as baselineMod from "./baseline/envelope-baseline.mjs";
import * as src from "../src/all.js";
import { categories } from "./corpus/corpus";
import {
  baselineAdapterFor,
  redesignedAdapterFor,
  materialize,
  recipeName,
  isBaselineSupported,
  type Recipe,
} from "./vectors/recipes";
import { baselineDeps, currentDeps } from "./vectors/deps";

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE_SHA256 = "d5347de6e6cec9b04d3d6344f7d43b1767047bfe9e5ef9b3046a600d5958543a";

/** Tombstones: the only allowed differences, each a recorded decision. */
const TOMBSTONES: {
  id: string;
  landed: boolean;
  /** For a pending tombstone: the exact number of rows it must cover today. */
  rowsBeforeLanding?: number;
  matches: (r: Recipe, baselineOutcome: string, currentOutcome: string) => boolean;
}[] = [
  {
    // W6: `Envelope.fromBytes` wraps CBOR decode failures in
    // `EnvelopeError("Cbor")` (cause: the CborError) like the rest of the
    // decode path; the baseline's `envelopeFromBytes` let CborError escape.
    id: "T1-fromBytes-wraps-cbor-error",
    landed: true,
    matches: (r, a, b) => r.e.k === "decode" && a === "throw:CborError" && b === "throw:CBOR",
  },
  {
    // W7 (D4): the global format context registers the BC tags in *its*
    // dcbor's global store, so annotated hex names tags (`# tag(200)
    // envelope`) as the reference does. Everything but the names is equal.
    id: "T2-annotated-hex-tag-names",
    landed: true,
    matches: (_r, a, b) => stripTagNames(a) === stripTagNames(b) && a !== b,
  },
  {
    // W7 (D4): dcbor's standard-tag summarisers are registered too, so a
    // tag-1 date leaf prints as `2022-07-11T04:00:00Z` rather than
    // `1(1657512000)`, as the reference does.
    id: "T3-date-summary",
    landed: true,
    matches: (_r, a, b) => {
      // Diagnostic notation keeps `1(…)` on both sides; formats summarise.
      const norm = (s: string): string =>
        stripTagNames(s)
          .replace(/1\(\d+\)/g, "")
          .replace(DATE_G, "");
      return a.includes("1(") && DATE.test(b) && norm(a) === norm(b);
    },
  },
  {
    // W7 (D4): the format context carries the functions and parameters
    // stores, so well-known ids print by name («add», ❰lhs❱) as the
    // reference does; the baseline printed the ids («1», ❰2❱).
    id: "T4-expression-names",
    landed: true,
    matches: (r, a, b) => {
      if (r.e.k !== "request" || typeof r.e.func !== "number") return false;
      const A = stripTagNames(a);
      const B = stripTagNames(b);
      return A !== B && A.replace(/«\d+»|❰\d+❱/g, "") === B.replace(/«\w+»|❰\w+❱/g, "");
    },
  },
  // ---- W1 (the frozen baseline keeps each defect) ----
  {
    // W1 (B2): `addAssertionEnvelope` dedupes by digest; the baseline appends.
    id: "T5-dedupe",
    landed: true,
    matches: (r, a, b) =>
      (r.e.k === "node" || r.e.k === "nodeEnv") &&
      (JSON.stringify(r.e).match(/"knows"/g)?.length ?? 0) >= 2 &&
      (a.match(/"knows": "Bob"/g)?.length ?? 0) > (b.match(/"knows": "Bob"/g)?.length ?? 0),
  },
  {
    // W1 (B3): a node whose subject is obscured decodes; the baseline rejects it.
    id: "T6-obscured-subject-decode",
    landed: true,
    matches: (r, a, b) =>
      r.e.k === "op" && r.e.op === "roundtrip" && a.startsWith("throw:") && !b.startsWith("throw:"),
  },
  {
    // W1 (B6): the assertion check runs before salting; the baseline salted a non-assertion.
    id: "T7-salt-check-order",
    landed: true,
    matches: (r, a, b) =>
      r.e.k === "op" &&
      r.e.op === "addAssertionEnvelope" &&
      r.e.salt === true &&
      !a.startsWith("throw:") &&
      b.startsWith("throw:"),
  },
  {
    // W1 (B4): a `Date` leaf is a tag-1 date; the baseline encoded an empty map.
    id: "T8-date-leaf",
    landed: true,
    matches: (r, a, b) => JSON.stringify(r.e).includes('"t":"date"') && a !== b,
  },
  {
    // W1 (B1): the sealed content key is the key's tagged CBOR; the baseline sealed raw bytes,
    // so it cannot open a reference-produced envelope.
    id: "T9-sealed-key",
    landed: true,
    matches: (r, a, b) => r.e.k === "recipientDecode" && a.startsWith("throw:") && a !== b,
  },
  {
    // W1 (B11): the global functions store seeds four functions; ids 5–15 print as numbers.
    id: "T10-function-seeding",
    landed: true,
    matches: (r, a, b) =>
      r.e.k === "request" && typeof r.e.func === "number" && r.e.func >= 5 && a !== b,
  },
  {
    // W2 (B7): the specific code where the baseline threw `General`.
    id: "T12-error-codes",
    landed: true,
    matches: (r, a, b) =>
      r.e.k === "op" && a === "throw:GENERAL" && b.startsWith("throw:") && b !== a,
  },
  {
    // 1.0.0-beta.2 (envelope review D3): text summaries truncate as the
    // reference does — the UTF-8 byte length decides, the cut keeps whole
    // characters — so a non-ASCII leaf's `summary` and mermaid label can gain
    // an ellipsis the baseline (UTF-16 units for both) did not print.
    id: "T13-summary-bytes",
    landed: true,
    // Whatever the recipe (a leaf, or a UR that decodes to one), the only
    // difference is an ellipsis in a summary or mermaid label.
    matches: (_r, a, b) =>
      a !== b && stripTagNames(a).replace(/…/g, "") === stripTagNames(b).replace(/…/g, ""),
  },
  {
    // dcbor 1.0.0-beta.2 (envelope review D3, diagnostic half): the
    // diagnostic line-breaking threshold counts UTF-8 bytes as the
    // reference's `diag.rs` does, so a group holding a non-ASCII string of
    // more than 20 bytes breaks over several lines where the baseline
    // (UTF-16 units) kept it on one. Only whitespace differs — beyond the
    // T13 differences the same non-ASCII leaf also shows.
    id: "T14-diagnostic-bytes",
    landed: true,
    matches: (_r, a, b) =>
      a !== b && /[\u0080-\uffff]/.test(b) && stripDifferences(a) === stripDifferences(b),
  },
];

const DATE = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/;
const DATE_G = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/g;

/** `# tag(200) envelope` → `# tag(200)` on every annotated-hex line. */
const stripTagNames = (s: string): string => s.replace(/# tag\((\d+)\)[^\n]*/g, "# tag($1)");

/** T13's differences (tag names, ellipses) and T14's (whitespace) removed. */
const stripDifferences = (s: string): string =>
  stripTagNames(s).replace(/…/g, "").replace(/\s+/g, "");

const baseline = baselineAdapterFor(baselineMod, await baselineDeps());
const current = redesignedAdapterFor(src, await currentDeps());

describe("differential: baseline vs working tree", () => {
  it("baseline bundle integrity", () => {
    const sha = createHash("sha256")
      .update(readFileSync(join(here, "baseline/envelope-baseline.mjs")))
      .digest("hex");
    expect(sha).toBe(BASELINE_SHA256);
  });
  for (const [name, gen] of Object.entries(categories)) {
    it(`category ${name}`, { timeout: 600_000 }, () => {
      let n = 0;
      const diffs: string[] = [];
      let skipped = 0;
      const pendingHits: Record<string, number> = {};
      for (const recipe of gen()) {
        if (!isBaselineSupported(recipe.e)) {
          skipped++;
          continue;
        }
        n++;
        const a = materialize(baseline, recipe);
        const b = materialize(current, recipe);
        if (a === b) continue;
        const tomb = TOMBSTONES.find((t) => t.matches(recipe, a, b));
        if (tomb === undefined)
          diffs.push(`${recipeName(recipe)}: ${a.slice(0, 120)} !== ${b.slice(0, 120)}`);
        else if (!tomb.landed) pendingHits[tomb.id] = (pendingHits[tomb.id] ?? 0) + 1;
      }
      expect(n + skipped).toBeGreaterThan(0);
      expect(diffs).toEqual([]);
      for (const t of TOMBSTONES)
        if (!t.landed && (pendingHits[t.id] ?? 0) !== 0)
          expect(pendingHits[t.id]).toBe(t.rowsBeforeLanding);
    });
  }
});
