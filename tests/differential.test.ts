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
  workingTreeAdapterFor,
  materialize,
  recipeName,
  isBaselineSupported,
  outputsFor,
  SEP,
  type Recipe,
} from "./vectors/recipes";
import { baselineDeps, currentDeps } from "./vectors/deps";

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE_SHA256 = "d5347de6e6cec9b04d3d6344f7d43b1767047bfe9e5ef9b3046a600d5958543a";

/**
 * The working tree renders a rejection as `throw:<Code>[<inner>]` where the
 * baseline printed `throw:<CODE>` (its codes in SCREAMING_SNAKE_CASE, a
 * foreign error by its class name). Codes are compared in the baseline's
 * spelling; the inner code is the working tree's alone.
 */
const normalizeCode = (outcome: string): string =>
  outcome.replace(
    /^throw:([A-Za-z]+)(\[[A-Za-z0-9]+\])?/,
    (_m, code: string) => `throw:${code.replace(/(?<=[a-z0-9])(?=[A-Z])/g, "_").toUpperCase()}`,
  );

/** Tombstones: the only allowed differences, each a recorded decision. */
const TOMBSTONES: {
  id: string;
  matches: (r: Recipe, baselineOutcome: string, currentOutcome: string) => boolean;
}[] = [
  {
    // `Envelope.fromBytes` reports every dcbor failure as `Cbor` with the
    // dcbor error as cause, where the baseline let the `CborError` escape.
    id: "T1-fromBytes-wraps-cbor-error",
    matches: (r, a, b) =>
      r.e.k === "decode" && a === "throw:CborError" && normalizeCode(b) === "throw:CBOR",
  },
  {
    // The global format context registers the BC tags in *its* dcbor's
    // global store, so annotated hex names tags (`# tag(200) envelope`) as
    // the reference does. Everything but the names is equal.
    id: "T2-annotated-hex-tag-names",
    matches: (_r, a, b) => stripTagNames(a) === stripTagNames(b) && a !== b,
  },
  {
    // dcbor's standard-tag summarisers are registered too, so a tag-1 date
    // leaf prints as `2022-07-11T04:00:00Z` rather than `1(1657512000)`, as
    // the reference does.
    id: "T3-date-summary",
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
    // The format context carries the functions and parameters stores, so
    // well-known ids print by name («add», ❰lhs❱) as the reference does; the
    // baseline printed the ids («1», ❰2❱).
    id: "T4-expression-names",
    matches: (r, a, b) => {
      if (r.e.k !== "request" || typeof r.e.func !== "number") return false;
      const A = stripTagNames(a);
      const B = stripTagNames(b);
      return A !== B && A.replace(/«\d+»|❰\d+❱/g, "") === B.replace(/«\w+»|❰\w+❱/g, "");
    },
  },
  {
    // `addAssertionEnvelope` dedupes by digest; the baseline appends.
    id: "T5-dedupe",
    matches: (r, a, b) =>
      (r.e.k === "node" || r.e.k === "nodeEnv") &&
      (JSON.stringify(r.e).match(/"knows"/g)?.length ?? 0) >= 2 &&
      (a.match(/"knows": "Bob"/g)?.length ?? 0) > (b.match(/"knows": "Bob"/g)?.length ?? 0),
  },
  {
    // A node whose subject is obscured decodes; the baseline rejects it.
    id: "T6-obscured-subject-decode",
    matches: (r, a, b) =>
      r.e.k === "op" && r.e.op === "roundtrip" && a.startsWith("throw:") && !b.startsWith("throw:"),
  },
  {
    // The assertion check runs before salting; the baseline salted a non-assertion.
    id: "T7-salt-check-order",
    matches: (r, a, b) =>
      r.e.k === "op" &&
      r.e.op === "addAssertionEnvelope" &&
      r.e.salt === true &&
      !a.startsWith("throw:") &&
      b.startsWith("throw:"),
  },
  {
    // A `Date` leaf is a tag-1 date; the baseline encoded an empty map.
    id: "T8-date-leaf",
    matches: (r, a, b) => JSON.stringify(r.e).includes('"t":"date"') && a !== b,
  },
  {
    // The sealed content key is the key's tagged CBOR; the baseline sealed raw bytes,
    // so it cannot open a reference-produced envelope.
    id: "T9-sealed-key",
    matches: (r, a, b) => r.e.k === "recipientDecode" && a.startsWith("throw:") && a !== b,
  },
  {
    // Every operation throws the reference's variant where the baseline threw `General`.
    id: "T12-error-codes",
    matches: (r, a, b) =>
      r.e.k === "op" && a === "throw:GENERAL" && b.startsWith("throw:") && normalizeCode(b) !== a,
  },
  {
    // The diagnostic line-breaking threshold counts UTF-8 bytes as the
    // reference does, so a group holding a non-ASCII string of more than 20
    // bytes breaks over several lines where the baseline (UTF-16 units) kept
    // it on one. Only whitespace differs beyond the T13 differences.
    id: "T14-diagnostic-bytes",
    matches: (_r, a, b) =>
      a !== b && /[\u0080-\uffff]/.test(b) && stripDifferences(a) === stripDifferences(b),
  },
  {
    // Compression goes through components' miniz port: the compressed bytes
    // are the reference's, not pako's. The digest tree and every format
    // string are unchanged; the byte-level outputs differ.
    id: "T15-compressed-bytes",
    matches: (r, a, b) => {
      if (!JSON.stringify(r.e).includes('"compress"')) return false;
      const outs = outputsFor(r);
      const A = a.split(SEP);
      const B = b.split(SEP);
      if (A.length !== outs.length || B.length !== outs.length) return false;
      const byteLevel: readonly string[] = ["cbor", "ur", "diagnostic", "hex"];
      return outs.every((o, i) => A[i] === B[i] || byteLevel.includes(o));
    },
  },
  {
    // The global registry is the reference's seed: `SELF` (706) is not
    // registered, so it prints its codepoint; the baseline named it.
    id: "T16-registry-seed",
    matches: (r, a, b) =>
      JSON.stringify(r.e).includes('"v":706') && a.includes("'Self'") && b.includes("'706'"),
  },
  {
    // A salt length below 8 is components' `DataTooShort`, as the
    // reference's `Salt::new_with_len_using` returns it; the baseline threw
    // `General` or let the components error escape.
    id: "T20-salt-length-code",
    matches: (r, a, b) =>
      r.e.k === "salt" &&
      (a === "throw:GENERAL" || a === "throw:Error") &&
      normalizeCode(b) === "throw:COMPONENTS",
  },
  {
    // The `Encrypt` elision action encrypts an encrypted or elided target,
    // as the reference does; `Compress` on one throws the reference's code
    // (the baseline threw `General` for all of them).
    id: "T21-elide-action-on-obscured",
    matches: (r, a, b) =>
      r.e.k === "elide" &&
      a === "throw:GENERAL" &&
      (typeof r.e.action === "object"
        ? !b.startsWith("throw:")
        : ["throw:ALREADY_ENCRYPTED", "throw:ALREADY_ELIDED"].includes(normalizeCode(b))),
  },
  {
    // The known-value summariser reports its decode failure as dcbor renders
    // it (`<error: …>`); the baseline printed `'<unknown>'`.
    id: "T22-known-value-summariser-error",
    matches: (_r, a, b) => a.includes("'<unknown>'") && b.includes("<error: "),
  },
  {
    // Format items sort by code point, as the reference's `String::cmp`
    // does; the baseline sorted by UTF-16 code unit, so an astral
    // character came before U+E000–U+FFFF. Digests are equal.
    id: "T24-format-item-order",
    matches: (r, a, b) =>
      (r.e.k === "node" || r.e.k === "nodeEnv") &&
      /[\u{10000}-\u{10ffff}]/u.test(JSON.stringify(r.e)) &&
      a.split(SEP)[2] === b.split(SEP)[2] &&
      a !== b,
  },
  {
    // `sskrSplit` wraps an sskr failure as `Sskr`, the reference's `?` into
    // `Error::SSKR`; the baseline let the `SskrError` escape.
    id: "T26-sskr-split-wrapper",
    matches: (r, a, b) =>
      r.e.k === "sskr" && a === "throw:SSKRError" && b.startsWith("throw:Sskr["),
  },
  {
    // dcbor keeps a leading U+FEFF and displays text as encoded (no NFC
    // normalisation), as the reference does; the baseline stripped the BOM
    // on decode and normalised the display.
    id: "T27-text-as-encoded",
    matches: (r, a, b) =>
      (JSON.stringify(r.e).includes("efbbbf") || /\u0301/.test(JSON.stringify(r.e))) && a !== b,
  },
  {
    // dcbor decodes `1(NaN)` (the reference's `Date` accepts it, printing
    // 1970-01-01); the baseline rejected it.
    id: "T28-nan-date",
    matches: (r, _a, b) => JSON.stringify(r.e).includes("c1f97e00") && !b.startsWith("throw:"),
  },
  {
    // dcbor's annotated hex comments a byte string with its text when it is
    // valid UTF-8, as the reference does; only that comment (and the tag
    // names) differs.
    id: "T29-annotated-hex-byte-preview",
    matches: (_r, a, b) =>
      a !== b && stripTagNames(a) === stripTagNames(b).replace(/\s+# "[^"\n]*"$/gm, ""),
  },
];

const DATE = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/;
const DATE_G = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/g;

/** `# tag(200) envelope` → `# tag(200)` on every annotated-hex line. */
const stripTagNames = (s: string): string => s.replace(/# tag\((\d+)\)[^\n]*/g, "# tag($1)");

/** The tag-name, ellipsis and whitespace differences removed. */
const stripDifferences = (s: string): string =>
  stripTagNames(s).replace(/…/g, "").replace(/\s+/g, "");

const baseline = baselineAdapterFor(baselineMod, await baselineDeps());
const current = workingTreeAdapterFor(src, await currentDeps());

describe("differential: baseline vs working tree", () => {
  it("baseline bundle integrity", () => {
    const sha = createHash("sha256")
      .update(readFileSync(join(here, "baseline/envelope-baseline.mjs")))
      .digest("hex");
    expect(sha).toBe(BASELINE_SHA256);
  });
  const hits: Record<string, number> = {};
  for (const [name, gen] of Object.entries(categories)) {
    it(`category ${name}`, { timeout: 600_000 }, () => {
      let n = 0;
      const diffs: string[] = [];
      let skipped = 0;
      for (const recipe of gen()) {
        if (!isBaselineSupported(recipe.e)) {
          skipped++;
          continue;
        }
        n++;
        const a = materialize(baseline, recipe);
        const b = materialize(current, recipe);
        if (a === b || a === normalizeCode(b)) continue;
        const tomb = TOMBSTONES.find((t) => t.matches(recipe, a, b));
        if (tomb === undefined)
          diffs.push(`${recipeName(recipe)}: ${a.slice(0, 120)} !== ${b.slice(0, 120)}`);
        else hits[tomb.id] = (hits[tomb.id] ?? 0) + 1;
      }
      expect(n + skipped).toBeGreaterThan(0);
      expect(diffs).toEqual([]);
    });
  }
  it("every tombstone still covers a row", () => {
    const unused = TOMBSTONES.map((t) => t.id).filter((id) => (hits[id] ?? 0) === 0);
    expect(unused).toEqual([]);
  });
});
