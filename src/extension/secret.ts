/**
 * Secret-based envelope locking and unlocking.
 *
 * A locked envelope has its subject encrypted with a fresh content key and
 * carries that key, locked by a secret, in a `hasSecret` assertion holding
 * components' `EncryptedKey`. A password locks the key through one of the
 * HKDF, PBKDF2, scrypt and Argon2id derivations (`lock`, `lockSubject`,
 * `addSecret`, `unlock`, `unlockSubject`); an SSH agent locks it through a
 * signature over a salt (`lockWith`, `lockSubjectWith`, `unlockWith`,
 * `unlockSubjectWith`).
 *
 * Reference: `Envelope::lock_subject`, `unlock_subject`, `lock`, `unlock`,
 * `add_secret`, `is_locked_with_password` and `is_locked_with_ssh_agent`
 * (`bc-envelope-rust` `extension/secret.rs`). Where the reference reaches the
 * agent at `SSH_AUTH_SOCK` itself (`KeyDerivationMethod::SSHAgent` under the
 * `ssh-agent` feature), the port takes the agent as an argument: components'
 * `SshAgent` interface, which is `MemorySshAgent` in tests and the Node
 * transport of `@blockchaincommons/components/ssh-agent-node` over
 * `SSH_AUTH_SOCK`. This is the reference's
 * `SSHAgentParams::new_opt(salt, id, Some(agent))` injection point, so the
 * derivation (identity selection, the salt signature, HKDF-HMAC-SHA256 and
 * the `[4, Salt, id]` AAD) is the reference's byte for byte.
 */

import {
  EncryptedKey,
  KeyDerivationMethod,
  SSHAgentParams,
  sshAgentParams,
  type SshAgent,
} from "@blockchaincommons/components/kdf";
import { HAS_SECRET } from "@blockchaincommons/known-values";

import { type Envelope } from "../base/envelope";
import type { RngOptions } from "@blockchaincommons/rand";
import { EnvelopeError } from "../base/error";
import { viaComponents, wrapComponents } from "../base/foreign-errors.js";
import { SymmetricKey, type Nonce, type Salt } from "@blockchaincommons/components";

/** `InvalidParameter` unless `method` is one of `KeyDerivationMethod`. */
function checkMethod(method: KeyDerivationMethod): void {
  if (!Object.values(KeyDerivationMethod).includes(method)) {
    throw EnvelopeError.invalidParameter("method", "a KeyDerivationMethod", method);
  }
}

/**
 * Encrypts the subject with a fresh content key and adds a `hasSecret`
 * assertion holding that key locked by `secret` via `method` (the
 * reference's `lock_subject`).
 *
 * `KeyDerivationMethod.SSHAgent` needs an agent, which this synchronous
 * function does not take: it throws `Components` with components' message,
 * where the reference connects to `SSH_AUTH_SOCK` itself. Use
 * {@link lockSubjectWith}.
 *
 * @throws EnvelopeError `InvalidParameter` for a value outside
 *   `KeyDerivationMethod`; `Components` (`components error: <message>`,
 *   `cause` the `ComponentsError`) when components cannot lock the key
 */
export function lockSubject(
  envelope: Envelope,
  method: KeyDerivationMethod,
  secret: Uint8Array,
  options: RngOptions = {},
): Envelope {
  checkMethod(method);
  const contentKey = SymmetricKey.random(options);
  const encryptedKey = viaComponents(() => EncryptedKey.lock(method, secret, contentKey));
  return envelope.encryptSubject(contentKey, options).addAssertion(HAS_SECRET, encryptedKey);
}

/**
 * Decrypts the subject with the content key that `secret` unlocks (the
 * reference's `unlock_subject`): every unobscured `hasSecret` object must
 * decode as an `EncryptedKey`; the first one `secret` opens decrypts the
 * subject; a key it does not open is skipped, whatever the reason (an
 * SSH-agent key, which needs {@link unlockSubjectWith}, is skipped too).
 *
 * @throws EnvelopeError `UnknownSecret` when no key opens; `Cbor` when a
 *   `hasSecret` object is not an `EncryptedKey`; the errors of
 *   `decryptSubject`
 */
