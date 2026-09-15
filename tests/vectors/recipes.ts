/**
 * The envelope recipe language: pure data from which every vector is
 * materialised, plus the adapters that run a recipe against the frozen
 * baseline bundle or the working tree.
 *
 * An `E` recipe builds one envelope (or runs one operation on a built
 * envelope); `Out` selects what to report. Kinds whose output involves
 * fresh randomness (encryption nonces, Schnorr aux bytes, sealed ephemeral
 * keys, salts and KDF salts without a seeded RNG) report only the stable
 * outputs: digest and the format strings. A rejection is rendered as
 * `throw:<code>[<inner code>]|<message>`, the reference's error variant,
 * the variant it wraps and its Display, so the Rust harness compares the
 * message too.
 */
import { baselineShapedAdapterFor } from "./baseline-adapter";
import { workingTreeShapedAdapterFor } from "./working-tree-adapter";

export type Leaf =
  | { t: "text"; v: string }
  | { t: "int"; v: string }
  | { t: "bytes"; hex: string }
  | { t: "bool"; v: boolean }
  | { t: "null" }
  | { t: "float"; v: number }
  | { t: "date"; ms: number }
  | { t: "array"; items: Leaf[] }
  | { t: "map"; entries: [Leaf, Leaf][] }
  | { t: "arid"; hex: string }
  | { t: "digest"; hex: string }
  | { t: "uuid"; hex: string }
  | { t: "uri"; v: string }
  /** A known value built in memory; `name` gives it an assigned name (the reference's `KnownValue::new_with_name`). */
  | { t: "kv"; v: number | string; name?: string }
  /** Any dCBOR item, given as its encoded bytes (a tag-1 date with sub-millisecond precision, `1(NaN)`, a bignum, a mis-tagged known value, …). */
  | { t: "cbor"; hex: string };

export type Seed = [string, string, string, string];
/**
 * Signing schemes: the three secp256k1/Ed25519 forms sign deterministically
 * (Schnorr with a seeded `rng`); `ssh-ed25519` needs SSH signing options and
 * signs deterministically; `mldsa44` signs with fresh randomness, so the
 * reference verifies the TypeScript signature instead of reproducing it.
 */
export type Scheme = "ed25519" | "ecdsa" | "schnorr" | "ssh-ed25519" | "mldsa44";
/** Recipient key types: X25519 from a seed, ML-KEM (the row carries the private key), or a low-order X25519 point. */
export type RecipientScheme = "x25519" | "mlkem512" | "lowOrder";
export type KdfMethod = "hkdf" | "pbkdf2" | "scrypt" | "argon2id";

/** What `extract` decodes the subject as: the reference's `extract_subject::<T>()` type. */
export type ExtractDecoder =
  | "envelope"
  | "digest"
  | "knownValue"
  | "encryptedMessage"
  | "compressed"
  | "text"
  | "u64"
  | "i64"
  | "f64"
  | "bool"
  | "null"
  | "bytes"
  | "date"
  | "arid"
  /** A decoder returning the CBOR itself: no reference type has `T = CBOR` (js-only). */
  | "passthrough";

export type Predicate =
  | "isTrue"
  | "isFalse"
  | "isBool"
  | "isNull"
  | "isNumber"
  | "isNaN"
  | "isSubjectNumber"
  | "isSubjectUnit";

/**
 * A custom format context for `fmt` rows: an empty tags store, the listed
 * known values, and (with `register`) the envelope summarisers registered
 * in it, as the reference's `register_tags_in`.
 */
export interface FmtContext {
  knownValues?: [number | string, string][];
  tags?: [number, string][];
  register?: boolean;
}

