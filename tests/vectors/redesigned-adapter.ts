/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion -- the recipe language is checked by its own type; a missing field is a corpus bug */
/**
 * The adapter over the working tree. Edited by the mechanical API passes
 * together with the rest of the tests.
 */
import {
  type VectorApi,
  type Deps,
  type E,
  type Leaf,
  type Recipe,
  hex,
  unhex,
  outputsFor,
  SEP,
} from "./recipes";
import "../../src/all.js";
import { UR, decodeURWith } from "@blockchaincommons/uniform-resources";
import { NOTE } from "@blockchaincommons/known-values";

export function redesignedShapedAdapterFor(m: any, deps: Deps): VectorApi {
  const C = deps.components;
  const leafValue = (l: Leaf): any => {
    switch (l.t) {
      case "text":
        return l.v;
      case "int":
        return BigInt(l.v) <= BigInt(Number.MAX_SAFE_INTEGER) &&
          BigInt(l.v) >= -BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(l.v)
          : BigInt(l.v);
      case "bytes":
        return unhex(l.hex);
      case "bool":
        return l.v;
      case "null":
        return null;
      case "float":
        return l.v;
      case "date":
        return new Date(l.ms);
      case "array":
        return l.items.map(leafValue);
      case "map": {
        const map = new Map<any, any>();
        for (const [k, v] of l.entries) map.set(leafValue(k), leafValue(v));
        return map;
      }
      case "arid":
        return C.ARID.from(unhex(l.hex));
      case "digest":
        return C.Digest.from(unhex(l.hex));
      case "uuid":
        return C.UUID.from(unhex(l.hex));
      case "uri":
        return C.URI.from(l.v);
      case "kv":
        return new m.KnownValue(l.v);
    }
  };
  const signer = (seed: string, scheme: string): any => {
    const base = C.PrivateKeyBase.from(unhex(seed));
    return scheme === "ed25519"
      ? base.ed25519SigningPrivateKey()
      : scheme === "ecdsa"
        ? base.ecdsaSigningPrivateKey()
        : base.schnorrSigningPrivateKey();
  };
  const build = (e: E): any => {
    switch (e.k) {
      case "leaf": {
        if (e.v.t === "null") return m.Envelope.NULL;
        if (e.v.t === "kv") return m.Envelope.knownValue(e.v.v);
        return m.Envelope.from(leafValue(e.v));
      }
      case "kv":
        return m.Envelope.knownValue(e.v);
      case "node": {
        let env = build(e.subject);
        for (const [p, o] of e.assertions)
          env = env.addAssertionEnvelope(m.Envelope.assertion(build(p), build(o)));
        return env;
      }
      case "wrap":
        return build(e.e).wrap();
      case "assertion":
        return m.Envelope.assertion(build(e.pred), build(e.obj));
      case "elide": {
        const env = build(e.e);
        const digests = (list: E[]): Set<any> => new Set(list.map((x) => build(x).digest()));
        const action =
          e.action === undefined || e.action === "elide"
            ? "elide"
            : e.action === "compress"
              ? "compress"
              : { encrypt: C.SymmetricKey.from(unhex(e.action.encrypt)) };
        if (e.revealing !== undefined)
          return env.elide({ revealing: digests(e.revealing), action: action });
        return env.elide({ removing: digests(e.removing ?? []), action: action });
      }
      case "encrypt": {
        const env = build(e.e);
        const key = C.SymmetricKey.from(unhex(e.key));
        const opts = e.nonce === undefined ? {} : { nonce: C.Nonce.from(unhex(e.nonce)) };
        return e.subject ? env.encryptSubject(key, opts) : env.encrypt(key, opts);
      }
      case "compress": {
        const env = build(e.e);
        return e.subject ? env.compressSubject() : env.compress();
      }
      case "sign": {
        const env = build(e.e);
        const s = signer(e.seed, e.scheme);
        if (e.note !== undefined) {
          const md = m.SignatureMetadata.from().withAssertion(NOTE, e.note);
          return env.sign(s, { metadata: md });
        }
        return env.sign(s);
      }
      case "salt": {
        const env = build(e.e);
        const rng = deps.seededRng(e.rng);
        if (e.range !== undefined)
          return env.addSalt({ range: { min: e.range[0], max: e.range[1] }, rng });
        return e.len === undefined ? env.addSalt({ rng }) : env.addSalt({ length: e.len, rng });
      }
      case "sskr": {
        const env = build(e.e);
        const key = C.SymmetricKey.from(unhex(e.key));
        const spec =
          typeof deps.sskr.Spec?.from === "function"
            ? deps.sskr.Spec.from({
                groupThreshold: e.spec.gt,
                groups: e.spec.groups.map((g) =>
                  deps.sskr.GroupSpec.from({ memberThreshold: g.mt, memberCount: g.mc }),
                ),
              })
            : C.SSKRSpec.new(
                e.spec.gt,
                e.spec.groups.map((g) => C.SSKRGroupSpec.new(g.mt, g.mc)),
              );
        const encrypted = env.encryptSubject(key);
        const groups: any[][] = encrypted.sskrSplit(spec, key, { rng: deps.seededRng(e.rng) });
        return { sskrGroups: groups, original: env, spec: e.spec };
      }
      case "attach":
        return build(e.e).addAttachment(build(e.payload), e.vendor, e.conformsTo);
      case "type":
        return build(e.e).addType(build(e.type));
      case "position":
        return build(e.e).setPosition(e.pos);
      case "request": {
        let req = m.Request.from(e.func, C.ARID.from(unhex(e.id)));
        for (const [p, v] of e.params) req = req.withParameter(p, build(v));
        if (e.note !== undefined) req = req.withNote(e.note);
        if (e.date !== undefined) req = req.withDate(new Date(e.date));
        return req.toEnvelope();
      }
      case "response": {
        const id = C.ARID.from(unhex(e.id));
        if (e.result !== undefined)
          return m.Response.success(id).withResult(build(e.result)).toEnvelope();
        return m.Response.failure(id)
          .withError(e.error === undefined ? "error" : build(e.error))
          .toEnvelope();
      }
      case "recipient": {
        const env = build(e.e);
        const key = C.SymmetricKey.from(unhex(e.key));
        const base = C.PrivateKeyBase.from(unhex(e.recipientSeed));
        const recipient = base.encapsulationPrivateKey().publicKey();
        return env.encryptSubject(key).addRecipient(recipient, key);
      }
      case "lock": {
        const env = build(e.e);
        const method = {
          hkdf: C.KeyDerivationMethod.HKDF,
          pbkdf2: C.KeyDerivationMethod.PBKDF2,
          scrypt: C.KeyDerivationMethod.Scrypt,
          argon2id: C.KeyDerivationMethod.Argon2id,
        }[e.method];
        return env.lock(method, unhex(e.secret));
      }
      case "decode":
        return m.Envelope.fromBytes(unhex(e.hex));
      case "ur":
        return decodeURWith(UR.parse(e.s), m.Envelope.codec);
      case "nodeEnv": {
        let env = build(e.subject);
        for (const a of e.assertions) env = env.addAssertionEnvelope(build(a));
        return env;
      }
      case "recipientDecode": {
        const env: any = decodeURWith(UR.parse(e.ur), m.Envelope.codec);
        return env.decryptSubjectToRecipient(C.PrivateKeyBase.from(unhex(e.recipientSeed)));
      }
      case "op": {
        const env = build(e.e);
        const key = e.key === undefined ? undefined : C.SymmetricKey.from(unhex(e.key));
        switch (e.op) {
          case "encryptSubject":
            return env.encryptSubject(
              key,
              e.nonce === undefined ? {} : { nonce: C.Nonce.from(unhex(e.nonce)) },
            );
          case "decryptSubject":
            return env.decryptSubject(key);
          case "compress":
            return env.compress();
          case "decompress":
            return env.decompress();
          case "decryptToRecipient":
            return env.decryptSubjectToRecipient(C.PrivateKeyBase.from(unhex(e.recipientSeed!)));
          case "attachmentPayload":
            return env.attachmentPayload();
          case "expectAttachment":
            return env.expectAttachment();
          case "requestFrom":
            return m.Request.fromEnvelope(
              env,
              typeof e.func === "number" ? m.Function.known(e.func) : m.Function.named(e.func!),
            ).toEnvelope();
          case "roundtrip":
            return m.Envelope.fromBytes(env.toCbor().toData());
          case "addAssertionEnvelope":
            return env.addAssertionEnvelope(build(e.assertion!), { salt: e.salt === true });
          case "verify":
            return env.verify(signer(e.seed!, "ed25519").publicKey());
        }
        throw new Error(`unhandled op ${String(e.op)}`);
      }
      case "domain": {
        const f = domainCases[e.case];
        if (f === undefined) throw new Error(`unknown domain case ${e.case}`);
        try {
          const v = f();
          return { domain: `ok:${typeof v === "string" ? v : JSON.stringify(v)}` };
        } catch (err) {
          const x = err as { constructor: { name: string }; code?: string };
          return {
            domain: `throw:${x.constructor.name}${x.code === undefined ? "" : `:${x.code}`}`,
          };
        }
      }
    }
  };
  /** The JS-only input domain: one closure per named case. */
  const domainCases: Record<string, () => unknown> = {
    "node.emptyAssertions": () => m.Envelope.node(m.Envelope.from("s"), []).format(),
    "knownValue.-1": () => m.Envelope.knownValue(-1).format(),
    "knownValue.1.5": () => m.Envelope.knownValue(1.5).format(),
    "setPosition.1.5": () => m.Envelope.from("x").setPosition(1.5).formatFlat(),
    "setPosition.-1": () => m.Envelope.from("x").setPosition(-1).formatFlat(),
    "digests.1.5": () => m.Envelope.from("x").digests(1.5).size,
    "addSalt.length.1.5": () => m.Envelope.from("x").addSalt({ length: 1.5 }).formatFlat(),
    "addSalt.length.NaN": () => m.Envelope.from("x").addSalt({ length: NaN }).formatFlat(),
    "lock.method.99": () => m.Envelope.from("x").lock(99, unhex("70617373776f7264")).formatFlat(),
    "function.known.-1": () => m.Function.known(-1).toString(),
    "function.known.1.5": () => m.Function.known(1.5).toString(),
    "parameter.from.empty": () => m.Parameter.named("").toString(),
    "hasSignaturesFromThreshold.1.5": () =>
      m.Envelope.from("x").hasSignaturesFromThreshold([], 1.5),
    "leaf.date": () => hex(m.Envelope.leaf(new Date(0)).toCbor().toData()),
    "leaf.undefined": () => hex(m.Envelope.leaf(undefined).toCbor().toData()),
  };
  const report = (env: any, outs: string[]): string =>
    outs
      .map((o) => {
        switch (o) {
          case "cbor":
            return hex(env.toCbor().toData());
          case "ur":
            return env.toUR().toString();
          case "digest":
            return env.digest().toHex();
          case "format":
            return env.format();
          case "flat":
            return env.formatFlat();
          case "tree":
            return env.treeFormat();
          case "treeDigests":
            return env.treeFormat({ hideNodes: false, digestDisplay: "short" });
          case "mermaid":
            return env.mermaidFormat();
          case "diagnostic":
            return env.diagnostic();
          case "hex":
            return env.hex();
          case "summary":
            return env.summary();
          default:
            return "?";
        }
      })
      .join(SEP);
  return {
    errorCode: (err) => {
      const x = err as any;
      const name = String(x?.name ?? "Error");
      if (name === "CborError") return "CborError";
      // uniform-resources: class names before the redesign, codes after.
      const UR = [
        "Bytewords",
        "UnexpectedType",
        "InvalidScheme",
        "TypeUnspecified",
        "InvalidType",
        "NotSinglePart",
        "Decoder",
      ];
      if (name.endsWith("Error") && UR.includes(name.slice(0, -5))) return name.slice(0, -5);
      if (name === "URError") return String(x.code);
      // EnvelopeErrorCode is PascalCase after W1; the vectors keep the
      // pre-redesign SCREAMING_CASE spelling (`Cbor` → `CBOR`).
      if (name === "EnvelopeError" && typeof x.code === "string")
        return x.code.replace(/(?<=[a-z0-9])(?=[A-Z])/g, "_").toUpperCase();
      return String(x?.code ?? x?.errorCode ?? name);
    },
    run(r: Recipe) {
      const outs = outputsFor(r);
      const built = build(r.e);
      if (built !== null && typeof built === "object" && "domain" in built) return built.domain;
      if (built !== null && typeof built === "object" && "sskrGroups" in built) {
        const groups: any[][] = built.sskrGroups;
        const shares = groups
          .map((g) => g.map((s: any) => report(s, ["digest", "format"])).join("\n,,,\n"))
          .join("\n;;;\n");
        const quorum: any[] = [];
        const spec = built.spec as { gt: number; groups: { mt: number; mc: number }[] };
        for (let gi = 0; gi < spec.gt; gi++)
          for (const s of groups[gi]!.slice(0, spec.groups[gi]!.mt)) quorum.push(s);
        const joined = m.Envelope.sskrJoin(quorum);
        return `${shares}${SEP}${joined.isEquivalentTo(built.original) ? "joined" : "JOIN-MISMATCH"}`;
      }
      return report(built, outs);
    },
  };
}
