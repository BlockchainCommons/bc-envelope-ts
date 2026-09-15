/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion -- the recipe language is checked by its own type; a missing field is a corpus bug */
/**
 * The adapter over the frozen baseline bundle (`tests/baseline`), the
 * package as it was when the differential suite was set up; kinds the
 * bundle cannot express are listed in `isBaselineSupported`.
 * `working-tree-adapter.ts` is the working-tree twin.
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

export function baselineShapedAdapterFor(m: any, deps: Deps): VectorApi {
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
        return C.ARID.fromData(unhex(l.hex));
      case "digest":
        return C.Digest.fromData(unhex(l.hex));
      case "uuid":
        return C.UUID.fromData(unhex(l.hex));
      case "uri":
        return C.URI.new(l.v);
      case "kv":
        return new m.KnownValue(Number(l.v));
      case "cbor":
        throw new Error("baseline: unsupported leaf kind");
    }
  };
  const signer = (seed: string, scheme: string): any => {
    const base = C.PrivateKeyBase.fromData(unhex(seed));
    return scheme === "ed25519"
      ? base.ed25519SigningPrivateKey()
      : scheme === "ecdsa"
        ? base.ecdsaSigningPrivateKey()
        : base.schnorrSigningPrivateKey();
  };
  const build = (e: E): any => {
    switch (e.k) {
      case "leaf": {
        if (e.v.t === "null") return m.Envelope.null();
        if (e.v.t === "kv") return m.Envelope.newWithKnownValue(Number(e.v.v));
        return m.Envelope.new(leafValue(e.v));
      }
      case "kv":
        return m.Envelope.newWithKnownValue(Number(e.v));
      case "node": {
        let env = build(e.subject);
        for (const [p, o] of e.assertions)
          env = env.addAssertionEnvelope(m.Envelope.newAssertion(build(p), build(o)));
        return env;
      }
      case "wrap":
        return build(e.e).wrap();
      case "assertion":
        return m.Envelope.newAssertion(build(e.pred), build(e.obj));
      case "elide": {
        const env = build(e.e);
        const digests = (list: E[]): Set<any> => new Set(list.map((x) => build(x).digest()));
        const action =
          e.action === undefined || e.action === "elide"
            ? { type: "elide" }
            : e.action === "compress"
              ? { type: "compress" }
              : { type: "encrypt", key: m.SymmetricKey.fromData(unhex(e.action.encrypt)) };
        if (e.revealing !== undefined)
          return env.elideRevealingSetWithAction(digests(e.revealing), action);
        return env.elideRemovingSetWithAction(digests(e.removing ?? []), action);
      }
      case "encrypt": {
        const env = build(e.e);
        const key = m.SymmetricKey.fromData(unhex(e.key));
        return e.subject ? env.encryptSubject(key) : env.encrypt(key);
      }
      case "compress": {
        const env = build(e.e);
        return e.subject ? env.compressSubject() : env.compress();
      }
      case "sign": {
        const env = build(e.e);
        const s = signer(e.seed, e.scheme);
        if (e.note !== undefined) {
          const md = m.SignatureMetadata.new().withAssertion(m.NOTE, e.note);
          return env.signWithMetadata(s, md);
        }
        return env.sign(s);
      }
      case "salt": {
        const env = build(e.e);
        const rng = deps.seededRng(e.rng);
        if (e.range !== undefined) throw new Error("baseline: no seeded addSaltInRange");
        return e.len === undefined ? env.addSaltUsing(rng) : env.addSaltWithLenUsing(e.len, rng);
      }
      case "sskr": {
        const env = build(e.e);
        const key = m.SymmetricKey.fromData(unhex(e.key));
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
        const groups: any[][] = encrypted.sskrSplitUsing(spec, key, deps.seededRng(e.rng));
        return { sskrGroups: groups, original: env, spec: e.spec };
      }
      case "attach":
        return build(e.e).addAttachment(build(e.payload), e.vendor, e.conformsTo);
      case "type":
        return build(e.e).addType(build(e.type));
      case "position":
        return build(e.e).setPosition(Number(e.pos));
      case "request": {
        let req = m.Request.new(e.func, C.ARID.fromData(unhex(e.id)));
        for (const [p, v] of e.params) req = req.withParameter(p, build(v));
        if (e.note !== undefined) req = req.withNote(e.note);
        if (e.date !== undefined) req = req.withDate(new Date(e.date));
        return req.toEnvelope();
      }
      case "response": {
        const id = C.ARID.fromData(unhex(e.id));
        if (e.result !== undefined)
          return m.Response.newSuccess(id).withResult(build(e.result)).toEnvelope();
        return m.Response.newFailure(id)
          .withError(e.error === undefined ? "error" : build(e.error))
          .toEnvelope();
      }
      case "recipient": {
        const env = build(e.e);
        const key = m.SymmetricKey.fromData(unhex(e.key));
        const base = C.PrivateKeyBase.fromData(unhex(e.recipientSeed));
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
        return m.envelopeFromBytes(unhex(e.hex));
      case "ur":
        return m.Envelope.fromURString(e.s);
      case "nodeEnv": {
        let env = build(e.subject);
        for (const a of e.assertions) env = env.addAssertionEnvelope(build(a));
        return env;
      }
      case "recipientDecode":
        return m.Envelope.fromURString(e.ur).decryptSubjectToRecipient(
          C.PrivateKeyBase.fromData(unhex(e.recipientSeed)),
        );
      case "op": {
        const env = build(e.e);
        const key = e.key === undefined ? undefined : m.SymmetricKey.fromData(unhex(e.key));
        switch (e.op) {
          case "encryptSubject":
            return env.encryptSubject(key);
          case "decryptSubject":
            return env.decryptSubject(key);
          case "compress":
            return env.compress();
          case "decompress":
            return env.decompress();
          case "decryptToRecipient":
            return env.decryptSubjectToRecipient(
              C.PrivateKeyBase.fromData(unhex(e.recipientSeed!)),
            );
          case "roundtrip":
            return m.envelopeFromBytes(env.taggedCborData());
          case "addAssertionEnvelope":
            return env.addAssertionEnvelopeSalted(build(e.assertion!), e.salt === true);
          default:
            throw new Error("baseline: unsupported op");
        }
      }
      default:
        throw new Error("baseline: unsupported recipe kind");
    }
  };
  const report = (env: any, outs: string[]): string =>
    outs
      .map((o) => {
        switch (o) {
          case "cbor":
            return hex(m.envelopeToBytes(env));
          case "ur":
            return env.urString();
          case "digest":
            return env.digest().hex();
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
            return env.hexOpt(true);
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
      // uniform-resources: the frozen bundle used class names, the working tree codes.
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
      return String(x?.code ?? x?.errorCode ?? name);
    },
    run(r: Recipe) {
      const outs = outputsFor(r);
      const built = build(r.e);
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