export type E =
  | { k: "leaf"; v: Leaf }
  | { k: "kv"; v: number | string; name?: string }
  | { k: "node"; subject: E; assertions: [E, E][] }
  | { k: "wrap"; e: E }
  | { k: "assertion"; pred: E; obj: E }
  | {
      k: "elide";
      e: E;
      removing?: E[];
      revealing?: E[];
      action?: "elide" | "compress" | { encrypt: string };
    }
  | { k: "encrypt"; e: E; key: string; subject?: boolean; nonce?: string }
  | { k: "compress"; e: E; subject?: boolean }
  /**
   * `sign`: `seed` names the `PrivateKeyBase`; `ssh` gives the SSH signing
   * options (without them the reference's `sign_with_options` unwrap panics
   * and the port throws `Components`); `comment` is the SSH key's comment;
   * `rng` seeds Schnorr's auxiliary randomness.
   */
  | {
      k: "sign";
      e: E;
      seed: string;
      scheme: Scheme;
      note?: string;
      ssh?: { namespace: string; hashAlg: "sha256" | "sha512" };
      comment?: string;
      rng?: Seed;
    }
  /** `addSalt`: fixed `len`, a `range` (`[min, max]`, the reference's `RangeInclusive<usize>`), or proportional. */
  | { k: "salt"; e: E; rng: Seed; len?: number; range?: [number, number] }
  | {
      k: "sskr";
      e: E;
      key: string;
      spec: { gt: number; groups: { mt: number; mc: number }[] };
      rng: Seed;
    }
  /** Raw SSKR share bytes attached as `sskrShare` assertions of `e` (an encrypted envelope), then joined. */
  | { k: "sskrJoinRaw"; e: E; shares: string[] }
  | { k: "attach"; e: E; payload: E; vendor: string; conformsTo?: string }
  | { k: "type"; e: E; type: E }
  /** `setPosition`; `pos` is a decimal string so `u64` values above 2^53 stay exact. */
  | { k: "position"; e: E; pos: string }
  | {
      k: "request";
      func: string | number;
      id: string;
      params: [string | number, E][];
      note?: string;
      date?: number;
    }
  | { k: "response"; id: string; result?: E; error?: E }
  /** `Response` builder calls the reference panics on (`with_result` on a failure, …). */
  | { k: "responseOp"; op: "resultOnFailure" | "errorOnSuccess" | "expectIdEarly"; id: string }
  /**
   * `encryptSubject(key)` then `addRecipient`. With `nonce` (the subject
   * nonce), `sealNonce` and `rng` the bytes are exact: the reference opens
   * the TypeScript sealed message with the recipient key and rebuilds the
   * envelope around it. `mlkem512` rows carry the private key in the
   * outcome; `lowOrder` seals to a low-order X25519 point (nobody can open
   * it), so only the stable views are compared.
   */
  | {
      k: "recipient";
      e: E;
      key: string;
      recipientSeed: string;
      scheme?: RecipientScheme;
      nonce?: string;
      sealNonce?: string;
      rng?: Seed;
    }
  /**
   * `lock(method, secret)`. With `key`, `nonce` and `salt` the row is
   * composed from the components primitives (the KDF salt and the subject
   * nonce fixed; the encrypted key's nonce is drawn by components) and the
   * reference unlocks the TypeScript encrypted key, checks its parameters
   * and rebuilds the envelope around it.
   */
  | {
      k: "lock";
      e: E;
      secret: string;
      method: KdfMethod;
      key?: string;
      nonce?: string;
      salt?: string;
    }
  /**
   * `seal(sender, recipient)`: with `nonce` (the subject nonce) and `rng`
   * the reference recovers the content key from the TypeScript sealed
   * message and rebuilds the sealed envelope byte for byte.
   */
  | { k: "seal"; e: E; seed: string; recipientSeed: string; nonce?: string; rng?: Seed }
  /**
   * `lockWith(agent, id, { salt, nonce, rng })` over an in-memory SSH agent
   * holding `identities`. Compared in the harness's `agent` build (the
   * default build reports the row `build-scoped`).
   */
  | {
      k: "agentLock";
      e: E;
      identities: { seed: string; comment: string }[];
      id: string;
      salt: string;
      nonce: string;
      rng: Seed;
      refuse?: boolean;
    }
  /** `unlockWith(agent, id)` on a reference-produced locked envelope (`hex`, tagged CBOR). */
  | {
      k: "agentUnlock";
      hex: string;
      identities: { seed: string; comment: string }[];
      id?: string;
    }
  | { k: "decode"; hex: string }
  | { k: "ur"; s: string }
  /** A node built from assertion *envelopes* (salted ones included). */
  | { k: "nodeEnv"; subject: E; assertions: E[] }
  /** A reference-produced `hasRecipient` envelope decrypted by the recipient's PrivateKeyBase. */
  | { k: "recipientDecode"; ur: string; recipientSeed: string }
  /** A decoded envelope (`hex`, tagged CBOR) formatted with the options `outs` select, optionally in a custom context. */
  | { k: "fmt"; hex: string; context?: FmtContext }
  /** `extract_subject::<T>()`: the outcome is `ok:<rendering>` or a throw. */
  | { k: "extract"; e: E; decoder: ExtractDecoder }
  /** A boolean query on the envelope. */
  | { k: "pred"; e: E; pred: Predicate }
  /** One operation on a built envelope; the outcome is the result's outputs or a throw. */
  | {
      k: "op";
      op: Op;
      e: E;
      key?: string;
      recipientSeed?: string;
      func?: string | number;
      seed?: string;
      /** A verifying key given as raw bytes instead of a seed (`verify`). */
      pub?: string;
      assertion?: E;
      salt?: boolean;
      /** A fixed 12-byte nonce for `encryptSubject`, hex. */
      nonce?: string;
      secret?: string;
      param?: string | number;
    }
  /** `inner` run before the envelope tags and summarisers are registered (the harness runs these rows first). */
  | { k: "noreg"; inner: E }
  /** Registrations made after the global format context exists, then `inner` formatted: the context keeps its snapshot. */
  | { k: "late"; knownValues?: [number, string][]; tags?: [number, string][]; inner: E }
  /**
   * A named JS-only input case; `cls` is its class: J1 a non-integer number,
   * J2 a negative or out-of-range number, J3 a value the reference's types
   * cannot express, J4 a reference surface the port reaches differently.
   */
  | { k: "domain"; case: string; cls: "J1" | "J2" | "J3" | "J4" };