export function unlockSubject(envelope: Envelope, secret: Uint8Array): Envelope {
  for (const assertion of envelope.assertionsWithPredicate(HAS_SECRET)) {
    const obj = assertion.asObject();
    if (obj === undefined || obj.isObscured()) continue;

    // A present key must decode (the reference's `?`); a key this secret does not open is skipped.
    const encryptedKey = obj.expectSubject((cbor) => EncryptedKey.fromCbor(cbor));
    let contentKey: SymmetricKey;
    try {
      contentKey = encryptedKey.unlock(secret);
    } catch {
      continue;
    }
    return envelope.decryptSubject(contentKey);
  }

  throw EnvelopeError.unknownSecret();
}

/** `true` when some `hasSecret` assertion was locked by a password method. */
export function isLockedWithPassword(envelope: Envelope): boolean {
  return encryptedKeysOf(envelope).some((key) => key.isPasswordBased());
}

/** `true` when some `hasSecret` assertion was locked by the SSH-agent method. */
export function isLockedWithSshAgent(envelope: Envelope): boolean {
  return encryptedKeysOf(envelope).some((key) => key.isSshAgent());
}

/** The `hasSecret` objects that decode as an `EncryptedKey`; the others are ignored. */
function encryptedKeysOf(envelope: Envelope): EncryptedKey[] {
  const keys: EncryptedKey[] = [];
  for (const assertion of envelope.assertionsWithPredicate(HAS_SECRET)) {
    const obj = assertion.asObject();
    if (obj === undefined) continue;
    try {
      keys.push(obj.expectSubject((cbor) => EncryptedKey.fromCbor(cbor)));
    } catch {
      continue;
    }
  }
  return keys;
}

/**
 * Adds a `hasSecret` assertion holding `contentKey` locked by `secret` via
 * `method` (the reference's `add_secret`), for an envelope whose subject was
 * encrypted with `contentKey`.
 *
 * @throws EnvelopeError `InvalidParameter` for a value outside
 *   `KeyDerivationMethod`; `Components` when components cannot lock the key
 *   (`KeyDerivationMethod.SSHAgent` needs an agent: see {@link lockSubjectWith})
 */
export function addSecret(
  envelope: Envelope,
  method: KeyDerivationMethod,
  secret: Uint8Array,
  contentKey: SymmetricKey,
): Envelope {
  checkMethod(method);
  const encryptedKey = viaComponents(() => EncryptedKey.lock(method, secret, contentKey));
  return envelope.addAssertion(HAS_SECRET, encryptedKey);
}

/** Wraps the envelope and locks the wrapper's subject (the reference's `lock`; see `lockSubject`). */
export function lock(
  envelope: Envelope,
  method: KeyDerivationMethod,
  secret: Uint8Array,
  options: RngOptions = {},
): Envelope {
  return lockSubject(envelope.wrap(), method, secret, options);
}

/** Unlocks a subject locked with `lock` and unwraps it (the reference's `unlock`; see `unlockSubject`). */
export function unlock(envelope: Envelope, secret: Uint8Array): Envelope {
  return unlockSubject(envelope, secret).unwrap();
}

// ============================================================================
// SSH agent
// ============================================================================

