/**
 * Golden snapshots (Phase 0.2): the notation, tree and mermaid strings of
 * every hand-built corpus envelope, plus the decode rejection table. The
 * vectors file pins the same outputs byte for byte; this snapshot is the
 * human-readable view of them.
 */
import { describe, it, expect } from "vitest";
import * as src from "../src/index.js";
import { HAND } from "./corpus/corpus";
import {
  materialize,
  redesignedAdapterFor,
  recipeName,
  randomnessOf,
  type Out,
} from "./vectors/recipes";
import { currentDeps } from "./vectors/deps";

const api = redesignedAdapterFor(src, await currentDeps());

describe("golden: hand corpus", () => {
  for (const e of HAND) {
    if (e.k === "decode" || e.k === "ur") continue;
    // Digests (tree, mermaid) are stable only where no fresh randomness enters.
    const level = randomnessOf(e);
    const out: Out[] =
      level === "digest"
        ? ["format"]
        : level === "bytes"
          ? ["format", "tree"]
          : ["format", "tree", "mermaid"];
    it(recipeName({ e }), () => {
      expect(materialize(api, { e, out })).toMatchSnapshot();
    });
  }
  it("decode rejections", () => {
    const rows = HAND.filter((e) => e.k === "decode" || e.k === "ur").map(
      (e) =>
        `${recipeName({ e })}: ${materialize(api, { e, out: ["format"] })
          .split("\n")
          .join(" ")}`,
    );
    expect(rows).toMatchSnapshot();
  });
});