export type Op =
  | "encryptSubject"
  | "decryptSubject"
  | "compress"
  | "decompress"
  | "decryptToRecipient"
  | "attachmentPayload"
  | "attachmentVendor"
  | "attachmentConformsTo"
  | "validateAttachment"
  | "expectAttachment"
  | "requestFrom"
  | "requestParams"
  | "eventFrom"
  | "responseFrom"
  | "roundtrip"
  | "addAssertionEnvelope"
  | "verify"
  | "position"
  | "walkDecrypt"
  | "recipients"
  | "unlock"
  | "sskrJoin"
  | "unwrap"
  | "expectString"
  | "expectNumber"
  | "expectDate"
  | "checkSubjectUnit";

/** Recipe kinds (and ops) the frozen baseline bundle has no equivalent for, at any depth. */
export function isBaselineSupported(e: E): boolean {
  const children = (): E[] => {
    const out: E[] = [];
    for (const key of [
      "e",
      "subject",
      "pred",
      "obj",
      "payload",
      "type",
      "result",
      "error",
      "inner",
    ] as const) {
      const sub = (e as Record<string, unknown>)[key];
      if (sub !== undefined && typeof sub === "object" && "k" in (sub as object))
        out.push(sub as E);
    }
    if (e.k === "node") for (const [p, o] of e.assertions) out.push(p, o);
    if (e.k === "nodeEnv") out.push(...e.assertions);
    if (e.k === "request") for (const [, v] of e.params) out.push(v);
    if (e.k === "elide") out.push(...(e.removing ?? []), ...(e.revealing ?? []));
    if (e.k === "op" && e.assertion !== undefined) out.push(e.assertion);
    return out;
  };
  const own = (): boolean => {
    switch (e.k) {
      case "domain":
      case "sskrJoinRaw":
      case "responseOp":
      case "seal":
      case "agentLock":
      case "agentUnlock":
      case "fmt":
      case "extract":
      case "pred":
      case "noreg":
      case "late":
        return false;
      case "leaf":
        return (
          e.v.t !== "cbor" &&
          !(e.v.t === "kv" && (e.v.name !== undefined || typeof e.v.v === "string"))
        );
      case "kv":
        return e.name === undefined && typeof e.v !== "string";
      case "position":
        return Number.isSafeInteger(Number(e.pos));
      case "salt":
        // The frozen bundle's `addSaltInRange` takes no generator, and its
        // proportional salt drew the length through the 32-bit sampler.
        return e.range === undefined && e.len !== undefined;
      case "encrypt":
        // The frozen bundle has no `{ nonce }` option.
        return e.nonce === undefined;
      case "sign":
        return e.scheme !== "ssh-ed25519" && e.scheme !== "mldsa44" && e.rng === undefined;
      case "recipient":
        return e.scheme === undefined && e.nonce === undefined && e.rng === undefined;
      case "lock":
        return e.key === undefined;
      case "request":
        return e.params.every(([p]) => typeof p !== "string" || !p.startsWith("#"));
      case "op":
        return (
          e.nonce === undefined &&
          e.pub === undefined &&
          [
            "encryptSubject",
            "decryptSubject",
            "compress",
            "decompress",
            "decryptToRecipient",
            "roundtrip",
            "addAssertionEnvelope",
          ].includes(e.op)
        );
      default:
        return true;
    }
  };
  return own() && children().every(isBaselineSupported);
}

