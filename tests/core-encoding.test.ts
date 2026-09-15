import { describe, it, expect } from "vitest";
import { Envelope } from "../src/index.js";
import { cbor, taggedValue } from "@blockchaincommons/dcbor";
import { Digest } from "@blockchaincommons/components";
import "../src/all.js";

/**
 * Helper function to check round-trip encoding of an Envelope.
 * This matches the Rust check_encoding() function behavior.
 *
 * @param envelope - The envelope to check
 * @returns The same envelope if encoding round-trips successfully
 * @throws Error if encoding/decoding fails or digest mismatch occurs
 */
function checkEncoding(envelope: Envelope): Envelope {
  // Get the tagged CBOR and encode to bytes
  const bytes = envelope.toCbor().toData();

  // Decode back from bytes
  const restored = Envelope.fromBytes(bytes);

  // Verify digests match
  if (!envelope.digest().equals(restored.digest())) {
    throw new Error(
      `Digest mismatch:\n` +
        `=== EXPECTED ===\n${envelope.format()}\n` +
        `=== GOT ===\n${restored.format()}\n`,
    );
  }

  return envelope;
}

describe("Core Encoding Tests", () => {
  describe("test_digest", () => {
    it("should encode and decode envelope containing a Digest", () => {
      // Create a digest from the image "Hello."
      const digest = Digest.fromImage(new TextEncoder().encode("Hello."));

      // Create an envelope with the digest data
      const envelope = Envelope.from(digest.bytes);

      // Check round-trip encoding
      const result = checkEncoding(envelope);
      expect(result).toBeDefined();
    });
  });

  describe("test_1", () => {
    it("should encode and decode simple string envelope", () => {
      const e = Envelope.from("Hello.");

      // Check the envelope notation format
      const formatted = e.format();
      expect(formatted).toContain("Hello.");

      // Verify round-trip encoding works
      checkEncoding(e);
    });
  });

  describe("test_2", () => {
    it("should encode and decode envelope containing CBOR array", () => {
      // Create an envelope with an array [1, 2, 3]
      // Use newLeaf directly since Envelope.new's type doesn't include arrays,
      // though the underlying CBOR encoder supports them
      const array = [1, 2, 3];
      const e = Envelope.leaf(array);

      // Verify the format shows the array
      const formatted = e.format();
      // The format should contain the array elements
      expect(formatted).toContain("1");
      expect(formatted).toContain("2");
      expect(formatted).toContain("3");

      // Check round-trip encoding
      checkEncoding(e);
    });
  });

  describe("test_3", () => {
    it("should encode and decode assertion envelopes", () => {
      // Create three assertion envelopes and verify they encode correctly
      const e1 = Envelope.assertion("A", "B");
      checkEncoding(e1);

      const e2 = Envelope.assertion("C", "D");
      checkEncoding(e2);

      const e3 = Envelope.assertion("E", "F");
      checkEncoding(e3);

      // Verify format contains expected values
      expect(e1.format()).toContain('"A"');
      expect(e1.format()).toContain('"B"');
      expect(e2.format()).toContain('"C"');
      expect(e2.format()).toContain('"D"');
      expect(e3.format()).toContain('"E"');
      expect(e3.format()).toContain('"F"');
    });

    it("should encode and decode envelope with assertion added to leaf subject", () => {
      // Create a simple envelope with a leaf subject and add assertions
      // This tests the core encoding without requiring the recursive isSubjectAssertion behavior
      const subject = Envelope.from("Subject");
      const e1 = Envelope.assertion("A", "B");
      const e2 = Envelope.assertion("C", "D");

      // Add assertions to a leaf subject (this is the common case)
      const e3 = subject.addAssertionEnvelope(e1);
      checkEncoding(e3);

      const e4 = e3.addAssertionEnvelope(e2);
      checkEncoding(e4);

      // Verify format contains all expected values
      const formatted = e4.format();
      expect(formatted).toContain("Subject");
      expect(formatted).toContain('"A"');
      expect(formatted).toContain('"B"');
      expect(formatted).toContain('"C"');
      expect(formatted).toContain('"D"');
    });

    it("should encode and decode nested envelopes as assertion objects", () => {
      // Test nested envelopes where assertions contain other envelopes as objects
      // This is the supported pattern for nesting in the current TypeScript implementation
      const innerEnvelope = Envelope.from("Inner").addAssertion("innerKey", "innerValue");

      const outerEnvelope = Envelope.from("Outer")
        .addAssertion("nested", innerEnvelope)
        .addAssertion("outerKey", "outerValue");

      checkEncoding(outerEnvelope);

      const formatted = outerEnvelope.format();
      expect(formatted).toContain("Outer");
      expect(formatted).toContain("Inner");
      expect(formatted).toContain("innerKey");
      expect(formatted).toContain("outerKey");
    });
  });

  describe("Additional encoding tests", () => {
    it("should encode and decode envelope with single assertion", () => {
      const e = Envelope.from("Subject").addAssertion("predicate", "object");
      const result = checkEncoding(e);
      expect(result.format()).toContain("Subject");
      expect(result.format()).toContain("predicate");
      expect(result.format()).toContain("object");
    });

    it("should encode and decode envelope with multiple assertions", () => {
      const e = Envelope.from("Alice")
        .addAssertion("name", "Alice Smith")
        .addAssertion("age", 30)
        .addAssertion("email", "alice@example.com");

      const result = checkEncoding(e);
      expect(result.format()).toContain("Alice");
      expect(result.format()).toContain("name");
      expect(result.format()).toContain("age");
      expect(result.format()).toContain("email");
    });

    it("should encode and decode wrapped envelope", () => {
      const inner = Envelope.from("Inner content");
      const wrapped = inner.wrap();

      const result = checkEncoding(wrapped);
      expect(result.isWrapped()).toBe(true);
    });

    it("should encode and decode elided envelope", () => {
      const original = Envelope.from("Secret data");
      const elided = original.elide();

      const result = checkEncoding(elided);
      expect(result.isElided()).toBe(true);
      // Digest should be preserved
      expect(result.digest().equals(original.digest())).toBe(true);
    });

    it("should encode and decode envelope with numeric values", () => {
      const e = Envelope.from(42);
      const result = checkEncoding(e);
      expect(result.expectNumber()).toBe(42);
    });

    it("should encode and decode envelope with boolean values", () => {
      const eTrue = Envelope.from(true);
      const resultTrue = checkEncoding(eTrue);
      expect(resultTrue.expectBoolean()).toBe(true);

      const eFalse = Envelope.from(false);
      const resultFalse = checkEncoding(eFalse);
      expect(resultFalse.expectBoolean()).toBe(false);
    });

    it("should encode and decode envelope with null value", () => {
      const e = Envelope.NULL;
      const result = checkEncoding(e);
      expect(result.isNull()).toBe(true);
    });

    it("should encode and decode envelope with byte data", () => {
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
      const e = Envelope.from(data);
      const result = checkEncoding(e);
      expect(result.expectBytes()).toEqual(data);
    });

    it("should encode and decode deeply nested envelopes", () => {
      const level3 = Envelope.from("Level 3").addAssertion("depth", 3);
      const level2 = Envelope.from("Level 2").addAssertion("child", level3);
      const level1 = Envelope.from("Level 1").addAssertion("child", level2);

      const result = checkEncoding(level1);
      expect(result.format()).toContain("Level 1");
    });

    it("should preserve digest through encoding round-trip", () => {
      const original = Envelope.from("Test content")
        .addAssertion("key1", "value1")
        .addAssertion("key2", "value2");

      const originalDigest = original.digest();

      // Encode and decode
      const bytes = original.toCbor().toData();
      const restored = Envelope.fromBytes(bytes);

      // Verify digest is preserved
      expect(restored.digest().equals(originalDigest)).toBe(true);
    });
  });
});

