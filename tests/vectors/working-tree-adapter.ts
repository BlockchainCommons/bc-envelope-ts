/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion -- the recipe language is checked by its own type; a missing field is a corpus bug */
/**
 * The adapter over the working tree: every recipe kind materialised with
 * the package's own API. A thrown value renders as
 * `throw:<code>[<cause code>]|<message>` from the error's own fields, with
 * no branch on the error's class.
 */
import {
  type VectorApi,
  type Deps,
  type E,
  type Leaf,
  type Recipe,
  type Out,
  hex,
  unhex,
  outputsFor,
  ALL_OUT,
  DIGEST_STABLE_OUT,
  SEP,
} from "./recipes";
import "../../src/all.js";
import { UR, decodeURWith } from "@blockchaincommons/uniform-resources";
import {
  type Cbor,
  decodeCbor,
  encodeCbor,
  cbor as toCbor,
  expectText,
  expectUnsigned,
  expectInteger,
  expectFloat,
  expectBoolean,
  expectBytes,
  isNull,
  CborError,
  CborDate,
  Tag,
  TagsStore,
  getGlobalTagsStore,
} from "@blockchaincommons/dcbor";
import {
  NOTE,
  SSKR_SHARE,
  HAS_SECRET,
  KnownValue,
  KnownValuesStore,
  getGlobalKnownValuesStore,
} from "@blockchaincommons/known-values";

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