export type Recipe = { e: E; out?: Out[] };
export type Out =
  | "cbor"
  | "ur"
  | "digest"
  | "format"
  | "flat"
  | "tree"
  | "treeDigests"
  | "mermaid"
  | "diagnostic"
  | "hex"
  | "summary"
  /** `format` with no context: no tag names, known values by their own name. */
  | "none"
  | "flatNone"
  | "treeNone"
  /** `diagnostic` annotated through the format context. */
  | "diagAnn"
  /** The plain hex string. */
  | "hexPlain";
export const ALL_OUT: Out[] = [
  "cbor",
  "ur",
  "digest",
  "format",
  "flat",
  "tree",
  "treeDigests",
  "mermaid",
  "diagnostic",
  "hex",
  "summary",
];
/** The `fmt` outputs: every rendering the format context influences. */
export const FMT_OUT: Out[] = [
  "format",
  "flat",
  "tree",
  "none",
  "flatNone",
  "treeNone",
  "diagnostic",
  "diagAnn",
  "hex",
  "hexPlain",
  "summary",
];
/**
 * Randomness classes. `bytes`: fresh nonces or ephemeral keys change the
 * bytes but the digest tree is the plaintext's (encryption, elision by
 * encryption). `digest`: a randomised assertion is added (Schnorr aux
 * randomness, sealed content keys, KDF salts), so only the format strings
 * are stable.
 */
export type Randomness = "none" | "bytes" | "digest";
export const BYTES_STABLE_OUT: Out[] = [
  "digest",
  "format",
  "flat",
  "tree",
  "treeDigests",
  "mermaid",
  "summary",
];
export const DIGEST_STABLE_OUT: Out[] = ["format", "flat", "summary"];

export function randomnessOf(e: E): Randomness {
  let level: Randomness = "none";
  const bump = (r: Randomness): void => {
    if (r === "digest" || (r === "bytes" && level === "none")) level = r;
  };
  if (e.k === "encrypt" && e.nonce === undefined) bump("bytes");
  if (e.k === "op" && e.op === "encryptSubject" && e.nonce === undefined) bump("bytes");
  // a fresh salt changes the digest tree; only the formats are stable
  if (e.k === "op" && e.op === "addAssertionEnvelope" && e.salt === true) bump("digest");
  if (e.k === "nodeEnv") {
    bump(randomnessOf(e.subject));
    for (const a of e.assertions) bump(randomnessOf(a));
  }
  if (e.k === "op" && e.assertion !== undefined) bump(randomnessOf(e.assertion));
  if (e.k === "elide" && typeof e.action === "object") bump("bytes");
  if (
    e.k === "recipient" &&
    (e.rng === undefined || e.nonce === undefined || e.scheme === "lowOrder")
  )
    bump("digest");
  if (e.k === "lock" && (e.key === undefined || e.nonce === undefined || e.salt === undefined))
    bump("digest");
  if (e.k === "seal" && (e.rng === undefined || e.nonce === undefined)) bump("digest");
  if (e.k === "sign" && e.scheme === "schnorr" && e.rng === undefined) bump("digest");
  if (e.k === "sign" && e.scheme === "mldsa44") bump("digest");
  if (e.k === "sign" && e.scheme === "ssh-ed25519" && e.ssh === undefined) bump("digest");
  for (const key of [
    "e",
    "subject",
    "pred",
    "obj",
    "payload",
    "type",
    "result",
    "error",
    "inner",
  ] as const) {
    const sub = (e as Record<string, unknown>)[key];
    if (sub !== undefined && typeof sub === "object" && "k" in (sub as object))
      bump(randomnessOf(sub as E));
  }
  if (e.k === "node") {
    for (const [p, o] of e.assertions) {
      bump(randomnessOf(p));
      bump(randomnessOf(o));
    }
  }
  if (e.k === "request") for (const [, v] of e.params) bump(randomnessOf(v));
  if (e.k === "elide")
    for (const x of [...(e.removing ?? []), ...(e.revealing ?? [])]) bump(randomnessOf(x));
  return level;
}

