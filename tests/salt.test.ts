/**
 * Salt lengths beyond 65 536 bytes draw from the secure generator in one
 * call, as the reference's `SecureRandomNumberGenerator` does: no length is
 * too long for `addSalt`.
 */
import { describe, it, expect } from "vitest";
import { Envelope } from "../src/index.js";
import { SALT } from "@blockchaincommons/known-values";
import { Salt } from "@blockchaincommons/components";
import "../src/all.js";

const saltLength = (envelope: Envelope): number =>
  envelope.objectForPredicate(SALT).expectSubject((cbor) => Salt.fromCbor(cbor)).byteLength;

describe("addSalt with a large length", () => {
  const plain = Envelope.from("x");

  it("adds exactly 70000 bytes of salt", () => {
    const salted = plain.addSalt({ length: 70000 });
    expect(saltLength(salted)).toBe(70000);
    // The salt assertion adds the 70000 bytes plus 13 bytes of framing:
    // the node array head, the assertion map, the tagged known value and
    // the tagged byte string with its 4-byte length.
    const grown = salted.toCbor().toData().length - plain.toCbor().toData().length;
    expect(grown).toBe(70000 + 13);
  });

  it("draws a length in a range above 65536", () => {
    const length = saltLength(plain.addSalt({ range: { min: 65537, max: 70000 } }));
    expect(length).toBeGreaterThanOrEqual(65537);
    expect(length).toBeLessThanOrEqual(70000);
  });
});
