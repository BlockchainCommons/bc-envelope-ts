/**
 * Differential suite (Phase 1.3): every corpus recipe through the frozen
 * baseline bundle and the working tree; outcomes must be identical except
 * for enumerated tombstones.
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
  type Recipe,
} from "./vectors/recipes";
import { baselineDeps, currentDeps } from "./vectors/deps";

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE_SHA256 = "26ea50fb38fe94016bec0deaf0ab0e2fb647061bf3930c6e7f99e3495905e676";

/** Tombstones: the only allowed differences, each a recorded decision. */
const TOMBSTONES: {
  id: string;
  landed: boolean;
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
];

const DATE = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/;
const DATE_G = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/g;

/** `# tag(200) envelope` → `# tag(200)` on every annotated-hex line. */
const stripTagNames = (s: string): string => s.replace(/# tag\((\d+)\)[^\n]*/g, "# tag($1)");

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
      for (const recipe of gen()) {
        n++;
        const a = materialize(baseline, recipe);
        const b = materialize(current, recipe);
        const tomb = TOMBSTONES.find((t) => t.matches(recipe, a, b));
        if (a !== b && tomb?.landed !== true)
          diffs.push(`${recipeName(recipe)}: ${a.slice(0, 120)} !== ${b.slice(0, 120)}`);
      }
      expect(n).toBeGreaterThan(0);
      expect(diffs).toEqual([]);
    });
  }
});
