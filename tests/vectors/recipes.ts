/**
 * The envelope recipe language (Phase 1.1): pure data from which every
 * vector is materialised, plus the adapters that run a recipe against the
 * frozen baseline bundle or the working tree.
 *
 * An `E` recipe builds one envelope; `Out` selects what to report. Kinds
 * whose output involves fresh randomness (encryption nonces, Schnorr aux
 * bytes, sealed ephemeral keys, salts and KDF salts without a seeded RNG)
 * report only the stable outputs: digest and the format strings.
 */
import { rustShapedAdapterFor } from "./baseline-adapter";
import { redesignedShapedAdapterFor } from "./redesigned-adapter";

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
  | { t: "kv"; v: number };

export type Seed = [string, string, string, string];
export type Scheme = "ed25519" | "ecdsa" | "schnorr";

export type E =
  | { k: "leaf"; v: Leaf }
  | { k: "kv"; v: number }
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
  | { k: "encrypt"; e: E; key: string; subject?: boolean }
  | { k: "compress"; e: E; subject?: boolean }
  | { k: "sign"; e: E; seed: string; scheme: Scheme; note?: string }
  | { k: "salt"; e: E; rng: Seed; len?: number }
  | {
      k: "sskr";
      e: E;
      key: string;
      spec: { gt: number; groups: { mt: number; mc: number }[] };
      rng: Seed;
    }
  | { k: "attach"; e: E; payload: E; vendor: string; conformsTo?: string }
  | { k: "type"; e: E; type: E }
  | { k: "position"; e: E; pos: number }
  | {
      k: "request";
      func: string | number;
      id: string;
      params: [string | number, E][];
      note?: string;
      date?: number;
    }
  | { k: "response"; id: string; result?: E; error?: E }
  | { k: "recipient"; e: E; key: string; recipientSeed: string }
  | { k: "lock"; e: E; secret: string; method: "hkdf" | "pbkdf2" | "scrypt" | "argon2id" }
  | { k: "decode"; hex: string }
  | { k: "ur"; s: string };

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
  | "summary";
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
  if (e.k === "encrypt") bump("bytes");
  if (e.k === "elide" && typeof e.action === "object") bump("bytes");
  if (e.k === "recipient" || e.k === "lock") bump("digest");
  if (e.k === "sign" && e.scheme === "schnorr") bump("digest");
  for (const key of [
    "e",
    "subject",
    "pred",
    "obj",
    "payload",
    "type",
    "result",
    "error",
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
  const level = randomnessOf(r.e);
  return level === "none" ? ALL_OUT : level === "bytes" ? BYTES_STABLE_OUT : DIGEST_STABLE_OUT;
}

export type Outcome = string;
export interface VectorApi {
  run(r: Recipe): Outcome;
  errorCode(e: unknown): string;
}

export const hex = (u: Uint8Array): string => Buffer.from(u).toString("hex");
export const unhex = (h: string): Uint8Array => Uint8Array.from(Buffer.from(h, "hex"));
export const SEP = "\n---\n";

export function recipeName(r: Recipe): string {
  const short = (e: E): string => {
    switch (e.k) {
      case "leaf":
        return `leaf:${e.v.t}${"v" in e.v ? ":" + String(e.v.v).slice(0, 16) : "hex" in e.v ? ":" + e.v.hex.slice(0, 8) : ""}`;
      case "kv":
        return `kv:${e.v}`;
      case "node":
        return `node(${short(e.subject)}+${e.assertions.length})`;
      case "wrap":
        return `wrap(${short(e.e)})`;
      case "assertion":
        return `assertion(${short(e.pred)}:${short(e.obj)})`;
      case "elide":
        return `elide[${typeof e.action === "object" ? "encrypt" : (e.action ?? "elide")}](${short(e.e)})`;
      case "encrypt":
        return `encrypt${e.subject ? "Subject" : ""}(${short(e.e)})`;
      case "compress":
        return `compress${e.subject ? "Subject" : ""}(${short(e.e)})`;
      case "sign":
        return `sign:${e.scheme}(${short(e.e)})`;
      case "salt":
        return `salt(${short(e.e)})`;
      case "sskr":
        return `sskr:${e.spec.gt}/${e.spec.groups.map((g) => `${g.mt}of${g.mc}`).join(",")}(${short(e.e)})`;
      case "attach":
        return `attach:${e.vendor}(${short(e.e)})`;
      case "type":
        return `type(${short(e.e)})`;
      case "position":
        return `position:${e.pos}(${short(e.e)})`;
      case "request":
        return `request:${e.func}`;
      case "response":
        return `response:${e.result ? "ok" : "err"}`;
      case "recipient":
        return `recipient(${short(e.e)})`;
      case "lock":
        return `lock:${e.method}(${short(e.e)})`;
      case "decode":
        return `decode:${e.hex.slice(0, 16)}`;
      case "ur":
        return `ur:${e.s.slice(0, 24)}`;
    }
  };
  return short(r.e);
}

export function materialize(api: VectorApi, r: Recipe): Outcome {
  try {
    return api.run(r);
  } catch (e) {
    return `throw:${api.errorCode(e)}`;
  }
}

/** The sibling modules an adapter needs for keys, ids, specs and RNGs. */
export interface Deps {
  components: any;
  rand: any;
  sskr: any;
  /** Build a seeded RNG from four decimal strings. */
  seededRng(seed: Seed): any;
}

export function baselineAdapterFor(m: any, deps: Deps): VectorApi {
  return rustShapedAdapterFor(m, deps);
}
export function redesignedAdapterFor(m: any, deps: Deps): VectorApi {
  return redesignedShapedAdapterFor(m, deps);
}
