/**
 * Every `EnvelopeError` message is the reference's `#[error]` text. The
 * fixture is extracted from the pinned `bc-envelope` crate by
 * `scripts/rust-error-texts.ts`; a variant whose text changes upstream
 * changes here.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { CborError } from "@blockchaincommons/dcbor";
import { EnvelopeError, EnvelopeErrorCode } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const rust = JSON.parse(
  readFileSync(join(here, "fixtures/rust-error-texts.json"), "utf8"),
) as Record<string, string>;

/** The reference variant a port code corresponds to; identical unless listed. */
const VARIANT: Partial<Record<EnvelopeErrorCode, string>> = {
  UnexpectedResponseId: "UnexpectedResponseID",
  Sskr: "SSKR",
};

/** The codes whose factory takes a message: the fixture text is the prefix around `{0}`. */
const WRAPPERS: Partial<Record<EnvelopeErrorCode, () => EnvelopeError>> = {
  Cbor: () => EnvelopeError.cbor("x"),
  Components: () => EnvelopeError.components("x"),
  Sskr: () => EnvelopeError.sskr("x"),
  General: () => EnvelopeError.general("x"),
};

/** The codes the reference has no variant for (the JavaScript input domain). */
const PORT_ONLY: EnvelopeErrorCode[] = ["InvalidParameter"];

const factories = EnvelopeError as unknown as Record<string, () => EnvelopeError>;
const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

describe("EnvelopeError texts are the reference's", () => {
  it("the fixture covers every port code, and every reference variant has a port code", () => {
    const codes = Object.values(EnvelopeErrorCode).filter((c) => !PORT_ONLY.includes(c));
    const variants = codes.map((c) => VARIANT[c] ?? c).sort();
    expect(variants).toEqual(Object.keys(rust).sort());
  });

  for (const code of Object.values(EnvelopeErrorCode)) {
    if (PORT_ONLY.includes(code)) continue;
    const variant = VARIANT[code] ?? code;
    const wrapper = WRAPPERS[code];
    if (wrapper !== undefined) {
      it(`${code} wraps its message as ${variant} does`, () => {
        const [prefix, suffix] = rust[variant].split("{0}");
        expect(wrapper().message).toBe(`${prefix}x${suffix ?? ""}`);
      });
      continue;
    }
    it(`${code} reads as ${variant}`, () => {
      const factory = factories[lowerFirst(code)];
      expect(typeof factory, `factory for ${code}`).toBe("function");
      const error = factory();
      expect(error.code).toBe(code);
      expect(error.message).toBe(rust[variant]);
    });
  }

  it("cborDecode carries the dcbor message with no prefix", () => {
    const cause = CborError.underrun();
    const error = EnvelopeError.cborDecode(cause);
    expect(error.code).toBe("Cbor");
    expect(error.message).toBe(cause.message);
    expect(error.cause).toBe(cause);
  });
});
