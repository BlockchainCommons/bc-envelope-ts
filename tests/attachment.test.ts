import { Envelope } from "../src/index.js";
import { Attachments } from "../src/extension/attachment.js";
import { ATTACHMENT, VENDOR } from "@blockchaincommons/known-values";
import "../src/all.js";

describe("Attachment Extension", () => {
  describe("Create attachment envelope", () => {
    it("should create attachment with vendor and conformsTo", () => {
      const attachment = Envelope.attachment(
        "Custom data",
        "com.example",
        "https://example.com/format/v1",
      );

      expect(attachment.attachmentPayload().asText()).toBe("Custom data");
      expect(attachment.attachmentVendor()).toBe("com.example");
      expect(attachment.attachmentConformsTo()).toBe("https://example.com/format/v1");
    });
  });

  describe("Add attachment to envelope", () => {
    it("should add attachment to existing envelope", () => {
      const document = Envelope.from("User data")
        .addAssertion("name", "Alice")
        .addAttachment(
          "Vendor-specific metadata",
          "com.example",
          "https://example.com/metadata/v1",
        );

      expect(document.subject().asText()).toBe("User data");
      expect(document.assertions().length).toBeGreaterThan(1);

      const attachments = document.attachments();
      expect(attachments.length).toBe(1);
    });
  });

  describe("Multiple attachments", () => {
    it("should support multiple attachments", () => {
      const envelope = Envelope.from("Data")
        .addAttachment("Attachment 1", "com.example", "https://example.com/v1")
        .addAttachment("Attachment 2", "com.example", "https://example.com/v2")
        .addAttachment("Attachment 3", "com.other", "https://other.com/v1");

      expect(envelope.attachments().length).toBe(3);
    });
  });

  describe("Filter attachments", () => {
    it("should filter by vendor", () => {
      const envelope = Envelope.from("Data")
        .addAttachment("Attachment 1", "com.example", "https://example.com/v1")
        .addAttachment("Attachment 2", "com.example", "https://example.com/v2")
        .addAttachment("Attachment 3", "com.other", "https://other.com/v1");

      const exampleAttachments = envelope.attachments({ vendor: "com.example" });
      expect(exampleAttachments.length).toBe(2);

      const otherAttachments = envelope.attachments({ vendor: "com.other" });
      expect(otherAttachments.length).toBe(1);
    });

    it("should filter by conformsTo", () => {
      const envelope = Envelope.from("Data")
        .addAttachment("Attachment 1", "com.example", "https://example.com/v1")
        .addAttachment("Attachment 2", "com.example", "https://example.com/v2")
        .addAttachment("Attachment 3", "com.other", "https://other.com/v1");

      const v1Attachments = envelope.attachments({ conformsTo: "https://example.com/v1" });
      expect(v1Attachments.length).toBe(1);
    });

    it("should filter by both vendor and conformsTo", () => {
      const envelope = Envelope.from("Data")
        .addAttachment("Attachment 1", "com.example", "https://example.com/v1")
        .addAttachment("Attachment 2", "com.example", "https://example.com/v2")
        .addAttachment("Attachment 3", "com.other", "https://other.com/v1");

      const specificAttachments = envelope.attachments({
        vendor: "com.example",
        conformsTo: "https://example.com/v2",
      });
      expect(specificAttachments.length).toBe(1);
    });
  });

  describe("Attachments container", () => {
    it("should manage multiple attachments", () => {
      const container = new Attachments();
      container.add("Data 1", "com.vendor1");
      container.add("Data 2", "com.vendor2", "https://vendor2.com/schema");
      container.add("Data 3", "com.vendor3");

      expect(container.size).toBeGreaterThan(0);

      const base = Envelope.from("Base document");
      const withAttachments = container.addToEnvelope(base);

      expect(withAttachments.attachments().length).toBe(3);
    });

    it("should extract attachments from envelope", () => {
      const envelope = Envelope.from("Data")
        .addAttachment("Attachment 1", "com.example", "https://example.com/v1")
        .addAttachment("Attachment 2", "com.other", "https://other.com/v1");

      const extractedContainer = Attachments.fromEnvelope(envelope);

      expect(extractedContainer.size).toBeGreaterThan(0);
    });
  });

  describe("Attachment without conformsTo", () => {
    it("should create attachment without conformsTo", () => {
      const simpleAttachment = Envelope.attachment("Simple data", "com.simple");

      expect(simpleAttachment.attachmentVendor()).toBe("com.simple");
      expect(simpleAttachment.attachmentConformsTo()).toBeUndefined();
    });
  });

  describe("Complex attachment payload", () => {
    it("should support envelope as payload", () => {
      const complexPayload = Envelope.from("Metadata")
        .addAssertion("version", "2.0")
        .addAssertion("timestamp", "2024-01-15T10:30:00Z");

      const complexAttachment = Envelope.from("Document").addAttachment(
        complexPayload,
        "com.complex",
        "https://complex.com/v2",
      );

      const attachments = complexAttachment.attachments();
      expect(attachments.length).toBe(1);
    });
  });
});

