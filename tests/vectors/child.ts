/**
 * Materialises the rows of a vector file in a fresh process, where the
 * envelope summarisers are not yet registered and the known-values
 * directory configuration is pinned: `bun tests/vectors/child.ts
 * <vectors.json> <first> <count>` prints the outcomes of the rows
 * `[first, first + count)`, one JSON array, error messages included.
 *
 * The golden suite runs the `noreg` rows here, because the vitest setup
 * file registers the summarisers for every test file.
 */
import { readFileSync } from "node:fs";
import process from "node:process";
import { DirectoryConfig, setDirectoryConfig } from "@blockchaincommons/known-values";
import * as src from "../../src/all.js";
import { materializeAsync, workingTreeAdapterFor, type Recipe } from "./recipes.js";
import { currentDeps } from "./deps.js";

setDirectoryConfig(new DirectoryConfig());

const [path, first, count] = process.argv.slice(2);
if (path === undefined || first === undefined || count === undefined) {
  throw new Error("usage: bun tests/vectors/child.ts <vectors.json> <first> <count>");
}
const { vectors } = JSON.parse(readFileSync(path, "utf8")) as {
  vectors: { recipe: Recipe }[];
};
const api = workingTreeAdapterFor(src, await currentDeps());
const outcomes: string[] = [];
for (const v of vectors.slice(Number(first), Number(first) + Number(count))) {
  outcomes.push(await materializeAsync(api, v.recipe, { messages: true }));
}
process.stdout.write(JSON.stringify(outcomes));
