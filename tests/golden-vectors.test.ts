/**
 * Golden vector suite (Phase 1.2): the committed freeze of every envelope's
 * CBOR, digest and format strings. Changes only through
 * `bun run vectors:generate`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import * as src from "../src/all.js";
import { materialize, redesignedAdapterFor, type Recipe, type Outcome } from "./vectors/recipes";
import { currentDeps } from "./vectors/deps";

const here = dirname(fileURLToPath(import.meta.url));
const { count, vectors } = JSON.parse(readFileSync(join(here, "vectors/vectors.json"), "utf8")) as {
  count: number;
  vectors: { name: string; recipe: Recipe; expect: Outcome }[];
};
const api = redesignedAdapterFor(src, await currentDeps());

describe("golden vectors (frozen)", () => {
  it("fixture is self-consistent and non-trivial", () => {
    expect(vectors.length).toBe(count);
    expect(vectors.length).toBeGreaterThanOrEqual(140);
  });
  for (const v of vectors) {
    it(v.name, () => {
      expect(materialize(api, v.recipe)).toBe(v.expect);
    });
  }
});
