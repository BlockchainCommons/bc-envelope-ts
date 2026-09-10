import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    all: "src/all.ts",
    format: "src/format/index.ts",
    expression: "src/expression.ts",
    attachment: "src/extension/attachment.ts",
    edge: "src/extension/edge.ts",
    proof: "src/extension/proof.ts",
    recipient: "src/extension/recipient.ts",
    salt: "src/extension/salt.ts",
    secret: "src/extension/secret.ts",
    signature: "src/extension/signature.ts",
    sskr: "src/extension/sskr.ts",
    types: "src/extension/types.ts",
    seal: "src/seal.ts",
  },
  outDir: "dist",
  format: ["cjs", "esm"],
  dts: true,
  inputOptions: {
    // The rolldown-plugin-dts "fake-js" pass transforms .d.ts content without
    // emitting a sourcemap, producing a spurious SOURCEMAP_BROKEN warning even
    // though the real JS sourcemaps are correct. Filter only that case.
    onwarn(warning, defaultHandler) {
      if (warning.code === "SOURCEMAP_BROKEN") return;
      defaultHandler(warning);
    },
  },
  sourcemap: true,
  clean: true,
  target: "es2022",
});
