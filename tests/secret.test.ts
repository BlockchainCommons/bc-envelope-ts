/**
 * `/secret`: locking through an SSH agent (`lockWith`, `lockSubjectWith`,
 * `unlockWith`, `unlockSubjectWith`) beside the password methods, with
 * components' in-memory agent.
 */
import { describe, it, expect } from "vitest";
import {
  MemorySshAgent,
  Nonce,
  PrivateKeyBase,
  Salt,
  SymmetricKey,
} from "@blockchaincommons/components";
import type { SSHPrivateKey } from "@blockchaincommons/components/ssh";
import {
  EncryptedKey,
  KeyDerivationMethod,
  SSHAgentParams,
  sshAgentParams,
} from "@blockchaincommons/components/kdf";
import { SeededRng, TEST_SEED } from "@blockchaincommons/rand";
import { HAS_SECRET } from "@blockchaincommons/known-values";
import {
  Envelope,
  EnvelopeError,
  lockSubjectWith,
  lockWith,
  unlockSubjectWith,
  unlockWith,
} from "../src/all.js";

const bytes = (n: number, start = 0): Uint8Array =>
  Uint8Array.from({ length: n }, (_, i) => (start + i) & 0xff);
const hex = (u: Uint8Array): string => Buffer.from(u).toString("hex");
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

/** An Ed25519 identity the in-memory agent holds, named by its comment. */
function identity(seed: Uint8Array, comment: string): SSHPrivateKey {
  const key = PrivateKeyBase.from(seed).sshSigningPrivateKey({ kind: "ed25519" }, comment).asSsh();
  if (key === undefined) throw new Error("not an SSH key");
  return key;
}

const ALICE = identity(bytes(32, 1), "alice@example.com");
const BOB = identity(bytes(32, 2), "bob@example.com");
const agentWith = (...keys: SSHPrivateKey[]): MemorySshAgent =>
  new MemorySshAgent({ identities: keys });
const hello = Envelope.from("Hello.").addAssertion("from", "Alice");

const failure = async (p: Promise<unknown>): Promise<EnvelopeError> => {
  try {
    await p;
  } catch (e) {
    if (EnvelopeError.isEnvelopeError(e)) return e;
    throw e;
  }
  throw new Error("did not throw");
};

