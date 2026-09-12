import { Envelope } from "../src/index.js";
import { Attachments } from "../src/extension/attachment.js";
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