/** `throw:<cause code>:<message>` for a decode rejection. */
function rejection(f: () => unknown): string {
  try {
    f();
    return "ok";
  } catch (e) {
    const x = e as { code?: string; message: string; cause?: { code?: string } };
    return `throw:${x.code ?? "?"}:${x.cause?.code ?? "-"}:${x.message}`;
  }
}
const hex = (h: string): Uint8Array => Uint8Array.from(Buffer.from(h, "hex"));

describe("decode failures report the reference's dcbor error", () => {
  // `fromBytes` corresponds to `try_from_cbor_data`, which returns the dcbor
  // error itself: the port's message is its Display with no prefix and the
  // `cause` carries the variant.
  const rows: [string, string, string][] = [
    [
      "two-key map",
      "d8c8a2d8c96161d8c96162d8c96163d8c96164",
      "Custom:assertion must be a map with exactly one element",
    ],
    [
      "elided 31 bytes",
      "d8c8581f" + "00".repeat(31),
      "Custom:invalid digest size: expected 32, got 31",
    ],
    ["empty node", "d8c880", "Custom:node must have at least two elements"],
    ["subject-only node", "d8c881d8c96161", "Custom:node must have at least two elements"],
    ["truncated", "d8c8d8c961", "Underrun:early end of CBOR data"],
    ["trailing byte", "d8c8d8c9616100", "UnusedData:the decoded CBOR had 1 extra bytes at the end"],
    ["null in tag 200", "d8c8f6", "Custom:invalid envelope"],
    ["negative in tag 200", "d8c820", "Custom:invalid envelope"],
    ["float in tag 200", "d8c8f93e00", "Custom:invalid envelope"],
    ["text in tag 200", "d8c86161", "Custom:invalid envelope"],
    ["untagged 01", "01", "WrongType:the decoded CBOR value was not the expected type"],
    ["tag 40000", "d8c8d99c4001", "Custom:unknown envelope tag: 40000"],
    ["non-assertion node element", "d8c882d8c96161d8c96162", "Custom:invalid format"],
    [
      "wrapped node with a non-assertion element",
      "d8c8d8c882d8c96161d8c96162",
      "Custom:invalid format",
    ],
    ["map key not an envelope", "d8c8a1f6f6", "Custom:dcbor error: invalid envelope"],
    ["map value not an envelope", "d8c8a1d8c96161f6", "Custom:dcbor error: invalid envelope"],
    [
      "nested map key not an envelope",
      "d8c8a1a1f6f6f6",
      "Custom:dcbor error: dcbor error: invalid envelope",
    ],
    [
      "encrypted without a digest",
      "d8c8d99c428343349e194c0b0b0b0b0b0b0b0b0b0b0b0b50147c18b0293cbe6db007cbd894643413",
      "Custom:a digest was expected but not found",
    ],
    [
      "compressed without a digest",
      "d8c8d99c43831ad92c0822182954f348cdc9c9d75128cf2fca49d151c8c0c9d30300",
      "Custom:a digest was expected but not found",
    ],
    [
      "non-canonical float inside",
      "d8c8d8c9fa4f000000",
      "NonCanonicalNumeric:a CBOR numeric value was encoded in non-canonical form",
    ],
  ];
  for (const [name, bytes, expected] of rows) {
    it(name, () => {
      expect(rejection(() => Envelope.fromBytes(hex(bytes)))).toBe(`throw:Cbor:${expected}`);
    });
  }

  it("outer tag 201 names the expected tag as the global tags store names it", () => {
    const outcome = rejection(() => Envelope.fromBytes(hex("d8c96161")));
    expect(outcome).toMatch(/^throw:Cbor:WrongTag:expected CBOR tag (envelope|200), but got 201$/);
  });

  it("fromCbor and codec.decode take the tagged form only", () => {
    expect(rejection(() => Envelope.fromCbor(cbor(1)))).toBe(
      "throw:Cbor:WrongType:the decoded CBOR value was not the expected type",
    );
    expect(rejection(() => Envelope.codec.decode(taggedValue(201, "a")))).toMatch(
      /^throw:Cbor:WrongTag:expected CBOR tag (envelope|200), but got 201$/,
    );
  });

  it("every decode failure carries the CborError as its cause", () => {
    for (const bytes of ["d8c8d8c961", "d8c8f6", "01", "d8c8581f" + "00".repeat(31)]) {
      try {
        Envelope.fromBytes(hex(bytes));
        expect.unreachable();
      } catch (e) {
        expect((e as Error).name).toBe("EnvelopeError");
        expect(((e as Error).cause as Error).name).toBe("CborError");
      }
    }
  });
});