export function outputsFor(r: Recipe): Out[] {
  if (r.out !== undefined) return r.out;
  const e = r.e;
  if (e.k === "fmt") return FMT_OUT;
  if (e.k === "noreg" || e.k === "late") {
    // The UR string needs the envelope tag's name, which the reference
    // registers when its format context is first built; the outputs that
    // build it come first.
    const inner = outputsFor({ e: e.inner });
    return inner.filter((o) => o !== "ur");
  }
  const level = randomnessOf(e);
  return level === "none" ? ALL_OUT : level === "bytes" ? BYTES_STABLE_OUT : DIGEST_STABLE_OUT;
}

export type Outcome = string;
export interface VectorApi {
  run(r: Recipe): Outcome;
  /** The recipes whose operation is asynchronous (`agentLock`, `agentUnlock`); absent on the frozen baseline. */
  runAsync?(r: Recipe): Promise<Outcome>;
  /** `<code>[<inner code>]` of a thrown value. */
  errorCode(e: unknown): string;
  /** The thrown value's message; absent on the frozen baseline (messages are not compared there). */
  errorMessage?(e: unknown): string;
}

export const hex = (u: Uint8Array): string => Buffer.from(u).toString("hex");
export const unhex = (h: string): Uint8Array => Uint8Array.from(Buffer.from(h, "hex"));
export const SEP = "\n---\n";