export function workingTreeShapedAdapterFor(m: any, deps: Deps): VectorApi {
  const C = deps.components;
  const leafValue = (l: Leaf): any => {
    switch (l.t) {
      case "text":
        return l.v;
      case "int":
        return BigInt(l.v) <= MAX_SAFE && BigInt(l.v) >= -MAX_SAFE ? Number(l.v) : BigInt(l.v);
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
        return new KnownValue(typeof l.v === "string" ? BigInt(l.v) : l.v, l.name);
      case "cbor":
        return decodeCbor(unhex(l.hex));
    }
  };
  const base = (seed: string): any => C.PrivateKeyBase.from(unhex(seed));
  const signer = (e: Extract<E, { k: "sign" }>): any => {
    const b = base(e.seed);
    switch (e.scheme) {
      case "ed25519":
        return b.ed25519SigningPrivateKey();
      case "ecdsa":
        return b.ecdsaSigningPrivateKey();
      case "schnorr":
        return b.schnorrSigningPrivateKey();
      case "ssh-ed25519":
        return b.sshSigningPrivateKey({ kind: "ed25519" }, e.comment ?? "");
      case "mldsa44": {
        const [priv, pub] = C.MLDSAPrivateKey.keypair(C.MLDSALevel.MLDSA44, {
          rng: deps.seededRng(e.rng!),
        });
        return { key: C.SigningPrivateKey.fromMldsa(priv), pub: C.SigningPublicKey.fromMldsa(pub) };
      }
    }
  };
  const ed25519Verifier = (o: Extract<E, { k: "op" }>): any =>
    o.pub !== undefined
      ? C.SigningPublicKey.fromEd25519(C.Ed25519PublicKey.from(unhex(o.pub)))
      : base(o.seed!).ed25519SigningPrivateKey().publicKey();
  const functionOf = (f: string | number): any => {
    if (f === "$ADD") return m.ADD;
    return typeof f === "number" ? m.Function.known(f) : m.Function.named(f);
  };
  const parameterOf = (p: string | number): any => {
    if (typeof p === "number") return m.Parameter.known(p);
    if (p.startsWith("#")) return m.Parameter.known(BigInt(p.slice(1)));
    return m.Parameter.named(p);
  };
  const kdfParams = (method: string, salt: any): any => {
    switch (method) {
      case "hkdf":
        return C.hkdfParams(C.HKDFParams.from({ salt }));
      case "pbkdf2":
        return C.pbkdf2Params(C.PBKDF2Params.from({ salt }));
      case "scrypt":
        return C.scryptParams(C.ScryptParams.from({ salt }));
      default:
        return C.argon2idParams(C.Argon2idParams.from({ salt }));
    }
  };
  const agentOf = (identities: { seed: string; comment: string }[], refuse = false): any =>
    new C.MemorySshAgent({
      identities: identities.map((i) =>
        base(i.seed).sshSigningPrivateKey({ kind: "ed25519" }, i.comment).asSsh(),
      ),
      refuseToSign: refuse,
    });
  /** A leaf holding the raw CBOR the recipe carries. */
  const cborHex = (v: any): string => hex(encodeCbor(toCbor(v)));
  const dateHex = (d: any): string => (d === undefined ? "-" : hex(encodeCbor(d.toCbor())));
  const contextOf = (ctx: Extract<E, { k: "fmt" }>["context"]): any => {
    if (ctx === undefined) return "global";
    const knownValues = new KnownValuesStore(
      (ctx.knownValues ?? []).map(
        ([v, name]) => new KnownValue(typeof v === "string" ? BigInt(v) : v, name),
      ),
    );
    const tags = new TagsStore();
    for (const [value, name] of ctx.tags ?? []) tags.register(Tag.from(value, name));
    const context = new m.FormatContext({ tags, knownValues });
    if (ctx.register === true) m.registerTagsIn(context);
    return context;
  };
  /** The outcome of a verified row: the outputs, then `name=value` fields the reference checks. */
  const withFields = (body: string, fields: Record<string, string>): string =>
    [body, ...Object.entries(fields).map(([k, v]) => `${k}=${v}`)].join(SEP);

  const build = (e: E): any => {
    switch (e.k) {
      case "leaf": {
        if (e.v.t === "null") return m.Envelope.NULL;
        if (e.v.t === "kv") return m.Envelope.knownValue(leafValue(e.v));
        return m.Envelope.from(leafValue(e.v));
      }
      case "kv":
        return m.Envelope.knownValue(
          new KnownValue(typeof e.v === "string" ? BigInt(e.v) : e.v, e.name),
        );
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
        const made = signer(e);
        const s = "key" in made ? made.key : made;
        const options: Record<string, unknown> = {};
        if (e.ssh !== undefined)
          options["signing"] = { type: "Ssh", namespace: e.ssh.namespace, hashAlg: e.ssh.hashAlg };
        if (e.scheme === "schnorr" && e.rng !== undefined)
          options["signing"] = { type: "Schnorr", rng: deps.seededRng(e.rng) };
        if (e.note !== undefined)
          options["metadata"] = m.SignatureMetadata.from().withAssertion(NOTE, e.note);
        const signed = env.sign(s, options);
        if (e.scheme === "mldsa44")
          return {
            verified: signed,
            fields: {
              cbor: hex(signed.toCbor().toData()),
              pub: hex(encodeCbor(made.pub.toCbor())),
            },
            outs: DIGEST_STABLE_OUT,
          };
        return signed;
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
        const spec = deps.sskr.Spec.from({
          groupThreshold: e.spec.gt,
          groups: e.spec.groups.map((g) =>
            deps.sskr.GroupSpec.from({ memberThreshold: g.mt, memberCount: g.mc }),
          ),
        });
        const encrypted = env.encryptSubject(key);
        const groups: any[][] = encrypted.sskrSplit(spec, key, { rng: deps.seededRng(e.rng) });
        return { sskrGroups: groups, original: env, spec: e.spec };
      }
      case "sskrJoinRaw": {
        const env = build(e.e);
        const envelopes = e.shares.map((s) =>
          env.addAssertion(SSKR_SHARE, C.SskrShare.from(unhex(s))),
        );
        return m.Envelope.sskrJoin(envelopes);
      }
      case "attach":
        return build(e.e).addAttachment(build(e.payload), e.vendor, e.conformsTo);
      case "type":
        return build(e.e).addType(build(e.type));
      case "position": {
        const pos = BigInt(e.pos);
        return build(e.e).setPosition(pos <= MAX_SAFE ? Number(pos) : pos);
      }
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
      case "responseOp": {
        const id = C.ARID.from(unhex(e.id));
        switch (e.op) {
          case "resultOnFailure":
            return m.Response.failure(id).withResult(1).toEnvelope();
          case "errorOnSuccess":
            return m.Response.success(id).withError("e").toEnvelope();
          case "expectIdEarly":
            return { value: `ok:${hex(m.Response.earlyFailure().expectId().bytes)}` };
        }
        break;
      }
      case "recipient": {
        const env = build(e.e);
        const key = C.SymmetricKey.from(unhex(e.key));
        const fields: Record<string, string> = { key: e.key };
        let recipient: any;
        switch (e.scheme ?? "x25519") {
          case "x25519":
            recipient = base(e.recipientSeed).encapsulationPrivateKey().publicKey();
            break;
          case "mlkem512": {
            const [priv, pub] = C.EncapsulationPrivateKey.mlkemKeypair(C.MLKEMLevel.MLKEM512, {
              rng: deps.seededRng(e.rng ?? ["1", "1", "1", "1"]),
            });
            fields["priv"] = hex(encodeCbor(priv.toCbor()));
            fields["pub"] = hex(encodeCbor(pub.toCbor()));
            recipient = pub;
            break;
          }
          case "lowOrder":
            recipient = C.EncapsulationPublicKey.fromX25519Data(unhex(e.recipientSeed));
            break;
        }
        const subjectOpts = e.nonce === undefined ? {} : { nonce: C.Nonce.from(unhex(e.nonce)) };
        const sealOpts: Record<string, unknown> = {};
        if (e.sealNonce !== undefined) sealOpts["nonce"] = C.Nonce.from(unhex(e.sealNonce));
        if (e.rng !== undefined) sealOpts["rng"] = deps.seededRng(e.rng);
        const out = env.encryptSubject(key, subjectOpts).addRecipient(recipient, key, sealOpts);
        if (e.nonce !== undefined && e.rng !== undefined && e.scheme !== "lowOrder")
          return { verified: out, fields, outs: ALL_OUT };
        // The port drew the ML-KEM key: the reference reads it from the row.
        if (e.scheme === "mlkem512")
          return {
            verified: out,
            fields: { priv: fields["priv"]!, pub: fields["pub"]! },
            outs: DIGEST_STABLE_OUT,
          };
        return out;
      }
      case "lock": {
        const env = build(e.e);
        const method = {
          hkdf: C.KeyDerivationMethod.HKDF,
          pbkdf2: C.KeyDerivationMethod.PBKDF2,
          scrypt: C.KeyDerivationMethod.Scrypt,
          argon2id: C.KeyDerivationMethod.Argon2id,
        }[e.method];
        if (e.key === undefined || e.nonce === undefined || e.salt === undefined)
          return env.lock(method, unhex(e.secret));
        // Composed from the components primitives, as the reference composes
        // `lock_subject`: the KDF salt and the subject nonce fixed.
        const key = C.SymmetricKey.from(unhex(e.key));
        const params = kdfParams(e.method, C.Salt.from(unhex(e.salt)));
        const encryptedKey = C.EncryptedKey.lockOpt(params, unhex(e.secret), key);
        const out = env
          .wrap()
          .encryptSubject(key, { nonce: C.Nonce.from(unhex(e.nonce)) })
          .addAssertion(HAS_SECRET, encryptedKey);
        return { verified: out, fields: { key: e.key }, outs: ALL_OUT };
      }
      case "seal": {
        const env = build(e.e);
        const sender = base(e.seed).ed25519SigningPrivateKey();
        const recipientBase = base(e.recipientSeed);
        const recipient = recipientBase.encapsulationPrivateKey().publicKey();
        const opts: Record<string, unknown> = {};
        if (e.nonce !== undefined) opts["nonce"] = C.Nonce.from(unhex(e.nonce));
        if (e.rng !== undefined) opts["rng"] = deps.seededRng(e.rng);
        const sealed = env.seal(sender, recipient, opts);
        const unsealed = sealed.unseal(sender.publicKey(), recipientBase);
        const fields = { unseal: unsealed.isEquivalentTo(env) ? "ok" : "MISMATCH" };
        if (e.nonce !== undefined && e.rng !== undefined)
          return { verified: sealed, fields, outs: ALL_OUT };
        return { verified: sealed, fields, outs: DIGEST_STABLE_OUT };
      }
      case "decode":
        return m.Envelope.fromBytes(unhex(e.hex));
      case "ur":
        return decodeURWith(UR.parse(e.s), m.Envelope.codec);
      case "fmt":
        return { formatted: m.Envelope.fromBytes(unhex(e.hex)), context: contextOf(e.context) };
      case "nodeEnv": {
        let env = build(e.subject);
        for (const a of e.assertions) env = env.addAssertionEnvelope(build(a));
        return env;
      }
      case "recipientDecode": {
        const env: any = decodeURWith(UR.parse(e.ur), m.Envelope.codec);
        return env.decryptSubjectToRecipient(C.PrivateKeyBase.from(unhex(e.recipientSeed)));
      }
      case "extract":
        return { value: extract(build(e.e), e.decoder) };
      case "pred":
        return { value: String(build(e.e)[e.pred]()) };
      case "op":
        return runOp(e);
      case "noreg":
        return build(e.inner);
      case "late": {
        for (const [v, name] of e.knownValues ?? [])
          getGlobalKnownValuesStore().register(new KnownValue(v, name));
        for (const [v, name] of e.tags ?? []) getGlobalTagsStore().register(Tag.from(v, name));
        return build(e.inner);
      }
      case "domain": {
        const f = domainCases[e.case];
        if (f === undefined) throw new Error(`unknown domain case ${e.case}`);
        const v = f();
        return { value: `ok:${typeof v === "string" ? v : JSON.stringify(v)}` };
      }
      case "agentLock":
      case "agentUnlock":
        throw new Error(`${e.k} is asynchronous: materialise it with materializeAsync`);
    }
    throw new Error(`unhandled recipe ${(e as E).k}`);
  };

  const extract = (env: any, decoder: string): string => {
    const decoders: Record<string, (c: Cbor) => unknown> = {
      envelope: (c) => m.Envelope.fromCbor(c),
      digest: (c) => C.Digest.fromCbor(c),
      knownValue: (c) => KnownValue.fromCbor(c),
      encryptedMessage: (c) => C.EncryptedMessage.fromCbor(c),
      compressed: (c) => C.Compressed.fromCbor(c),
      text: (c) => expectText(c),
      u64: (c) => expectUnsigned(c, { width: 64, wrapNegative: true }),
      i64: (c) => {
        const v = BigInt(expectInteger(c));
        if (v < -(1n << 63n) || v > (1n << 63n) - 1n) throw CborError.outOfRange();
        return v;
      },
      f64: (c) => expectFloat(c),
      bool: (c) => expectBoolean(c),
      null: (c) => {
        if (!isNull(c)) throw CborError.wrongType();
        return null;
      },
      bytes: (c) => expectBytes(c),
      date: (c) => CborDate.fromTaggedCbor(c),
      arid: (c) => C.ARID.fromCbor(c),
      passthrough: (c) => c,
    };
    const v: any = env.expectSubject(decoders[decoder]!);
    switch (decoder) {
      case "envelope":
      case "digest":
      case "compressed":
        return `ok:${v.digest().toHex()}`;
      case "encryptedMessage":
        return `ok:${v.aadDigest().toHex()}`;
      case "knownValue":
        return `ok:${String(v.value)}:${String(v.name)}`;
      case "f64":
        return `ok:${cborHex(v)}`;
      case "date":
        return `ok:${dateHex(v)}`;
      case "arid":
        return `ok:${v.toHex()}`;
      case "bytes":
        return `ok:${hex(v)}`;
      case "passthrough":
        return `ok:${hex(encodeCbor(v))}`;
      default:
        return `ok:${String(v)}`;
    }
  };

  const runOp = (e: Extract<E, { k: "op" }>): any => {
    const env = build(e.e);
    const key = e.key === undefined ? undefined : C.SymmetricKey.from(unhex(e.key));
    const value = (s: string): { value: string } => ({ value: s });
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
      case "attachmentVendor":
        return value(`ok:${env.attachmentVendor()}`);
      case "attachmentConformsTo":
        return value(`ok:${env.attachmentConformsTo() ?? "-"}`);
      case "validateAttachment":
        env.validateAttachment();
        return value("ok");
      case "expectAttachment":
        return env.expectAttachment();
      case "requestFrom": {
        const req = m.Request.fromEnvelope(
          env,
          e.func === undefined ? undefined : functionOf(e.func),
        );
        return {
          value: withFields(report(req.toEnvelope(), ["cbor", "digest", "flat"]), {
            fn: String(req.function),
            note: req.note,
            date: dateHex(req.cborDate),
          }),
        };
      }
      case "requestParams": {
        const objects: any[] = m.Request.fromEnvelope(env).body.objectsForParameter(
          parameterOf(e.param!),
        );
        return value(
          `pcount=${objects.length}${objects.map((o) => SEP + o.formatFlat()).join("")}`,
        );
      }
      case "eventFrom": {
        const evt = m.Event.fromEnvelope(env, (x: any) => x.expectString());
        return {
          value: withFields(report(evt.toEnvelope(), ["cbor", "digest", "flat"]), {
            content: evt.content,
            note: evt.note,
            date: dateHex(evt.cborDate),
          }),
        };
      }
      case "responseFrom": {
        const resp = m.Response.fromEnvelope(env);
        return {
          value: withFields(report(resp.toEnvelope(), ["cbor", "digest", "flat"]), {
            id: resp.id === undefined ? "-" : resp.id.toHex(),
            ok: String(resp.isOk()),
          }),
        };
      }
      case "roundtrip":
        return m.Envelope.fromBytes(env.toCbor().toData());
      case "addAssertionEnvelope":
        return env.addAssertionEnvelope(build(e.assertion!), { salt: e.salt === true });
      case "verify":
        return env.verify(ed25519Verifier(e));
      case "position": {
        const p = env.position();
        return value(`ok:${String(p)}`);
      }
      case "walkDecrypt":
        return env.walkDecrypt([key]);
      case "recipients":
        return value(`count=${env.recipients().length}`);
      case "unlock":
        return env.unlockSubject(unhex(e.secret!));
      case "sskrJoin":
        return m.Envelope.sskrJoin([env]);
      case "unwrap":
        return env.unwrap();
      case "expectString":
        return value(`ok:${env.expectString()}`);
      case "expectNumber":
        return value(`ok:${cborHex(env.expectNumber())}`);
      case "expectDate":
        return value(`ok:${dateHex(CborDate.fromDate(env.expectDate()))}`);
      case "checkSubjectUnit":
        return env.checkSubjectUnit();
    }
    throw new Error(`unhandled op ${String(e.op)}`);
  };

  /** The JS-only input domain: one closure per named case. */
  const domainCases: Record<string, () => unknown> = {
    "node.emptyAssertions": () => m.Envelope.node(m.Envelope.from("s"), []).format(),
    "knownValue.-1": () => m.Envelope.knownValue(-1).format(),
    "knownValue.1.5": () => m.Envelope.knownValue(1.5).format(),
    "knownValue.NaN": () => m.Envelope.knownValue(NaN).format(),
    "knownValue.2^53": () => m.Envelope.knownValue(2 ** 53).format(),
    "knownValue.2n**64n": () => m.Envelope.knownValue(2n ** 64n).format(),
    "setPosition.1.5": () => m.Envelope.from("x").setPosition(1.5).formatFlat(),
    "setPosition.-1": () => m.Envelope.from("x").setPosition(-1).formatFlat(),
    "setPosition.NaN": () => m.Envelope.from("x").setPosition(NaN).formatFlat(),
    "setPosition.2^53": () =>
      m.Envelope.from("x")
        .setPosition(2 ** 53)
        .formatFlat(),
    "digests.1.5": () => m.Envelope.from("x").digests(1.5).size,
    "digests.-1": () => m.Envelope.from("x").digests(-1).size,
    "addSalt.length.1.5": () => m.Envelope.from("x").addSalt({ length: 1.5 }).formatFlat(),
    "addSalt.length.NaN": () => m.Envelope.from("x").addSalt({ length: NaN }).formatFlat(),
    "addSalt.length.-1": () => m.Envelope.from("x").addSalt({ length: -1 }).formatFlat(),
    "addSalt.length.2^32": () =>
      m.Envelope.from("x")
        .addSalt({ length: 2 ** 32 })
        .formatFlat(),
    "addSalt.range.min.8.5": () =>
      m.Envelope.from("x")
        .addSalt({ range: { min: 8.5, max: 10 } })
        .formatFlat(),
    "lock.method.99": () => m.Envelope.from("x").lock(99, utf8("password")).formatFlat(),
    "lock.method.sshAgent": () =>
      m.Envelope.from("x").lock(C.KeyDerivationMethod.SSHAgent, utf8("alice")).formatFlat(),
    "addSecret.method.sshAgent": () =>
      m.Envelope.from("x")
        .addSecret(
          C.KeyDerivationMethod.SSHAgent,
          utf8("alice"),
          C.SymmetricKey.from(unhex("07".repeat(32))),
        )
        .formatFlat(),
    "function.known.-1": () => m.Function.known(-1).toString(),
    "function.known.1.5": () => m.Function.known(1.5).toString(),
    "function.known.2^53": () => m.Function.known(2 ** 53).toString(),
    "function.known.2n**64n": () => m.Function.known(2n ** 64n).toString(),
    "parameter.from.1.5": () => m.Parameter.from(1.5).toString(),
    "parameter.known.-1": () => m.Parameter.known(-1).toString(),
    "hasSignaturesFromThreshold.1.5": () =>
      m.Envelope.from("x").hasSignaturesFromThreshold([], 1.5),
    "hasSignaturesFromThreshold.NaN": () =>
      m.Envelope.from("x").hasSignaturesFromThreshold([], NaN),
    "hasSignaturesFromThreshold.-1": () => m.Envelope.from("x").hasSignaturesFromThreshold([], -1),
    "leaf.undefined": () => hex(m.Envelope.leaf(undefined).toCbor().toData()),
    "leaf.dateNaN": () => hex(m.Envelope.leaf(new Date(NaN)).toCbor().toData()),
    "leaf.symbol": () => hex(m.Envelope.leaf(Symbol("s")).toCbor().toData()),
    "leaf.function": () =>
      hex(
        m.Envelope.leaf(() => 1)
          .toCbor()
          .toData(),
      ),
    // a decoder returning a value that is not an instance of the case's class
    "expectSubject.foreignClass": () =>
      m.Envelope.from("x")
        .wrap()
        .expectSubject(() => ({ digest: () => "fake" }))
        .digest(),
  };

  const report = (env: any, outs: readonly Out[], context: any = "global"): string =>
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
            return env.format({ context });
          case "flat":
            return env.formatFlat({ context });
          case "tree":
            return env.treeFormat({ context });
          case "treeDigests":
            return env.treeFormat({ hideNodes: false, digestDisplay: "short", context });
          case "mermaid":
            return env.mermaidFormat();
          case "diagnostic":
            return env.diagnostic();
          case "diagAnn":
            return env.diagnostic({ annotate: true, context });
          case "hex":
            return env.hex({ context });
          case "hexPlain":
            return env.hex({ annotate: false });
          case "summary":
            return env.summary({ context });
          case "none":
            return env.format({ context: "none" });
          case "flatNone":
            return env.formatFlat({ context: "none" });
          case "treeNone":
            return env.treeFormat({ context: "none" });
        }
        return "?";
      })
      .join(SEP);

  const finish = (r: Recipe, built: any): string => {
    const outs = outputsFor(r);
    if (built !== null && typeof built === "object") {
      if ("value" in built) return built.value;
      if ("formatted" in built) return report(built.formatted, outs, built.context);
      if ("verified" in built) return withFields(report(built.verified, built.outs), built.fields);
      if ("sskrGroups" in built) {
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
    }
    return report(built, outs);
  };

  return {
    errorCode: (err) => {
      const x = err as { code?: unknown; name?: unknown; cause?: { code?: unknown } };
      const code = typeof x.code === "string" ? x.code : String(x.name ?? "Error");
      // The codes whose reference variant wraps another error carry its code too.
      const wraps = code === "Cbor" || code === "Components" || code === "Sskr";
      const inner = wraps && typeof x.cause?.code === "string" ? `[${x.cause.code}]` : "";
      return `${code}${inner}`;
    },
    errorMessage: (err) => (err instanceof Error ? err.message : String(err)),
    run(r: Recipe) {
      return finish(r, build(r.e));
    },
    async runAsync(r: Recipe) {
      const e = r.e;
      if (e.k === "agentLock") {
        const env = build(e.e);
        const agent = agentOf(e.identities, e.refuse);
        const locked = await env.lockWith(agent, e.id, {
          salt: C.Salt.from(unhex(e.salt)),
          nonce: C.Nonce.from(unhex(e.nonce)),
          rng: deps.seededRng(e.rng),
        });
        // The content key, recovered through the agent, for the reference to check.
        const encryptedKey = locked
          .objectForPredicate(HAS_SECRET)
          .expectSubject((c: Cbor) => C.EncryptedKey.fromCbor(c));
        const contentKey = await encryptedKey.unlockWithAgent(utf8(e.id), { agent });
        const back = await locked.unlockWith(agent, e.id);
        return withFields(report(locked, ALL_OUT), {
          key: hex(contentKey.bytes),
          unlock: back.isEquivalentTo(env) ? "ok" : "MISMATCH",
        });
      }
      if (e.k === "agentUnlock") {
        const env = m.Envelope.fromBytes(unhex(e.hex));
        const back = await env.unlockWith(agentOf(e.identities), e.id ?? "");
        return report(back, outputsFor(r));
      }
      return this.run(r);
    },
  };
}
