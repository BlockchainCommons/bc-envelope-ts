import { Envelope } from "../src/index.js";
import { IS_A } from "@blockchaincommons/known-values";
import "../src/all.js";

describe("Type System", () => {
  describe("Single type", () => {
    it("should add a single type to an envelope", () => {
      const person = Envelope.from("Alice").addType("Person");

      expect(person.hasType("Person")).toBe(true);
      expect(person.types().length).toBe(1);
      expect(person.getType().expectString()).toBe("Person");
    });
  });

  describe("Multiple types", () => {
    it("should support multiple types on an envelope", () => {
      const multiTyped = Envelope.from("Bob")
        .addType("Person")
        .addType("Employee")
        .addType("Manager");

      expect(multiTyped.types().length).toBe(3);
      expect(multiTyped.hasType("Person")).toBe(true);
      expect(multiTyped.hasType("Employee")).toBe(true);
      expect(multiTyped.hasType("Manager")).toBe(true);
      expect(multiTyped.hasType("Customer")).toBe(false);
    });
  });

  describe("Type validation", () => {
    it("should validate matching types", () => {
      const document = Envelope.from("Contract").addType("LegalDocument");

      expect(() => document.checkType("LegalDocument")).not.toThrow();
    });

    it("should reject non-matching types", () => {
      const document = Envelope.from("Contract").addType("LegalDocument");

      expect(() => document.checkType("Spreadsheet")).toThrow();
    });
  });

  describe("Types combined with other assertions", () => {
    it("should work with other assertions", () => {
      const employee = Envelope.from("Charlie")
        .addType("Person")
        .addType("Employee")
        .addAssertion("department", "Engineering")
        .addAssertion("salary", 75000);

      expect(employee.subject().expectString()).toBe("Charlie");
      expect(employee.hasType("Person")).toBe(true);
      expect(employee.hasType("Employee")).toBe(true);
      expect(employee.objectForPredicate("department").expectString()).toBe("Engineering");
      expect(employee.objectForPredicate("salary").expectNumber()).toBe(75000);
    });
  });

  describe("IS_A predicate", () => {
    it("should work with IS_A predicate directly", () => {
      const typed = Envelope.from("Data").addAssertion(IS_A, "DataSet");

      expect(typed.hasType("DataSet")).toBe(true);
    });
  });
});