describe("lockWith / unlockWith through an SSH agent", () => {
  it("round-trips, preserving the subject digest", async () => {
    const agent = agentWith(ALICE, BOB);
    const locked = await lockWith(hello, agent, "alice@example.com");
    expect(locked.isSubjectEncrypted()).toBe(true);
    expect(locked.isLockedWithSshAgent()).toBe(true);
    expect(locked.isLockedWithPassword()).toBe(false);
    expect(locked.format()).toContain("'hasSecret': EncryptedKey(SSHAgent");
    const opened = await unlockWith(locked, agent, "alice@example.com");
    expect(opened.digest().equals(hello.digest())).toBe(true);
    // The method forms of `/all`.
    const viaMethods = await (
      await hello.lockWith(agent, "alice@example.com")
    ).unlockWith(agent, "alice@example.com");
    expect(viaMethods.isIdenticalTo(hello)).toBe(true);
  });

  it("an empty id selects the only identity; an omitted unlock id uses the stored one", async () => {
    // `lockSubject` keeps the node's assertions and adds `hasSecret`, so the
    // unlocked node is the locked one with its subject back.
    const agent = agentWith(BOB);
    const locked = await lockSubjectWith(hello, agent, "");
    const opened = await unlockSubjectWith(locked, agent);
    expect(opened.subject().isIdenticalTo(hello.subject())).toBe(true);
    expect(opened.digest().equals(locked.digest())).toBe(true);
    const named = await lockSubjectWith(hello, agent, "bob@example.com");
    expect((await unlockSubjectWith(named, agent)).subject().isIdenticalTo(hello.subject())).toBe(
      true,
    );
    // The stored id is the one the lock used.
    const key = named
      .assertionsWithPredicate(HAS_SECRET)[0]
      .object()
      .expectSubject((c) => EncryptedKey.fromCbor(c));
    expect(key.params.type).toBe("sshagent");
    if (key.params.type === "sshagent") expect(key.params.params.id).toBe("bob@example.com");
  });

  it("is deterministic under a fixed salt, nonce and rng", async () => {
    // The agent signs the salt deterministically (Ed25519), the content key
    // and the subject's nonce come from `rng`, the key's nonce is `nonce`.
    const salt = Salt.from(bytes(16, 0x10));
    const nonce = Nonce.from(bytes(12, 0x20));
    const lockOnce = (): Promise<Envelope> =>
      lockWith(hello, agentWith(ALICE), "alice@example.com", {
        salt,
        nonce,
        rng: new SeededRng(TEST_SEED),
      });
    const a = await lockOnce();
    const b = await lockOnce();
    expect(hex(a.toCbor().toData())).toBe(hex(b.toCbor().toData()));
    const secretObject = a.assertionsWithPredicate(HAS_SECRET)[0].object();
    expect(hex(secretObject.toCbor().toData())).toBe(
      "d8c8d8c9d99c5bd99c428458203a58ff2493de277a282231cbf3a08f2ca393c7791844fe942d4f4b4e630bac124c202122232425262728292a2b50cd012f4d0a8b5f1c9182aa0ffdce695f58288304d99c5250101112131415161718191a1b1c1d1e1f71616c696365406578616d706c652e636f6d",
    );
    expect(hex(a.toCbor().toData())).toBe(
      "d8c882d99c4284581e573d2df69b82e3c6ad870fe4c3f2b8717f019f3c8bfb85bdf7b4b0ec7dc84c518684c556472008a67932f7507ab31ea6dc57ad279db641ad57f590505825d99c415820356a76b0f8ac404b779e9ea9ded09a02303f44b68f076284f1939777880fef61a113d8c9d99c5bd99c428458203a58ff2493de277a282231cbf3a08f2ca393c7791844fe942d4f4b4e630bac124c202122232425262728292a2b50cd012f4d0a8b5f1c9182aa0ffdce695f58288304d99c5250101112131415161718191a1b1c1d1e1f71616c696365406578616d706c652e636f6d",
    );
    expect(a.digest().toHex()).toBe(
      "6f2fa59c0d5995d049098cf182109511e7b8849af3e445f148f0483adfe57686",
    );
    expect(a.format()).toBe(
      `ENCRYPTED [\n    'hasSecret': EncryptedKey(SSHAgent("alice@example.com"))\n]`,
    );
    expect((await unlockWith(a, agentWith(ALICE), "alice@example.com")).isIdenticalTo(hello)).toBe(
      true,
    );
  });

  it("a password-locked and an agent-locked key on one envelope open by either route", async () => {
    const agent = agentWith(ALICE);
    const contentKey = SymmetricKey.random();
    const password = utf8("correct horse");
    const agentKey = await EncryptedKey.lockWithAgent(
      sshAgentParams(SSHAgentParams.from()),
      utf8("alice@example.com"),
      contentKey,
      { agent },
    );
    const both = hello
      .encryptSubject(contentKey)
      .addSecret(KeyDerivationMethod.Argon2id, password, contentKey)
      .addAssertion(HAS_SECRET, agentKey);
    expect(both.assertionsWithPredicate(HAS_SECRET)).toHaveLength(2);
    expect(both.isLockedWithPassword()).toBe(true);
    expect(both.isLockedWithSshAgent()).toBe(true);
    // Each route skips the key it cannot open, whatever the reason.
    const subject = hello.subject();
    expect(both.unlockSubject(password).subject().isIdenticalTo(subject)).toBe(true);
    expect(
      (await unlockSubjectWith(both, agent, "alice@example.com")).subject().isIdenticalTo(subject),
    ).toBe(true);
    expect(() => both.unlockSubject(utf8("wrong"))).toThrow(EnvelopeError);
    const wrong = await failure(unlockSubjectWith(both, agentWith(BOB), "bob@example.com"));
    expect(wrong.code).toBe("UnknownSecret");
  });

  it("reports the agent's refusals as Components with components' message", async () => {
    const cases: [string, Promise<Envelope>, string][] = [
      [
        "no Ed25519 identity",
        lockWith(hello, agentWith(), ""),
        "components error: SSH agent error: No Ed25519 identities available in SSH agent",
      ],
      [
        "several identities, no id",
        lockWith(hello, agentWith(ALICE, BOB), ""),
        "components error: SSH agent error: Multiple identities available in SSH agent, but no ID provided",
      ],
      [
        "no identity with that comment",
        lockWith(hello, agentWith(ALICE), "carol@example.com"),
        "components error: SSH agent error: No matching identity found",
      ],
      [
        "the agent refuses to sign",
        lockWith(hello, new MemorySshAgent({ identities: [ALICE], refuseToSign: true }), ""),
        "components error: SSH agent error: SSH agent refused to sign",
      ],
    ];
    for (const [name, p, message] of cases) {
      const e = await failure(p);
      expect(e.code, name).toBe("Components");
      expect(e.message, name).toBe(message);
      expect(e.cause?.name, name).toBe("ComponentsError");
    }
  });

  it("unlocking skips a key the agent cannot open and reports UnknownSecret", async () => {
    const locked = await lockWith(hello, agentWith(ALICE), "alice@example.com");
    for (const [agent, id] of [
      [agentWith(ALICE), "bob@example.com"],
      [agentWith(BOB), ""],
      [agentWith(), "alice@example.com"],
      [new MemorySshAgent({ identities: [ALICE], refuseToSign: true }), "alice@example.com"],
    ] as const) {
      const e = await failure(unlockWith(locked, agent, id));
      expect(e.code).toBe("UnknownSecret");
    }
    // A `hasSecret` object that is not an `EncryptedKey` is an error, not a skip.
    const bogus = Envelope.assertion(HAS_SECRET, "not a key");
    const onlyBogus = hello
      .wrap()
      .encryptSubject(SymmetricKey.random())
      .addAssertionEnvelope(bogus);
    const e = await failure(unlockWith(onlyBogus, agentWith(ALICE), "alice@example.com"));
    expect(e.code).toBe("Cbor");
    // An obscured object is skipped.
    const withElided = locked
      .addAssertionEnvelope(bogus)
      .elide({ removing: [Envelope.from("not a key")] });
    expect(withElided.assertionsWithPredicate(HAS_SECRET)).toHaveLength(2);
    const opened = await unlockWith(withElided, agentWith(ALICE), "alice@example.com");
    expect(opened.isIdenticalTo(hello)).toBe(true);
  });

  it("the synchronous lock and addSecret with the SSH-agent method throw Components", () => {
    const message =
      "components error: invalid data: SSH Agent key derivation cannot be used with lock() - use lockOpt() with sshAgentParams() instead";
    const secret = utf8("alice@example.com");
    for (const attempt of [
      () => hello.lock(KeyDerivationMethod.SSHAgent, secret),
      () => hello.lockSubject(KeyDerivationMethod.SSHAgent, secret),
      () =>
        hello
          .encryptSubject(SymmetricKey.random())
          .addSecret(KeyDerivationMethod.SSHAgent, secret, SymmetricKey.random()),
    ]) {
      let error: unknown;
      try {
        attempt();
      } catch (e) {
        error = e;
      }
      expect(EnvelopeError.isEnvelopeError(error)).toBe(true);
      if (EnvelopeError.isEnvelopeError(error)) {
        expect(error.code).toBe("Components");
        expect(error.message).toBe(message);
      }
    }
    expect(() => hello.addSecret(99 as never, secret, SymmetricKey.random())).toThrow(
      "method must be a KeyDerivationMethod, got 99",
    );
  });
});
