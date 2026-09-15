/**
 * Vector generator. Materialises recipes with the WORKING TREE, error
 * messages included, in the order the Rust harness replays them: the rows
 * under `noreg` first, before the envelope tags and summarisers are
 * registered, then everything else, the `late` rows last.
 *
 *   bun scripts/generate-vectors.ts                 # the golden subset → tests/vectors/vectors.json
 *   bun scripts/generate-vectors.ts --full <path>   # the whole corpus → <path> (not committed)
 *
 * The known-values directory configuration is pinned to no directories, so
 * the machine's `~/.known-values` never reaches a vector. Regenerating the
 * golden file is a deliberate, reviewed act.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { DirectoryConfig, setDirectoryConfig } from "@blockchaincommons/known-values";
import {
  materializeAsync,
  recipeName,
  outputsFor,
  workingTreeAdapterFor,
  type Recipe,
} from "../tests/vectors/recipes.ts";
import { allRecipes, goldenRecipes } from "../tests/corpus/corpus.ts";
import { currentDeps } from "../tests/vectors/deps.ts";

setDirectoryConfig(new DirectoryConfig());

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fullIndex = process.argv.indexOf("--full");
const full = fullIndex !== -1;
const out = full ? process.argv[fullIndex + 1] : join(root, "tests/vectors/vectors.json");
if (out === undefined) throw new Error("--full needs an output path");

const m = await import("../src/all.ts");
const api = workingTreeAdapterFor(m, await currentDeps());

const recipes = [...(full ? allRecipes() : goldenRecipes())];
const row = async (recipe: Recipe) => ({
  name: recipeName(recipe),
  recipe: { ...recipe, outs: outputsFor(recipe) },
  expect: await materializeAsync(api, recipe, { messages: true }),
});
// The unregistered rows see the format context as a fresh process does.
const vectors = [];
for (const recipe of recipes.filter((r) => r.e.k === "noreg")) vectors.push(await row(recipe));
m.registerTags();
for (const recipe of recipes.filter((r) => r.e.k !== "noreg")) vectors.push(await row(recipe));

writeFileSync(out, JSON.stringify({ count: vectors.length, vectors }, null, 1) + "\n");
console.log(`wrote ${vectors.length} ${full ? "corpus" : "golden"} vectors to ${out}`);