/** Options for `lockWith` and `lockSubjectWith`. */
export interface LockWithOptions extends RngOptions {
  /**
   * Use exactly this nonce for the locked content key (the `EncryptedKey`
   * nonce); tests and vectors only. The subject's nonce is drawn from `rng`.
   */
  nonce?: Nonce | undefined;
  /** The salt the agent signs (16 random bytes unless given); tests and vectors only. */
  salt?: Salt | undefined;
}

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/**
 * Encrypts the subject with a fresh content key and adds a `hasSecret`
 * assertion holding that key locked through `agent`: the reference's
 * `lock_subject(KeyDerivationMethod::SSHAgent, id)` under the `ssh-agent`
 * feature, with the agent injected as `SSHAgentParams::new_opt(salt, id,
 * Some(agent))` does.
 *
 * `id` names the Ed25519 identity by its comment; an empty `id` selects the
 * agent's only Ed25519 identity. The agent signs the salt, the key is
 * HKDF-HMAC-SHA256 of that signature with the salt, and the content key is
 * encrypted under it with the `[4, Salt, id]` parameters as AAD.
 *
 * @throws EnvelopeError `Components` (`components error: <message>`, `cause`
 *   the `ComponentsError`) when the agent has no Ed25519 identity, several
 *   identities and no `id`, no identity with that comment, or refuses to sign
 */
export async function lockSubjectWith(
  envelope: Envelope,
  agent: SshAgent,
  id: string,
  options: LockWithOptions = {},
): Promise<Envelope> {
  const { nonce, salt, rng } = options;
  const rngOptions: RngOptions = rng === undefined ? {} : { rng };
  const contentKey = SymmetricKey.random(rngOptions);
  const params = sshAgentParams(SSHAgentParams.from(salt === undefined ? {} : { salt }));
  let encryptedKey: EncryptedKey;
  try {
    encryptedKey = await EncryptedKey.lockWithAgent(
      params,
      utf8(id),
      contentKey,
      nonce === undefined ? { agent } : { agent, nonce },
    );
  } catch (error) {
    throw wrapComponents(error);
  }
  return envelope.encryptSubject(contentKey, rngOptions).addAssertion(HAS_SECRET, encryptedKey);
}

/** Wraps the envelope and locks the wrapper's subject through `agent` (see `lockSubjectWith`). */
export async function lockWith(
  envelope: Envelope,
  agent: SshAgent,
  id: string,
  options: LockWithOptions = {},
): Promise<Envelope> {
  return lockSubjectWith(envelope.wrap(), agent, id, options);
}

/**
 * Decrypts the subject with the content key `agent` unlocks: the
 * reference's `unlock_subject(id)` under the `ssh-agent` feature. Every
 * unobscured `hasSecret` object must decode as an `EncryptedKey`; a key
 * locked through an agent is opened with the identity `id` names, else the
 * identity stored in the key, else the agent's first Ed25519 identity; a key
 * locked by a password is tried with `id` as the password. The first key
 * that opens decrypts the subject; one that does not is skipped, whatever
 * the reason.
 *
 * @throws EnvelopeError `UnknownSecret` when no key opens; `Cbor` when a
 *   `hasSecret` object is not an `EncryptedKey`; the errors of
 *   `decryptSubject`
 */
export async function unlockSubjectWith(
  envelope: Envelope,
  agent: SshAgent,
  id = "",
): Promise<Envelope> {
  const secret = utf8(id);
  for (const assertion of envelope.assertionsWithPredicate(HAS_SECRET)) {
    const obj = assertion.asObject();
    if (obj === undefined || obj.isObscured()) continue;

    const encryptedKey = obj.expectSubject((cbor) => EncryptedKey.fromCbor(cbor));
    let contentKey: SymmetricKey;
    try {
      contentKey = await encryptedKey.unlockWithAgent(secret, { agent });
    } catch {
      continue;
    }
    return envelope.decryptSubject(contentKey);
  }

  throw EnvelopeError.unknownSecret();
}

/** Unlocks a subject locked with `lockWith` and unwraps it (see `unlockSubjectWith`). */
export async function unlockWith(envelope: Envelope, agent: SshAgent, id = ""): Promise<Envelope> {
  return (await unlockSubjectWith(envelope, agent, id)).unwrap();
}