describe("attachment validation follows the reference", () => {
  const code = (f: () => unknown): string => {
    try {
      f();
      return "ok";
    } catch (e) {
      const x = e as { code: string; message: string };
      return `${x.code}:${x.message}`;
    }
  };

  it("a non-assertion is InvalidAttachment with the reference's text", () => {
    expect(code(() => Envelope.from("x").validateAttachment())).toBe(
      "InvalidAttachment:invalid attachment",
    );
    expect(code(() => Envelope.from("x").attachmentVendor())).toBe(
      "InvalidAttachment:invalid attachment",
    );
  });

  it("an object that is not wrapped is NotWrapped (the payload is read first)", () => {
    const bogus = Envelope.assertion(ATTACHMENT, Envelope.from("p").addAssertion(VENDOR, "v"));
    expect(code(() => bogus.validateAttachment())).toBe(
      "NotWrapped:cannot unwrap an envelope that was not wrapped",
    );
  });

  it("a wrong predicate or an extra assertion fails the rebuild", () => {
    const wrongPredicate = Envelope.assertion(
      "x",
      Envelope.from("p").wrap().addAssertion(VENDOR, "v"),
    );
    expect(code(() => wrongPredicate.validateAttachment())).toBe(
      "InvalidAttachment:invalid attachment",
    );
    const extra = Envelope.assertion(
      ATTACHMENT,
      Envelope.from("p").wrap().addAssertion(VENDOR, "v").addAssertion("x", 1),
    );
    expect(code(() => extra.validateAttachment())).toBe("InvalidAttachment:invalid attachment");
  });

  it("the vendor is read by subject extraction", () => {
    const annotatedVendor = Envelope.assertion(
      ATTACHMENT,
      Envelope.from("p").wrap().addAssertion(VENDOR, Envelope.from("v").addAssertion("x", 1)),
    );
    expect(annotatedVendor.attachmentVendor()).toBe("v");
    const intVendor = Envelope.assertion(
      ATTACHMENT,
      Envelope.from("p").wrap().addAssertion(VENDOR, 1),
    );
    expect(code(() => intVendor.attachmentVendor())).toBe(
      "Cbor:dcbor error: the decoded CBOR value was not the expected type",
    );
    const noVendor = Envelope.assertion(ATTACHMENT, Envelope.from("p").wrap());
    expect(code(() => noVendor.attachmentVendor())).toBe(
      "NonexistentPredicate:no assertion matches the predicate",
    );
  });

  it("several matching attachments are the reference's `abiguous attachment`", () => {
    const envelope = Envelope.from("Data")
      .addAttachment("Attachment 1", "com.example", "https://example.com/v1")
      .addAttachment("Attachment 2", "com.example", "https://example.com/v1");
    expect(code(() => envelope.expectAttachment({ vendor: "com.example" }))).toBe(
      "AmbiguousAttachment:abiguous attachment",
    );
  });
});