export function recipeName(r: Recipe): string {
  const short = (e: E): string => {
    switch (e.k) {
      case "nodeEnv":
        return `nodeEnv(${short(e.subject)}; ${e.assertions.map(short).join(", ")})`;
      case "recipientDecode":
        return `recipientDecode ${e.ur.slice(12, 28)}… seed=${e.recipientSeed.slice(0, 8)}`;
      case "op":
        return `op ${e.op}(${short(e.e)}${e.assertion ? "; " + short(e.assertion) + (e.salt ? " salted" : "") : ""}${e.func !== undefined ? "; fn=" + String(e.func) : ""}${e.param !== undefined ? "; param=" + String(e.param) : ""}${e.recipientSeed ? "; to=" + e.recipientSeed.slice(0, 8) : ""}${e.pub ? "; pub=" + e.pub.slice(0, 8) : ""}${e.secret ? "; secret=" + e.secret.slice(0, 8) : ""})`;
      case "domain":
        return `domain ${e.case} (${e.cls})`;
      case "leaf":
        return `leaf:${e.v.t}${"v" in e.v ? ":" + String(e.v.v).slice(0, 16) : "hex" in e.v ? ":" + e.v.hex.slice(0, 16) : ""}${"name" in e.v && e.v.name !== undefined ? `:${e.v.name}` : ""}`;
      case "kv":
        return `kv:${e.v}${e.name !== undefined ? `:${e.name}` : ""}`;
      case "node":
        return `node(${short(e.subject)}+${e.assertions.length})`;
      case "wrap":
        return `wrap(${short(e.e)})`;
      case "assertion":
        return `assertion(${short(e.pred)}:${short(e.obj)})`;
      case "elide":
        return `elide[${typeof e.action === "object" ? "encrypt" : (e.action ?? "elide")}](${short(e.e)})`;
      case "encrypt":
        return `encrypt${e.subject ? "Subject" : ""}${e.nonce ? ":nonce" : ""}(${short(e.e)})`;
      case "compress":
        return `compress${e.subject ? "Subject" : ""}(${short(e.e)})`;
      case "sign":
        return `sign:${e.scheme}${e.ssh ? `:${e.ssh.namespace}/${e.ssh.hashAlg}` : ""}${e.note ? ":note" : ""}(${short(e.e)})`;
      case "salt":
        return `salt${e.len !== undefined ? `:${e.len}` : e.range ? `:${e.range[0]}..=${e.range[1]}` : ""}(${short(e.e)})`;
      case "sskr":
        return `sskr:${e.spec.gt}/${e.spec.groups.map((g) => `${g.mt}of${g.mc}`).join(",")}(${short(e.e)})`;
      case "sskrJoinRaw":
        return `sskrJoinRaw[${e.shares.map((s) => s.slice(0, 8)).join(",")}](${short(e.e)})`;
      case "attach":
        return `attach:${e.vendor}(${short(e.e)})`;
      case "type":
        return `type(${short(e.e)})`;
      case "position":
        return `position:${e.pos}(${short(e.e)})`;
      case "request":
        return `request:${e.func}${e.note !== undefined ? ":note" : ""}${e.date !== undefined ? ":date" : ""}${e.params.length > 0 ? `[${e.params.map(([p]) => String(p)).join(",")}]` : ""}`;
      case "response":
        return `response:${e.result ? "ok" : "err"}`;
      case "responseOp":
        return `responseOp ${e.op}`;
      case "recipient":
        return `recipient${e.scheme ? `:${e.scheme}` : ""}${e.nonce ? ":exact" : ""}(${short(e.e)})`;
      case "lock":
        return `lock:${e.method}${e.key ? ":exact" : ""}(${short(e.e)})`;
      case "seal":
        return `seal${e.nonce ? ":exact" : ""}(${short(e.e)})`;
      case "agentLock":
        return `agentLock[${e.identities.map((i) => i.comment).join(",")}]${e.refuse ? " refuse" : ""} id=${JSON.stringify(e.id)}(${short(e.e)})`;
      case "agentUnlock":
        return `agentUnlock[${e.identities.map((i) => i.comment).join(",")}]${e.id !== undefined ? ` id=${JSON.stringify(e.id)}` : ""} ${e.hex.slice(0, 16)}`;
      case "decode":
        return `decode:${e.hex.slice(0, 24)}`;
      case "ur":
        return `ur:${e.s.slice(0, 24)}`;
      case "fmt":
        return `fmt${e.context ? `[${e.context.register ? "registered" : "custom"}]` : ""}:${e.hex.slice(0, 24)}`;
      case "extract":
        return `extract ${e.decoder}(${short(e.e)})`;
      case "pred":
        return `${e.pred}(${short(e.e)})`;
      case "noreg":
        return `noreg ${short(e.inner)}`;
      case "late":
        return `late ${short(e.inner)}`;
    }
  };
  return short(r.e);
}

export interface MaterializeOptions {
  /** Append the error message to a `throw:` outcome (the Rust harness compares it). */
  messages?: boolean;
}

export function materialize(
  api: VectorApi,
  r: Recipe,
  { messages = false }: MaterializeOptions = {},
): Outcome {
  try {
    return api.run(r);
  } catch (e) {
    return thrown(api, e, messages);
  }
}
/** `materialize` for a recipe whose operation may be asynchronous. */
export async function materializeAsync(
  api: VectorApi,
  r: Recipe,
  { messages = false }: MaterializeOptions = {},
): Promise<Outcome> {
  try {
    return api.runAsync === undefined ? api.run(r) : await api.runAsync(r);
  } catch (e) {
    return thrown(api, e, messages);
  }
}
function thrown(api: VectorApi, e: unknown, messages: boolean): Outcome {
  const code = api.errorCode(e);
  if (!messages || api.errorMessage === undefined) return `throw:${code}`;
  return `throw:${code}|${api.errorMessage(e)}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the frozen baseline and the working tree expose different module shapes; each adapter narrows what it touches. */
/** The sibling modules an adapter needs for keys, ids, specs and RNGs. */
export interface Deps {
  components: any;
  rand: any;
  sskr: any;
  /** Build a seeded RNG from four decimal strings. */
  seededRng(seed: Seed): any;
}

export function baselineAdapterFor(m: any, deps: Deps): VectorApi {
  return baselineShapedAdapterFor(m, deps);
}
export function workingTreeAdapterFor(m: any, deps: Deps): VectorApi {
  return workingTreeShapedAdapterFor(m, deps);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
