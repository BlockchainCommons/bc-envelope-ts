/**
 * Golden vector suite: the committed freeze of every envelope's
 * CBOR, digest, format strings and error messages. Changes only through
 * `bun run vectors:generate`.
 *
 * The rows replay in the file's order, as the Rust harness replays them.
 * The `noreg` rows come first and run in a fresh process
 * (`tests/vectors/child.ts`), because the setup file registers the envelope
 * summarisers for this process; the rest run here, registered.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import * as src from "../src/all.js";
import {
  materializeAsync,
  workingTreeAdapterFor,
  type Recipe,
  type Outcome,
} from "./vectors/recipes";
import { currentDeps } from "./vectors/deps";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "vectors/vectors.json");
const { count, vectors } = JSON.parse(readFileSync(file, "utf8")) as {
  count: number;
  vectors: { name: string; recipe: Recipe; expect: Outcome }[];
};
const api = workingTreeAdapterFor(src, await currentDeps());
const firstRegistered = vectors.findIndex((v) => v.recipe.e.k !== "noreg");

const diff = (v: { name: string; expect: string }, got: string): string =>
  `${v.name}\n  expected: ${v.expect.slice(0, 300)}\n  got:      ${got.slice(0, 300)}`;

describe("golden vectors (frozen)", () => {
  it("fixture is self-consistent and non-trivial", () => {
    expect(vectors.length).toBe(count);
    expect(vectors.length).toBeGreaterThanOrEqual(400);
    expect(firstRegistered).toBeGreaterThan(0);
    expect(vectors.slice(firstRegistered).every((v) => v.recipe.e.k !== "noreg")).toBe(true);
  });
  it("the unregistered rows materialise in a fresh process", { timeout: 300_000 }, () => {
    // An empty home of its own: the child must not read a `~/.known-values`.
    const home = mkdtempSync(join(tmpdir(), "envelope-golden-"));
    const child = spawnSync(
      "bun",
      [join(here, "vectors/child.ts"), file, "0", String(firstRegistered)],
      { encoding: "utf8", env: { ...process.env, HOME: home } },
    );
    expect(child.status, child.stderr).toBe(0);
    const got = JSON.parse(child.stdout) as string[];
    const diffs = vectors
      .slice(0, firstRegistered)
      .map((v, i) => (got[i] === v.expect ? undefined : diff(v, got[i] ?? "")))
      .filter((d) => d !== undefined);
    expect(diffs).toEqual([]);
  });
  // Sequential on purpose: the `late` rows change the global stores after
  // the context exists, and every row after them sees that state.
  it("the registered rows materialise in order", { timeout: 600_000 }, async () => {
    const diffs: string[] = [];
    for (const v of vectors.slice(firstRegistered)) {
      const got = await materializeAsync(api, v.recipe, { messages: true });
      if (got !== v.expect) diffs.push(diff(v, got));
    }
    expect(diffs).toEqual([]);
  });
});
