/**
 * Extracts the `#[error("…")]` text of every variant of the reference's
 * `bc_envelope::Error` (`src/base/error.rs` of the pinned `bc-envelope`
 * crate in the local cargo registry) into `tests/fixtures/rust-error-texts.json`,
 * keyed by variant name. `tests/error-text.test.ts` diffs the port's
 * `EnvelopeError` messages against it.
 *
 *   bun scripts/rust-error-texts.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cargo = process.env["CARGO_HOME"] ?? join(homedir(), ".cargo");
const registry = join(cargo, "registry", "src");
const version = /bc-envelope = "=([^"]+)"/.exec(
  readFileSync(join(root, "tests/rust-validation/Cargo.toml"), "utf8"),
)?.[1];
if (version === undefined) throw new Error("the harness Cargo.toml pins no bc-envelope version");

const source = readdirSync(registry)
  .map((index) => join(registry, index, `bc-envelope-${version}`, "src/base/error.rs"))
  .find((path) => {
    try {
      readFileSync(path);
      return true;
    } catch {
      return false;
    }
  });
if (source === undefined) throw new Error(`bc-envelope ${version} is not in ${registry}`);

const texts: Record<string, string> = {};
const lines = readFileSync(source, "utf8").split("\n");
for (let i = 0; i < lines.length; i++) {
  // `#[error("text")]` possibly spread over several lines, then the variant.
  if (!lines[i].trim().startsWith("#[error(")) continue;
  let attr = lines[i].trim();
  while (!attr.endsWith(")]")) attr += lines[++i].trim();
  const text = /#\[error\(\s*"((?:[^"\\]|\\.)*)"\s*\)\]/.exec(attr)?.[1];
  if (text === undefined) throw new Error(`unreadable attribute at ${source}:${i + 1}`);
  let variant: string | undefined;
  while (variant === undefined) {
    const line = lines[++i].trim();
    if (line.startsWith("#[") || line.startsWith("//")) continue;
    variant = /^([A-Za-z]+)/.exec(line)?.[1];
  }
  texts[variant] = text.replace(/\\"/g, '"');
}

const out = join(root, "tests/fixtures/rust-error-texts.json");
writeFileSync(out, JSON.stringify(texts, null, 2) + "\n");
console.log(`wrote ${Object.keys(texts).length} variants from bc-envelope ${version} to ${out}`);
