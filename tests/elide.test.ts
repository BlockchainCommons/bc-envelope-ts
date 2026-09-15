import { Envelope } from "../src";
import "../src/all.js";

describe("Elision Extension", () => {
  describe("Basic elision", () => {
    it("should elide envelope and preserve digest", () => {
      const envelope = Envelope.from("Secret message");
      const elided = envelope.elide();

      expect(envelope.digest().equals(elided.digest())).toBe(true);
      expect(elided.case.type).toBe("elided");
    });
  });

  describe("Selective elision", () => {
    it("should elide specific assertions", () => {
      const person = Envelope.from("Alice")
        .addAssertion("name", "Alice Smith")
        .addAssertion("age", 30)
        .addAssertion("ssn", "123-45-6789");

      const assertions = person.assertions();
      const ssnAssertion = assertions.find((a) => {
        const c = a.case;
        if (c.type === "assertion") {
          const pred = c.assertion.predicate();
          if (pred.case.type === "leaf") {
            try {
              return pred.asText() === "ssn";
            } catch {
              return false;
            }
          }
        }
        return false;
      });

      if (ssnAssertion) {
        const targetSet = new Set([ssnAssertion.digest()]);
        const redacted = person.elide({ removing: targetSet });

        expect(person.digest().equals(redacted.digest())).toBe(true);
      }
    });
  });

  describe("Reveal specific elements", () => {
    it("should reveal only specified elements", () => {
      const person = Envelope.from("Alice")
        .addAssertion("name", "Alice Smith")
        .addAssertion("age", 30)
        .addAssertion("ssn", "123-45-6789");

      const assertions = person.assertions();
      const nameAssertion = assertions.find((a) => {
        const c = a.case;
        if (c.type === "assertion") {
          const pred = c.assertion.predicate();
          if (pred.case.type === "leaf") {
            try {
              return pred.asText() === "name";
            } catch {
              return false;
            }
          }
        }
        return false;
      });

      if (nameAssertion) {
        const revealSet = new Set([person.subject().digest(), nameAssertion.digest()]);

        const selective = person.elide({ revealing: revealSet });

        expect(person.digest().equals(selective.digest())).toBe(true);
      }
    });
  });

  describe("Elide multiple assertions", () => {
    it("should elide multiple targets using array", () => {
      const person = Envelope.from("Alice")
        .addAssertion("name", "Alice Smith")
        .addAssertion("age", 30)
        .addAssertion("ssn", "123-45-6789");

      const targets = person.assertions().slice(1, 3);
      const multiElided = person.elide({ removing: targets });

      expect(person.digest().equals(multiElided.digest())).toBe(true);
    });
  });

  describe("Un-elide / reveal", () => {
    it("should un-elide with original envelope", () => {
      const envelope = Envelope.from("Secret message");
      const elided = envelope.elide();

      const revealed = elided.unelide(envelope);

      expect(revealed.digest().equals(envelope.digest())).toBe(true);
      expect(revealed.asText()).toBe("Secret message");
    });
  });

  describe("Identity check", () => {
    it("should identify identical envelopes", () => {
      const env1 = Envelope.from("Hello");
      const env2 = Envelope.from("Hello");
      const wrapped = env1.wrap();

      expect(env1.isIdenticalTo(env2)).toBe(true);
      expect(env1.isIdenticalTo(wrapped)).toBe(false);
    });
  });

  describe("Nested elision", () => {
    it("should elide nested envelope assertions", () => {
      const company = Envelope.from("Company")
        .addAssertion("name", "ACME Corp")
        .addAssertion(
          "CEO",
          Envelope.from("Bob").addAssertion("age", 45).addAssertion("email", "bob@acme.com"),
        );

      const ceoAssertion = company.assertions().find((a) => {
        const c = a.case;
        if (c.type === "assertion") {
          const pred = c.assertion.predicate();
          if (pred.case.type === "leaf") {
            try {
              return pred.asText() === "CEO";
            } catch {
              return false;
            }
          }
        }
        return false;
      });

      if (ceoAssertion) {
        const nestedElided = company.elide({ removing: [ceoAssertion] });

        expect(company.digest().equals(nestedElided.digest())).toBe(true);
      }
    });
  });
});

describe("the encrypt action on obscured targets", () => {
  it("encrypts an already encrypted target and decrypts back to the original", async () => {
    const { SymmetricKey } = await import("@blockchaincommons/components");
    const key = SymmetricKey.random();
    const envelope = Envelope.from("s").addAssertion("p", "o");
    const target = envelope.assertions()[0];
    const once = envelope.elide({ removing: [target], action: { encrypt: key } });
    const twice = once.elide({ removing: [target], action: { encrypt: key } });
    expect(twice.formatFlat()).toBe('"s" [ ENCRYPTED ]');
    expect(twice.digest().equals(envelope.digest())).toBe(true);
    expect(twice.walkDecrypt([key]).isEquivalentTo(envelope)).toBe(true);
  });

  it("encrypts an already elided target, keeping the digest", async () => {
    const { SymmetricKey } = await import("@blockchaincommons/components");
    const key = SymmetricKey.random();
    const envelope = Envelope.from("s").addAssertion("p", "o");
    const target = envelope.assertions()[0];
    const elided = envelope.elide({ removing: [target] });
    const encrypted = elided.elide({ removing: [target], action: { encrypt: key } });
    expect(encrypted.formatFlat()).toBe('"s" [ ENCRYPTED ]');
    expect(encrypted.digest().equals(envelope.digest())).toBe(true);
  });

  it("the compress action still rejects encrypted and elided targets", async () => {
    const { SymmetricKey } = await import("@blockchaincommons/components");
    const key = SymmetricKey.random();
    const envelope = Envelope.from("s").addAssertion("p", "o");
    const target = envelope.assertions()[0];
    const encrypted = envelope.elide({ removing: [target], action: { encrypt: key } });
    expect(() => encrypted.elide({ removing: [target], action: "compress" })).toThrow(
      "envelope was already encrypted or compressed, so it cannot be encrypted",
    );
    const elided = envelope.elide({ removing: [target] });
    expect(() => elided.elide({ removing: [target], action: "compress" })).toThrow(
      "envelope was elided, so it cannot be compressed or encrypted",
    );
  });

  it("encryptSubject keeps its checks", async () => {
    const { SymmetricKey } = await import("@blockchaincommons/components");
    const key = SymmetricKey.random();
    const encrypted = Envelope.from("s").encryptSubject(key);
    expect(() => encrypted.encryptSubject(key)).toThrow(
      "envelope was already encrypted or compressed, so it cannot be encrypted",
    );
    expect(() => Envelope.from("s").elide().encryptSubject(key)).toThrow(
      "envelope was elided, so it cannot be compressed or encrypted",
    );
  });
});
