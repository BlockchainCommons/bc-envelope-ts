//! Replays a vector file against bc-envelope 0.43.0 from crates.io, over the
//! published bc-components 0.31.1, bc-crypto 0.14.0, dcbor 0.25.2,
//! known-values 0.15.5, bc-ur 0.19.2 and sskr 0.12.0.
//!
//!   cargo run --release -- ../vectors/vectors.json        # the golden file
//!   cargo run --release -- <file>                         # any file `bun run vectors:full` wrote
//!   cargo run --release --features agent -- <file>        # with the ssh-agent feature
//!
//! The recipe language mirrors tests/vectors/recipes.ts. Every recipe yields
//! one outcome string on each side and the two are compared textually: the
//! TypeScript outcome is the vector's `expect`, the reference's is computed
//! here. Outputs are joined with the same separator; a rejection is
//! `throw:<variant>[<inner variant>]|<Display>` (the port's `code`, its
//! cause's code and its message): a `bc_envelope::Error` by its variant with
//! `UnexpectedResponseID` spelled `UnexpectedResponseId` and `SSKR` `Sskr`,
//! the inner variant of `Cbor`, `Components` and `SSKR`, and its Display; a
//! bare `dcbor::Error` (what the decoders return) as `Cbor[<variant>]` with
//! dcbor's own message; a `bc_ur::Error` by its variant with `UR` printed as
//! `Decoder`.
//!
//! Where the reference has no error object at the call the port reports one
//! (a panic), the row is `panic-mapped`: `PANIC_MAPPED` names the TypeScript
//! code thrown there and only the code is compared. Where the reference
//! cannot run the recipe the row is `js-only`, in one of four named classes:
//!
//!   J1  a non-integer number where the reference takes an integer;
//!   J2  a negative or out-of-range number for the reference's type;
//!   J3  a value the reference's types cannot express (`undefined`, a
//!       `Symbol`, an invalid `Date`, a decoder with no `TryFrom<CBOR>` type);
//!   J4  a reference surface the port reaches differently (a crate-private
//!       constructor, the synchronous SSH-agent lock).
//!
//! The SSH-agent rows compare only in the `agent` build; the default build
//! reports them `build-scoped`. Anything else that differs is a MISMATCH; a
//! recipe field this program cannot read exactly is `unparsable`. Both make
//! the process exit 1. Rows under `noreg` run before `register_tags()` and
//! must come first in the file; `late` rows change the global stores after
//! the format context exists and come last.
use std::collections::HashSet;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::mpsc;
use std::time::Duration;

use bc_components::{
    ARID, Argon2idParams, Compressed, Decrypter, Digest, Ed25519PublicKey, EncapsulationPrivateKey,
    EncapsulationPublicKey, EncryptedKey, EncryptedMessage, HKDFParams, HashType,
    KeyDerivationMethod, KeyDerivationParams, Nonce, PBKDF2Params, PrivateKeyBase, SSKRGroupSpec,
    SSKRShare, SSKRSpec, Salt, ScryptParams, SigningOptions, SigningPrivateKey, SigningPublicKey,
    SymmetricKey, URI, UUID, X25519PublicKey,
};
use bc_envelope::prelude::*;
use bc_envelope::Assertion;
use bc_rand::SeededRandomNumberGenerator;
use bc_ur::UR;
use dcbor::{CBORCase, Date, Tag, TagsStore};
use known_values::DirectoryConfig;
use serde::Deserialize;

#[cfg(feature = "agent")]
use bc_components::{KeyDerivation, SSHAgent, SSHAgentParams};
#[cfg(feature = "agent")]
use std::cell::RefCell;
#[cfg(feature = "agent")]
use std::rc::Rc;

const SEP: &str = "\n---\n";
const DEFAULT_PBKDF2_ITERATIONS: u32 = 100_000;
const DEFAULT_SCRYPT_LOG_N: u8 = 15;
const DEFAULT_SCRYPT_R: u32 = 8;
const DEFAULT_SCRYPT_P: u32 = 1;

// ---------------------------------------------------------------------------
// Outcome rendering
// ---------------------------------------------------------------------------

/// The first token of a `Debug` rendering: the enum variant name.
fn variant<E: std::fmt::Debug>(e: &E) -> String {
    let d = format!("{e:?}");
    d.split(|c: char| c == '(' || c == '{' || c == ' ').next().unwrap_or(&d).to_string()
}
/// `throw:<code>[<inner>]|<message>` for every error class the reference returns.
trait Render {
    fn render(&self) -> String;
}
impl Render for bc_envelope::Error {
    fn render(&self) -> String {
        use bc_envelope::Error as E;
        let code = match self {
            E::Cbor(inner) => format!("Cbor[{}]", variant(inner)),
            E::Components(inner) => format!("Components[{}]", variant(inner)),
            E::SSKR(inner) => format!("Sskr[{}]", sskr_variant(inner)),
            E::UnexpectedResponseID => "UnexpectedResponseId".to_string(),
            other => variant(other),
        };
        format!("throw:{code}|{self}")
    }
}
fn sskr_variant(e: &bc_components::SSKRError) -> String {
    let v = variant(e);
    if v == "ShamirError" { "Shamir".to_string() } else { v }
}
impl Render for bc_components::SSKRError {
    fn render(&self) -> String { format!("throw:Sskr[{}]|sskr error: {self}", sskr_variant(self)) }
}
impl Render for dcbor::Error {
    fn render(&self) -> String { format!("throw:Cbor[{}]|{self}", variant(self)) }
}
impl Render for bc_components::Error {
    fn render(&self) -> String { format!("throw:Components[{}]|components error: {self}", variant(self)) }
}
impl Render for bc_ur::Error {
    fn render(&self) -> String {
        let code = match self {
            bc_ur::Error::UR(_) => "Decoder".to_string(),
            bc_ur::Error::Cbor(inner) => format!("Cbor[{}]", variant(inner)),
            other => variant(other),
        };
        format!("throw:{code}|{self}")
    }
}
macro_rules! tri {
    ($e:expr) => {
        match $e {
            Ok(v) => v,
            Err(e) => return Err(e.render()),
        }
    };
}
/// A recipe field this program cannot read exactly is an `unparsable` row.
macro_rules! need {
    ($e:expr, $what:expr) => {
        match $e {
            Some(v) => v,
            None => return Err(format!("unparsable:{}", $what)),
        }
    };
}

const J3: &str = "js-only:J3";
const BUILD_SCOPED: &str = "build-scoped:agent";

fn h(b: impl AsRef<[u8]>) -> String { hex::encode(b) }

// ---------------------------------------------------------------------------
// The vector file
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct File { count: usize, vectors: Vec<Vector> }
#[derive(Deserialize, Clone)]
struct Vector { name: String, recipe: J, expect: String }
type J = serde_json::Value;
type R<T> = Result<T, String>;

fn bytes(h: &str) -> Option<Vec<u8>> { hex::decode(h).ok() }
fn s<'a>(v: &'a J, k: &str) -> Option<&'a str> { v.get(k)?.as_str() }
fn seeded(seed: &J) -> Option<SeededRandomNumberGenerator> {
    let a = seed.as_array()?;
    let mut out = [0u64; 4];
    for (i, x) in a.iter().enumerate().take(4) { out[i] = x.as_str()?.parse().ok()?; }
    Some(SeededRandomNumberGenerator::new(out))
}
fn arr32(hx: &str) -> Option<[u8; 32]> { bytes(hx)?.try_into().ok() }
fn key32(hx: &str) -> R<SymmetricKey> { Ok(SymmetricKey::from_data(need!(arr32(hx), "key"))) }
fn nonce12(hx: &str) -> R<Nonce> { Ok(Nonce::from_data(need!(bytes(hx).and_then(|b| b.try_into().ok()), "nonce"))) }
/// A leaf's integer, exact: `i64` and `u64` heads, and a CBOR negative below `i64::MIN` (`-1 - n`).
fn int_cbor(text: &str) -> Option<CBOR> {
    if let Ok(v) = text.parse::<i64>() { return Some(CBOR::from(v)); }
    if let Ok(v) = text.parse::<u64>() { return Some(CBOR::from(v)); }
    let v: i128 = text.parse().ok()?;
    if v >= 0 || v < -(1i128 << 64) { return None; }
    Some(CBOR::from(CBORCase::Negative((-1 - v) as u64)))
}
fn known_value(v: &J, name: Option<&str>) -> Option<KnownValue> {
    let value = match v {
        J::Number(n) => n.as_u64()?,
        J::String(t) => t.parse::<u64>().ok()?,
        _ => return None,
    };
    Some(match name {
        Some(n) => KnownValue::new_with_name(value, n.to_string()),
        None => KnownValue::new(value),
    })
}
/// The `name=value` field of a TypeScript outcome, for the rows the reference verifies rather than reproduces.
fn field<'a>(want: &'a str, name: &str) -> Option<&'a str> {
    want.split(SEP).find_map(|f| f.strip_prefix(name).and_then(|r| r.strip_prefix('=')))
}
/// The TypeScript envelope of a verified row: its `cbor=` field, else its first output.
fn ts_envelope(want: &str) -> R<Envelope> {
    let first = field(want, "cbor").unwrap_or_else(|| want.split(SEP).next().unwrap_or(""));
    let data = need!(bytes(first), "the row's cbor field");
    Envelope::try_from_cbor_data(data).map_err(|e| format!("the TypeScript envelope does not decode: {e}"))
}
/// The nonce of an encrypted subject, so a rebuilt envelope encrypts with the port's.
fn subject_nonce(env: &Envelope) -> R<Nonce> {
    match env.subject().case() {
        EnvelopeCase::Encrypted(m) => Ok(m.nonce().clone()),
        _ => Err("the TypeScript envelope's subject is not encrypted".into()),
    }
}
/// `format_opt` with options whose type (`EnvelopeFormatOpts`) is not
/// nameable outside the reference crate: a dead call fixes the type.
fn format_with(env: &Envelope, flat: bool, ctx: FormatContextOpt<'_>) -> String {
    let o = Default::default();
    if false {
        let _ = env.format_opt(&o);
    }
    env.format_opt(&o.flat(flat).context(ctx))
}

// ---------------------------------------------------------------------------
// Leaves
// ---------------------------------------------------------------------------

fn leaf_cbor(l: &J) -> R<CBOR> {
    Ok(match need!(s(l, "t"), "leaf type") {
        "text" => CBOR::from(need!(s(l, "v"), "text")),
        "int" => need!(int_cbor(need!(s(l, "v"), "int")), "int"),
        "bytes" => CBOR::to_byte_string(need!(bytes(need!(s(l, "hex"), "bytes")), "bytes")),
        "bool" => CBOR::from(need!(l.get("v").and_then(|x| x.as_bool()), "bool")),
        "null" => CBOR::null(),
        "float" => CBOR::from(need!(l.get("v").and_then(|x| x.as_f64()), "float")),
        "array" => {
            let mut items = Vec::new();
            for x in need!(l.get("items").and_then(|x| x.as_array()), "items") { items.push(leaf_cbor(x)?); }
            CBOR::from(items)
        }
        "map" => {
            let mut m = Map::new();
            for e in need!(l.get("entries").and_then(|x| x.as_array()), "entries") {
                m.insert(leaf_cbor(&e[0])?, leaf_cbor(&e[1])?);
            }
            CBOR::from(m)
        }
        "arid" => ARID::from_data(need!(arr32(need!(s(l, "hex"), "arid")), "arid")).into(),
        "digest" => Digest::from_data(need!(arr32(need!(s(l, "hex"), "digest")), "digest")).into(),
        "uuid" => UUID::from_data(need!(bytes(need!(s(l, "hex"), "uuid")).and_then(|b| b.try_into().ok()), "uuid")).into(),
        "uri" => tri!(URI::new(need!(s(l, "v"), "uri"))).into(),
        "kv" => need!(known_value(need!(l.get("v"), "kv"), s(l, "name")), "kv").into(),
        "date" => Date::from_timestamp(need!(l.get("ms").and_then(|x| x.as_f64()), "ms") / 1000.0).into(),
        "cbor" => tri!(CBOR::try_from_data(need!(bytes(need!(s(l, "hex"), "cbor")), "cbor"))),
        t => return Err(format!("unparsable:leaf {t}")),
    })
}

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

/// What a recipe yields before its outputs are rendered.
enum Built {
    Env(Envelope),
    /// A complete outcome (`ok:…`, a count, a field list).
    Value(String),
    /// An envelope rebuilt around the port's artefact, whose outputs then compare in full.
    Verified { env: Envelope, fields: Vec<(String, String)>, outs: &'static [&'static str] },
    Fmt { env: Envelope, ctx: Option<FormatContext> },
    Sskr { groups: Vec<Vec<Envelope>>, original: Envelope, spec: J },
}
const ALL_OUT: &[&str] = &["cbor", "ur", "digest", "format", "flat", "tree", "treeDigests", "mermaid", "diagnostic", "hex", "summary"];
const DIGEST_STABLE_OUT: &[&str] = &["format", "flat", "summary"];

fn signer(seed: &str, scheme: &str) -> R<SigningPrivateKey> {
    let base = PrivateKeyBase::from_data(need!(bytes(seed), "seed"));
    Ok(match scheme {
        "ed25519" => base.ed25519_signing_private_key(),
        "ecdsa" => base.ecdsa_signing_private_key(),
        "schnorr" => base.schnorr_signing_private_key(),
        other => return Err(format!("unparsable:scheme {other}")),
    })
}
fn function_of(f: &J) -> R<Function> {
    Ok(match f {
        J::String(t) if t == "$ADD" => bc_envelope::extension::expressions::functions::ADD,
        J::String(t) => Function::new_named(t),
        J::Number(n) => Function::new_known(need!(n.as_u64(), "func"), None),
        _ => return Err("unparsable:func".into()),
    })
}
fn parameter_of(p: &J) -> R<Parameter> {
    Ok(match p {
        J::Number(n) => Parameter::new_known(need!(n.as_u64(), "param"), None),
        J::String(t) => match t.strip_prefix('#') {
            Some(digits) => Parameter::new_known(need!(digits.parse().ok(), "param"), None),
            None => Parameter::new_named(t),
        },
        _ => return Err("unparsable:param".into()),
    })
}
fn kdf_params(method: &str, salt: Salt) -> R<KeyDerivationParams> {
    Ok(match method {
        "hkdf" => KeyDerivationParams::HKDF(HKDFParams::new_opt(salt, HashType::SHA256)),
        "pbkdf2" => KeyDerivationParams::PBKDF2(PBKDF2Params::new_opt(salt, DEFAULT_PBKDF2_ITERATIONS, HashType::SHA256)),
        "scrypt" => KeyDerivationParams::Scrypt(ScryptParams::new_opt(salt, DEFAULT_SCRYPT_LOG_N, DEFAULT_SCRYPT_R, DEFAULT_SCRYPT_P)),
        "argon2id" => KeyDerivationParams::Argon2id(Argon2idParams::new_opt(salt)),
        other => return Err(format!("unparsable:method {other}")),
    })
}
fn method_of(m: &str) -> R<KeyDerivationMethod> {
    Ok(match m {
        "hkdf" => KeyDerivationMethod::HKDF,
        "pbkdf2" => KeyDerivationMethod::PBKDF2,
        "scrypt" => KeyDerivationMethod::Scrypt,
        "argon2id" => KeyDerivationMethod::Argon2id,
        other => return Err(format!("unparsable:method {other}")),
    })
}
fn custom_context(ctx: &J) -> R<FormatContext> {
    let mut kvs = KnownValuesStore::default();
    if let Some(list) = ctx.get("knownValues").and_then(|x| x.as_array()) {
        for row in list { kvs.insert(need!(known_value(&row[0], row[1].as_str()), "knownValues")); }
    }
    let mut tags = TagsStore::default();
    if let Some(list) = ctx.get("tags").and_then(|x| x.as_array()) {
        for row in list { tags.insert(Tag::new(need!(row[0].as_u64(), "tags"), need!(row[1].as_str(), "tags"))); }
    }
    let mut context = FormatContext::new(Some(&tags), Some(&kvs), None, None);
    if ctx.get("register").and_then(|x| x.as_bool()) == Some(true) { bc_envelope::register_tags_in(&mut context); }
    Ok(context)
}

fn env_of(e: &J) -> R<Envelope> {
    match build(e)? {
        Built::Env(env) => Ok(env),
        _ => Err("unparsable:a value recipe where an envelope goes".into()),
    }
}

fn build(e: &J) -> R<Built> {
    let sub = |key: &str| -> R<Envelope> { env_of(need!(e.get(key), key)) };
    let built = match need!(s(e, "k"), "k") {
        "leaf" => {
            let l = need!(e.get("v"), "v");
            match s(l, "t") {
                Some("null") => Envelope::null(),
                Some("kv") => Envelope::new(need!(known_value(need!(l.get("v"), "kv"), s(l, "name")), "kv")),
                _ => Envelope::new(leaf_cbor(l)?),
            }
        }
        "kv" => Envelope::new(need!(known_value(need!(e.get("v"), "v"), s(e, "name")), "kv")),
        "node" => {
            let mut env = sub("subject")?;
            for a in need!(e.get("assertions").and_then(|x| x.as_array()), "assertions") {
                let assertion = Envelope::new_assertion(env_of(&a[0])?, env_of(&a[1])?);
                env = tri!(env.add_assertion_envelope(assertion));
            }
            env
        }
        "wrap" => sub("e")?.wrap(),
        "assertion" => Envelope::new_assertion(sub("pred")?, sub("obj")?),
        "elide" => {
            let target = sub("e")?;
            let set = |key: &str| -> R<HashSet<Digest>> {
                let mut set = HashSet::new();
                if let Some(list) = e.get(key).and_then(|x| x.as_array()) {
                    for x in list { set.insert(env_of(x)?.digest()); }
                }
                Ok(set)
            };
            let action = match e.get("action") {
                Some(J::String(a)) if a == "compress" => ObscureAction::Compress,
                Some(J::Object(o)) => ObscureAction::Encrypt(key32(need!(s(&J::Object(o.clone()), "encrypt"), "encrypt"))?),
                _ => ObscureAction::Elide,
            };
            if e.get("revealing").is_some() {
                target.elide_revealing_set_with_action(&set("revealing")?, &action)
            } else {
                target.elide_removing_set_with_action(&set("removing")?, &action)
            }
        }
        "encrypt" => {
            let target = sub("e")?;
            let key = key32(need!(s(e, "key"), "key"))?;
            let nonce = match s(e, "nonce") { Some(n) => Some(nonce12(n)?), None => None };
            let target = if e.get("subject").and_then(|x| x.as_bool()).unwrap_or(false) { target } else { target.wrap() };
            tri!(target.encrypt_subject_opt(&key, nonce))
        }
        "compress" => {
            let target = sub("e")?;
            if e.get("subject").and_then(|x| x.as_bool()).unwrap_or(false) { tri!(target.compress_subject()) } else { tri!(target.compress()) }
        }
        "sign" => return sign(e),
        "salt" => {
            let target = sub("e")?;
            let mut rng = need!(e.get("rng").and_then(seeded), "rng");
            if let Some(range) = e.get("range").and_then(|r| r.as_array()) {
                let (min, max) = (need!(range[0].as_u64(), "range") as usize, need!(range[1].as_u64(), "range") as usize);
                tri!(target.add_salt_in_range_using(&(min..=max), &mut rng))
            } else {
                match e.get("len") {
                    Some(len) => tri!(target.add_salt_with_len_using(need!(len.as_u64(), "len") as usize, &mut rng)),
                    None => target.add_salt_using(&mut rng),
                }
            }
        }
        "sskr" => return build_sskr(e),
        "sskrJoinRaw" => {
            let target = sub("e")?;
            let mut envelopes = Vec::new();
            for share in need!(e.get("shares").and_then(|x| x.as_array()), "shares") {
                let data = need!(share.as_str().and_then(bytes), "share");
                envelopes.push(target.add_assertion(known_values::SSKR_SHARE, SSKRShare::from_data(data)));
            }
            let refs: Vec<&Envelope> = envelopes.iter().collect();
            tri!(Envelope::sskr_join(&refs))
        }
        "attach" => {
            let target = sub("e")?;
            let payload = sub("payload")?;
            target.add_attachment(payload, need!(s(e, "vendor"), "vendor"), s(e, "conformsTo"))
        }
        "type" => sub("e")?.add_type(sub("type")?),
        "position" => {
            let mut target = sub("e")?;
            let pos: u64 = need!(s(e, "pos").and_then(|p| p.parse().ok()), "pos");
            tri!(target.set_position(pos as usize))
        }
        "request" => {
            let id = ARID::from_data(need!(arr32(need!(s(e, "id"), "id")), "id"));
            let mut req = Request::new(function_of(need!(e.get("func"), "func"))?, id);
            for p in need!(e.get("params").and_then(|x| x.as_array()), "params") {
                req = req.with_parameter(parameter_of(&p[0])?, env_of(&p[1])?);
            }
            if let Some(note) = s(e, "note") { req = req.with_note(note); }
            if let Some(ms) = e.get("date").and_then(|d| d.as_f64()) { req = req.with_date(Date::from_timestamp(ms / 1000.0)); }
            req.to_envelope()
        }
        "response" => {
            let id = ARID::from_data(need!(arr32(need!(s(e, "id"), "id")), "id"));
            if e.get("result").is_some() {
                Response::new_success(id).with_result(sub("result")?).to_envelope()
            } else {
                let err: Envelope = if e.get("error").is_some() { sub("error")? } else { Envelope::new("error") };
                Response::new_failure(id).with_error(err).to_envelope()
            }
        }
        "responseOp" => {
            let id = ARID::from_data(need!(arr32(need!(s(e, "id"), "id")), "id"));
            match need!(s(e, "op"), "op") {
                "resultOnFailure" => Response::new_failure(id).with_result(1).to_envelope(),
                "errorOnSuccess" => Response::new_success(id).with_error("e").to_envelope(),
                "expectIdEarly" => return Ok(Built::Value(format!("ok:{}", h(Response::new_early_failure().expect_id().data())))),
                other => return Err(format!("unparsable:responseOp {other}")),
            }
        }
        "recipient" => return recipient(e),
        "lock" => return lock(e),
        "seal" => return seal(e),
        "agentLock" => return agent_lock(e),
        "agentUnlock" => return agent_unlock(e),
        "decode" => tri!(Envelope::try_from_cbor_data(need!(s(e, "hex").and_then(bytes), "hex"))),
        "ur" => {
            // The port's `decodeURWith(UR.parse(s), Envelope.codec)` in the
            // reference's three steps: the UR grammar, the type check (a
            // `dcbor::Error::Custom`, as `from_ur` flattens it), the decoder.
            let ur = tri!(UR::from_ur_string(need!(s(e, "s"), "s")));
            if let Err(err) = ur.check_type("envelope") {
                return Err(dcbor::Error::Custom(err.to_string()).render());
            }
            tri!(Envelope::from_untagged_cbor(ur.cbor()))
        }
        "nodeEnv" => {
            let mut env = sub("subject")?;
            for a in need!(e.get("assertions").and_then(|x| x.as_array()), "assertions") {
                env = tri!(env.add_assertion_envelope(env_of(a)?));
            }
            env
        }
        "recipientDecode" => {
            let ur = tri!(UR::from_ur_string(need!(s(e, "ur"), "ur")));
            if let Err(err) = ur.check_type("envelope") {
                return Err(dcbor::Error::Custom(err.to_string()).render());
            }
            let env = tri!(Envelope::from_untagged_cbor(ur.cbor()));
            let base = PrivateKeyBase::from_data(need!(s(e, "recipientSeed").and_then(bytes), "recipientSeed"));
            tri!(env.decrypt_subject_to_recipient(&base))
        }
        "fmt" => {
            let env = tri!(Envelope::try_from_cbor_data(need!(s(e, "hex").and_then(bytes), "hex")));
            let ctx = match e.get("context") { Some(c) => Some(custom_context(c)?), None => None };
            return Ok(Built::Fmt { env, ctx });
        }
        "extract" => return Ok(Built::Value(extract(sub("e")?, need!(s(e, "decoder"), "decoder"))?)),
        "pred" => {
            let target = sub("e")?;
            let v = match need!(s(e, "pred"), "pred") {
                "isTrue" => target.is_true(),
                "isFalse" => target.is_false(),
                "isBool" => target.is_bool(),
                "isNull" => target.is_null(),
                "isNumber" => target.is_number(),
                "isNaN" => target.is_nan(),
                "isSubjectNumber" => target.is_subject_number(),
                "isSubjectUnit" => target.is_subject_unit(),
                other => return Err(format!("unparsable:pred {other}")),
            };
            return Ok(Built::Value(v.to_string()));
        }
        "op" => return run_op(e),
        "noreg" => return build(need!(e.get("inner"), "inner")),
        "late" => {
            if let Some(list) = e.get("knownValues").and_then(|x| x.as_array()) {
                for row in list {
                    let kv = need!(known_value(&row[0], row[1].as_str()), "knownValues");
                    known_values::KNOWN_VALUES.get().as_mut().expect("known values").insert(kv);
                }
            }
            if let Some(list) = e.get("tags").and_then(|x| x.as_array()) {
                for row in list {
                    let tag = Tag::new(need!(row[0].as_u64(), "tags"), need!(row[1].as_str(), "tags"));
                    dcbor::with_tags_mut!(|t: &mut TagsStore| t.insert(tag));
                }
            }
            return build(need!(e.get("inner"), "inner"));
        }
        "domain" => return Ok(Built::Value(format!("js-only:{}", need!(s(e, "cls"), "cls")))),
        k => return Err(format!("unparsable:kind {k}")),
    };
    Ok(Built::Env(built))
}

fn sign(e: &J) -> R<Built> {
    let target = env_of(need!(e.get("e"), "e"))?;
    let scheme = need!(s(e, "scheme"), "scheme");
    let metadata = s(e, "note").map(|note| SignatureMetadata::new().add_assertion(Assertion::new(known_values::NOTE, note)));
    let key = match scheme {
        "ssh-ed25519" => {
            let base = PrivateKeyBase::from_data(need!(s(e, "seed").and_then(bytes), "seed"));
            tri!(base.ssh_signing_private_key(ssh_key::Algorithm::Ed25519, s(e, "comment").unwrap_or("")))
        }
        "mldsa44" => {
            // The port signed with fresh randomness: verify its signature
            // with the public key the row carries, then compare the
            // renderings of its envelope.
            let want = need!(e.get("__want").and_then(|x| x.as_str()), "want");
            let env = ts_envelope(want)?;
            let pub_key = tri!(SigningPublicKey::from_tagged_cbor_data(need!(field(want, "pub").and_then(bytes), "pub")));
            tri!(env.verify_signature_from(&pub_key));
            return Ok(Built::Verified { env: env.clone(), fields: vec![("cbor".into(), h(env.tagged_cbor_data())), ("pub".into(), h(pub_key.tagged_cbor_data()))], outs: DIGEST_STABLE_OUT });
        }
        other => signer(need!(s(e, "seed"), "seed"), other)?,
    };
    let options = match (e.get("ssh"), e.get("rng")) {
        (Some(ssh), _) => Some(SigningOptions::Ssh {
            namespace: need!(s(ssh, "namespace"), "namespace").to_string(),
            hash_alg: match need!(s(ssh, "hashAlg"), "hashAlg") { "sha512" => ssh_key::HashAlg::Sha512, _ => ssh_key::HashAlg::Sha256 },
        }),
        (None, Some(rng)) if scheme == "schnorr" => Some(SigningOptions::Schnorr { rng: Rc::new(RefCell::new(need!(seeded(rng), "rng"))) }),
        _ => None,
    };
    let signed = if metadata.is_some() || options.is_some() {
        target.wrap().add_signature_opt(&key, options, metadata)
    } else {
        target.sign(&key)
    };
    Ok(Built::Env(signed))
}
#[cfg(not(feature = "agent"))]
use std::cell::RefCell;
#[cfg(not(feature = "agent"))]
use std::rc::Rc;

fn build_sskr(e: &J) -> R<Built> {
    let target = env_of(need!(e.get("e"), "e"))?;
    let key = key32(need!(s(e, "key"), "key"))?;
    let spec = need!(e.get("spec"), "spec");
    let mut groups = Vec::new();
    for g in need!(spec.get("groups").and_then(|x| x.as_array()), "groups") {
        groups.push(tri!(SSKRGroupSpec::new(need!(g["mt"].as_u64(), "mt") as usize, need!(g["mc"].as_u64(), "mc") as usize)));
    }
    let sskr_spec = tri!(SSKRSpec::new(need!(spec["gt"].as_u64(), "gt") as usize, groups));
    let mut rng = need!(e.get("rng").and_then(seeded), "rng");
    let encrypted = tri!(target.encrypt_subject(&key));
    let shares = tri!(encrypted.sskr_split_using(&sskr_spec, &key, &mut rng));
    Ok(Built::Sskr { groups: shares, original: target, spec: spec.clone() })
}

fn recipient(e: &J) -> R<Built> {
    let target = env_of(need!(e.get("e"), "e"))?;
    let key = key32(need!(s(e, "key"), "key"))?;
    let scheme = s(e, "scheme").unwrap_or("x25519");
    let exact = e.get("nonce").is_some() && e.get("rng").is_some() && scheme != "lowOrder";
    let recipient_seed = need!(s(e, "recipientSeed"), "recipientSeed");
    if !exact {
        let recipient: EncapsulationPublicKey = match scheme {
            "x25519" => tri!(PrivateKeyBase::from_data(need!(bytes(recipient_seed), "recipientSeed")).encapsulation_private_key().public_key()),
            "lowOrder" => EncapsulationPublicKey::X25519(tri!(X25519PublicKey::from_data_ref(need!(bytes(recipient_seed), "recipientSeed")))),
            "mlkem512" => {
                // The port drew the key; the reference reads it from the row.
                let want = need!(e.get("__want").and_then(|x| x.as_str()), "want");
                let private = tri!(EncapsulationPrivateKey::try_from(tri!(CBOR::try_from_data(need!(field(want, "priv").and_then(bytes), "priv")))));
                let recipient = tri!(EncapsulationPublicKey::try_from(tri!(CBOR::try_from_data(need!(field(want, "pub").and_then(bytes), "pub")))));
                let nonce = match s(e, "nonce") { Some(n) => Some(nonce12(n)?), None => None };
                let encrypted = tri!(target.encrypt_subject_opt(&key, nonce));
                let seal_nonce = match s(e, "sealNonce") { Some(n) => Some(nonce12(n)?), None => None };
                let env = encrypted.add_recipient_opt(&recipient, &key, seal_nonce);
                // The sealed message opens with the private key the row carries.
                let sealed = tri!(env.recipients());
                if tri!(sealed[0].decrypt(&private)) != key.tagged_cbor_data() { return Err("the reference's sealed content key does not open with the row's private key".into()); }
                let fields = vec![("priv".into(), field(want, "priv").unwrap_or("").to_string()), ("pub".into(), field(want, "pub").unwrap_or("").to_string())];
                return Ok(Built::Verified { env, fields, outs: DIGEST_STABLE_OUT });
            }
            other => return Err(format!("unparsable:scheme {other}")),
        };
        let nonce = match s(e, "nonce") { Some(n) => Some(nonce12(n)?), None => None };
        let encrypted = tri!(target.encrypt_subject_opt(&key, nonce));
        let seal_nonce = match s(e, "sealNonce") { Some(n) => Some(nonce12(n)?), None => None };
        return Ok(Built::Env(encrypted.add_recipient_opt(&recipient, &key, seal_nonce)));
    }
    // Exact bytes: open the port's sealed message with the recipient key and
    // rebuild the envelope around it.
    let want = need!(e.get("__want").and_then(|x| x.as_str()), "want");
    let ts = ts_envelope(want)?;
    let private: EncapsulationPrivateKey = match scheme {
        "x25519" => PrivateKeyBase::from_data(need!(bytes(recipient_seed), "recipientSeed")).encapsulation_private_key(),
        "mlkem512" => tri!(EncapsulationPrivateKey::try_from(tri!(CBOR::try_from_data(need!(field(want, "priv").and_then(bytes), "priv"))))),
        other => return Err(format!("unparsable:scheme {other}")),
    };
    let sealed = tri!(ts.recipients());
    if sealed.len() != 1 { return Err(format!("the TypeScript envelope carries {} sealed messages", sealed.len())); }
    let plaintext = tri!(sealed[0].decrypt(&private));
    if plaintext != key.tagged_cbor_data() { return Err("the sealed content key is not the row's key".into()); }
    let nonce = subject_nonce(&ts)?;
    let rebuilt = tri!(target.encrypt_subject_opt(&key, Some(nonce))).add_assertion(known_values::HAS_RECIPIENT, sealed[0].clone());
    let mut fields = vec![("key".to_string(), h(key.data()))];
    if let Some(p) = field(want, "priv") { fields.push(("priv".into(), p.to_string())); }
    if let Some(p) = field(want, "pub") { fields.push(("pub".into(), p.to_string())); }
    Ok(Built::Verified { env: rebuilt, fields, outs: ALL_OUT })
}

fn lock(e: &J) -> R<Built> {
    let target = env_of(need!(e.get("e"), "e"))?;
    let secret = need!(s(e, "secret").and_then(bytes), "secret");
    let method = need!(s(e, "method"), "method");
    let (Some(key), Some(nonce), Some(salt)) = (s(e, "key"), s(e, "nonce"), s(e, "salt")) else {
        return Ok(Built::Env(tri!(target.lock(method_of(method)?, secret))));
    };
    // Composed as the reference composes `lock_subject`, with the port's
    // encrypted key (its nonce is components' own) unlocked and checked.
    let key = key32(key)?;
    let nonce = nonce12(nonce)?;
    let salt = Salt::from_data(need!(bytes(salt), "salt"));
    let want = need!(e.get("__want").and_then(|x| x.as_str()), "want");
    let ts = ts_envelope(want)?;
    let object = tri!(ts.object_for_predicate(known_values::HAS_SECRET));
    let encrypted_key = tri!(object.extract_subject::<EncryptedKey>());
    if tri!(encrypted_key.unlock(&secret)) != key { return Err("the TypeScript encrypted key does not unlock to the row's key".into()); }
    let params = tri!(KeyDerivationParams::try_from(tri!(encrypted_key.aad_cbor())));
    let expected = kdf_params(method, salt)?;
    if format!("{params:?}") != format!("{expected:?}") { return Err(format!("the TypeScript key derivation parameters are {params:?}, not {expected:?}")); }
    let rebuilt = tri!(target.wrap().encrypt_subject_opt(&key, Some(nonce))).add_assertion(known_values::HAS_SECRET, encrypted_key);
    Ok(Built::Verified { env: rebuilt, fields: vec![("key".into(), h(key.data()))], outs: ALL_OUT })
}

fn seal(e: &J) -> R<Built> {
    let target = env_of(need!(e.get("e"), "e"))?;
    let sender = signer(need!(s(e, "seed"), "seed"), "ed25519")?;
    let recipient_base = PrivateKeyBase::from_data(need!(s(e, "recipientSeed").and_then(bytes), "recipientSeed"));
    let recipient = tri!(recipient_base.encapsulation_private_key().public_key());
    let exact = e.get("nonce").is_some() && e.get("rng").is_some();
    if !exact {
        let sealed = target.seal(&sender, &recipient);
        let unsealed = tri!(sealed.unseal(&tri!(sender.public_key()), &recipient_base));
        let ok = if unsealed.is_equivalent_to(&target) { "ok" } else { "MISMATCH" };
        return Ok(Built::Verified { env: sealed, fields: vec![("unseal".into(), ok.into())], outs: DIGEST_STABLE_OUT });
    }
    let want = need!(e.get("__want").and_then(|x| x.as_str()), "want");
    let ts = ts_envelope(want)?;
    let sealed = tri!(ts.recipients());
    if sealed.len() != 1 { return Err(format!("the TypeScript envelope carries {} sealed messages", sealed.len())); }
    let content_key = tri!(SymmetricKey::from_tagged_cbor_data(tri!(sealed[0].decrypt(&recipient_base))));
    let nonce = subject_nonce(&ts)?;
    let rebuilt = tri!(target.sign(&sender).wrap().encrypt_subject_opt(&content_key, Some(nonce)))
        .add_assertion(known_values::HAS_RECIPIENT, sealed[0].clone());
    let unsealed = tri!(ts.unseal(&tri!(sender.public_key()), &recipient_base));
    let ok = if unsealed.is_equivalent_to(&target) { "ok" } else { "MISMATCH" };
    Ok(Built::Verified { env: rebuilt, fields: vec![("unseal".into(), ok.into())], outs: ALL_OUT })
}

/// An in-memory SSH agent over OpenSSH private keys, the reference's test
/// agent: identities are keyed by comment and sign under namespace
/// `test_namespace` with SHA-256, returning the inner signature bytes.
#[cfg(feature = "agent")]
struct MemoryAgent { keys: Vec<ssh_key::PrivateKey>, refuse: bool }
#[cfg(feature = "agent")]
impl SSHAgent for MemoryAgent {
    fn list_identities(&mut self) -> bc_components::Result<Vec<ssh_key::PublicKey>> { Ok(self.keys.iter().map(|k| k.public_key().clone()).collect()) }
    fn add_identity(&mut self, key: &ssh_key::PrivateKey) -> bc_components::Result<()> { self.keys.push(key.clone()); Ok(()) }
    fn remove_identity(&mut self, key: &ssh_key::PrivateKey) -> bc_components::Result<()> { self.keys.retain(|k| k.comment() != key.comment()); Ok(()) }
    fn remove_all_identities(&mut self) -> bc_components::Result<()> { self.keys.clear(); Ok(()) }
    fn sign(&mut self, key: &ssh_key::PublicKey, data: &[u8]) -> bc_components::Result<ssh_key::Signature> {
        if self.refuse { return Err(bc_components::Error::ssh_agent("refused")); }
        let k = self.keys.iter().find(|k| k.comment() == key.comment()).ok_or_else(|| bc_components::Error::ssh_agent("Identity not found"))?;
        let sig = k.sign("test_namespace", ssh_key::HashAlg::Sha256, data).map_err(|e| bc_components::Error::ssh_agent(format!("Failed to sign data: {}", e)))?;
        Ok(sig.signature().clone())
    }
}
#[cfg(feature = "agent")]
fn agent_of(e: &J) -> R<Rc<RefCell<dyn SSHAgent>>> {
    let mut keys = Vec::new();
    for id in need!(e.get("identities").and_then(|x| x.as_array()), "identities") {
        let base = PrivateKeyBase::from_data(need!(s(id, "seed").and_then(bytes), "seed"));
        let p = tri!(base.ssh_signing_private_key(ssh_key::Algorithm::Ed25519, need!(s(id, "comment"), "comment")));
        keys.push(p.to_ssh().expect("an SSH key").clone());
    }
    let refuse = e.get("refuse").and_then(|x| x.as_bool()).unwrap_or(false);
    Ok(Rc::new(RefCell::new(MemoryAgent { keys, refuse })))
}
#[cfg(not(feature = "agent"))]
fn agent_lock(_e: &J) -> R<Built> { Ok(Built::Value(BUILD_SCOPED.into())) }
#[cfg(not(feature = "agent"))]
fn agent_unlock(_e: &J) -> R<Built> { Ok(Built::Value(BUILD_SCOPED.into())) }
/// `lock_subject` with `KeyDerivationMethod::SSHAgent` over the in-memory
/// agent: the reference locks a content key of its own through the same
/// parameters (checking the errors and the parameters the port produced),
/// opens the port's encrypted key, decrypts its subject and rebuilds the
/// envelope around the port's key.
#[cfg(feature = "agent")]
fn agent_lock(e: &J) -> R<Built> {
    let target = env_of(need!(e.get("e"), "e"))?;
    let agent = agent_of(e)?;
    let id = need!(s(e, "id"), "id");
    let salt = Salt::from_data(need!(s(e, "salt").and_then(bytes), "salt"));
    let want = need!(e.get("__want").and_then(|x| x.as_str()), "want");
    // The reference's own lock over the same parameters: its errors are the row's.
    let mut own_params = SSHAgentParams::new_opt(salt.clone(), "", Some(agent.clone()));
    let own_key = SymmetricKey::new();
    let own = tri!(KeyDerivation::lock(&mut own_params, &own_key, id.as_bytes()));
    if tri!(KeyDerivation::unlock(&own_params, &own, id.as_bytes())) != own_key { return Err("the reference's own lock does not unlock".into()); }
    let ts = ts_envelope(want)?;
    let object = tri!(ts.object_for_predicate(known_values::HAS_SECRET));
    let encrypted_key = tri!(object.extract_subject::<EncryptedKey>());
    let KeyDerivationParams::SSHAgent(mut ts_params) = tri!(KeyDerivationParams::try_from(tri!(encrypted_key.aad_cbor()))) else {
        return Err("the TypeScript key is not SSH-agent locked".into());
    };
    if ts_params != own_params { return Err(format!("the TypeScript parameters are {ts_params}, not {own_params}")); }
    ts_params.set_agent(Some(agent.clone()));
    let content_key = tri!(KeyDerivation::unlock(&ts_params, encrypted_key.encrypted_message(), id.as_bytes()));
    if Some(h(content_key.data()).as_str()) != field(want, "key") { return Err("the content key the row names is not the one the agent opens".into()); }
    let decrypted = tri!(ts.decrypt_subject(&content_key));
    if !decrypted.subject().is_equivalent_to(&target.wrap()) { return Err("the decrypted subject is not the recipe's envelope".into()); }
    let nonce = subject_nonce(&ts)?;
    let rebuilt = tri!(target.wrap().encrypt_subject_opt(&content_key, Some(nonce))).add_assertion(known_values::HAS_SECRET, encrypted_key);
    if !ts.is_locked_with_ssh_agent() { return Err("is_locked_with_ssh_agent is false".into()); }
    Ok(Built::Verified { env: rebuilt, fields: vec![("key".into(), h(content_key.data())), ("unlock".into(), "ok".into())], outs: ALL_OUT })
}
/// `unlock_subject` over the in-memory agent on a locked envelope the row carries.
#[cfg(feature = "agent")]
fn agent_unlock(e: &J) -> R<Built> {
    let agent = agent_of(e)?;
    let id = s(e, "id").unwrap_or("");
    let env = tri!(Envelope::try_from_cbor_data(need!(s(e, "hex").and_then(bytes), "hex")));
    for assertion in env.assertions_with_predicate(known_values::HAS_SECRET) {
        let object = assertion.as_object().expect("an object");
        if object.is_obscured() { continue; }
        let encrypted_key = tri!(object.extract_subject::<EncryptedKey>());
        let KeyDerivationParams::SSHAgent(mut params) = tri!(KeyDerivationParams::try_from(tri!(encrypted_key.aad_cbor()))) else { continue; };
        params.set_agent(Some(agent.clone()));
        if let Ok(content_key) = KeyDerivation::unlock(&params, encrypted_key.encrypted_message(), id.as_bytes()) {
            return Ok(Built::Env(tri!(tri!(env.decrypt_subject(&content_key)).try_unwrap())));
        }
    }
    Err(bc_envelope::Error::UnknownSecret.render())
}

fn extract(env: Envelope, decoder: &str) -> R<String> {
    Ok(match decoder {
        "envelope" => format!("ok:{}", tri!(env.extract_subject::<Envelope>()).digest().hex()),
        "digest" => format!("ok:{}", tri!(env.extract_subject::<Digest>()).hex()),
        "knownValue" => { let kv = tri!(env.extract_subject::<KnownValue>()); format!("ok:{}:{}", kv.value(), kv.name()) }
        "encryptedMessage" => format!("ok:{}", tri!(env.extract_subject::<EncryptedMessage>()).aad_digest().map(|d| d.hex()).unwrap_or_default()),
        "compressed" => format!("ok:{}", tri!(env.extract_subject::<Compressed>()).digest_opt().map(|d| d.hex()).unwrap_or_default()),
        "text" => format!("ok:{}", tri!(env.extract_subject::<String>())),
        "u64" => format!("ok:{}", tri!(env.extract_subject::<u64>())),
        "i64" => format!("ok:{}", tri!(env.extract_subject::<i64>())),
        "f64" => format!("ok:{}", h(CBOR::from(tri!(env.extract_subject::<f64>())).to_cbor_data())),
        "bool" => format!("ok:{}", tri!(env.extract_subject::<bool>())),
        "null" => match tri!(env.extract_subject::<dcbor::Simple>()) {
            dcbor::Simple::Null => "ok:null".to_string(),
            _ => return Err(dcbor::Error::WrongType.render()),
        },
        "bytes" => format!("ok:{}", h(tri!(env.extract_subject::<ByteString>()).as_ref())),
        "date" => format!("ok:{}", h(CBOR::from(tri!(env.extract_subject::<Date>())).to_cbor_data())),
        "arid" => format!("ok:{}", tri!(env.extract_subject::<ARID>()).hex()),
        "passthrough" => J3.to_string(),
        other => return Err(format!("unparsable:decoder {other}")),
    })
}

fn date_hex(d: Option<Date>) -> String { d.map(|d| h(CBOR::from(d).to_cbor_data())).unwrap_or_else(|| "-".into()) }
fn fields_of(body: String, fields: &[(&str, String)]) -> String {
    let mut out = body;
    for (k, v) in fields { out.push_str(SEP); out.push_str(&format!("{k}={v}")); }
    out
}

fn run_op(e: &J) -> R<Built> {
    let target = env_of(need!(e.get("e"), "e"))?;
    let key = || key32(need!(s(e, "key"), "key"));
    let nonce = match s(e, "nonce") { Some(n) => Some(nonce12(n)?), None => None };
    let value = |v: String| Ok(Built::Value(v));
    let env_out = |r: bc_envelope::Result<Envelope>| -> R<Built> { Ok(Built::Env(tri!(r))) };
    match need!(s(e, "op"), "op") {
        "encryptSubject" => env_out(target.encrypt_subject_opt(&key()?, nonce)),
        "decryptSubject" => env_out(target.decrypt_subject(&key()?)),
        "compress" => env_out(target.compress()),
        "decompress" => env_out(target.decompress()),
        "decryptToRecipient" => env_out(target.decrypt_subject_to_recipient(&PrivateKeyBase::from_data(need!(s(e, "recipientSeed").and_then(bytes), "recipientSeed")))),
        "attachmentPayload" => env_out(target.attachment_payload()),
        "attachmentVendor" => value(format!("ok:{}", tri!(target.attachment_vendor()))),
        "attachmentConformsTo" => value(format!("ok:{}", tri!(target.attachment_conforms_to()).unwrap_or_else(|| "-".into()))),
        "validateAttachment" => { tri!(target.validate_attachment()); value("ok".into()) }
        "expectAttachment" => env_out(target.attachment_with_vendor_and_conforms_to(None, None)),
        "requestFrom" => {
            let expected = match e.get("func") { Some(f) => Some(function_of(f)?), None => None };
            let req = tri!(Request::try_from((target, expected.as_ref())));
            let body = report(&req.clone().to_envelope(), &["cbor", "digest", "flat"], None)?;
            value(fields_of(body, &[("fn", req.function().to_string()), ("note", req.note().to_string()), ("date", date_hex(req.date()))]))
        }
        "requestParams" => {
            let req = tri!(Request::try_from(target));
            let objects = req.body().objects_for_parameter(parameter_of(need!(e.get("param"), "param"))?);
            let mut out = format!("pcount={}", objects.len());
            for o in objects { out.push_str(SEP); out.push_str(&o.format_flat()); }
            value(out)
        }
        "eventFrom" => {
            let evt = tri!(Event::<String>::try_from(target));
            let body = report(&evt.clone().to_envelope(), &["cbor", "digest", "flat"], None)?;
            value(fields_of(body, &[("content", evt.content().clone()), ("note", evt.note().to_string()), ("date", date_hex(evt.date()))]))
        }
        "responseFrom" => {
            let resp = tri!(Response::try_from(target));
            let body = report(&resp.clone().to_envelope(), &["cbor", "digest", "flat"], None)?;
            value(fields_of(body, &[("id", resp.id().map(|i| i.hex()).unwrap_or_else(|| "-".into())), ("ok", resp.is_ok().to_string())]))
        }
        "roundtrip" => Ok(Built::Env(tri!(Envelope::try_from_cbor_data(target.tagged_cbor_data())))),
        "addAssertionEnvelope" => env_out(target.add_assertion_envelope_salted(env_of(need!(e.get("assertion"), "assertion"))?, e.get("salt").and_then(|x| x.as_bool()).unwrap_or(false))),
        "verify" => {
            let verifier: SigningPublicKey = match s(e, "pub") {
                Some(p) => SigningPublicKey::Ed25519(tri!(Ed25519PublicKey::from_data_ref(need!(bytes(p), "pub")))),
                None => tri!(signer(need!(s(e, "seed"), "seed"), "ed25519")?.public_key()),
            };
            env_out(target.verify(&verifier))
        }
        "position" => value(format!("ok:{}", tri!(target.position()))),
        "walkDecrypt" => Ok(Built::Env(target.walk_decrypt(&[key()?]))),
        "recipients" => value(format!("count={}", tri!(target.recipients()).len())),
        "unlock" => env_out(target.unlock_subject(need!(s(e, "secret").and_then(bytes), "secret"))),
        "sskrJoin" => env_out(Envelope::sskr_join(&[&target])),
        "unwrap" => env_out(target.try_unwrap()),
        "expectString" => value(format!("ok:{}", tri!(String::try_from(target)))),
        "expectNumber" => value(format!("ok:{}", h(CBOR::from(tri!(f64::try_from(target))).to_cbor_data()))),
        "expectDate" => value(format!("ok:{}", h(CBOR::from(tri!(Date::try_from(target))).to_cbor_data()))),
        "checkSubjectUnit" => env_out(target.check_subject_unit().map(|e| e.clone())),
        op => Err(format!("unparsable:op {op}")),
    }
}

// ---------------------------------------------------------------------------
// Rendering the outputs
// ---------------------------------------------------------------------------

fn context_opt(ctx: Option<&FormatContext>) -> FormatContextOpt<'_> {
    match ctx { Some(c) => FormatContextOpt::Custom(c), None => FormatContextOpt::Global }
}
fn report(env: &Envelope, outs: &[&str], ctx: Option<&FormatContext>) -> R<String> {
    let mut fields = Vec::new();
    for o in outs {
        fields.push(match *o {
            "cbor" => h(env.tagged_cbor_data()),
            "ur" => env.ur_string(),
            "digest" => env.digest().hex(),
            "format" => format_with(env, false, context_opt(ctx)),
            "flat" => format_with(env, true, context_opt(ctx)),
            "tree" => env.tree_format_opt(&TreeFormatOpts::default().context(context_opt(ctx))),
            "treeDigests" => env.tree_format_opt(&TreeFormatOpts::default().hide_nodes(false).digest_display(DigestDisplayFormat::Short).context(context_opt(ctx))),
            "mermaid" => env.mermaid_format(),
            "diagnostic" => env.diagnostic(),
            "diagAnn" => match ctx {
                Some(c) => env.tagged_cbor().diagnostic_opt(&DiagFormatOpts::default().annotate(true).tags(TagsStoreOpt::Custom(c.tags()))),
                None => env.diagnostic_annotated(),
            },
            "hex" => match ctx {
                Some(c) => env.tagged_cbor().hex_opt(&dcbor::HexFormatOpts::default().annotate(true).context(TagsStoreOpt::Custom(c.tags()))),
                None => env.hex(),
            },
            "hexPlain" => h(env.tagged_cbor_data()),
            "summary" => match ctx {
                Some(c) => env.summary(40, c),
                None => bc_envelope::with_format_context!(|c: &FormatContext| env.summary(40, c)),
            },
            "none" => format_with(env, false, FormatContextOpt::None),
            "flatNone" => format_with(env, true, FormatContextOpt::None),
            "treeNone" => env.tree_format_opt(&TreeFormatOpts::default().context(FormatContextOpt::None)),
            other => return Err(format!("unparsable:out {other}")),
        });
    }
    Ok(fields.join(SEP))
}

fn run(recipe: &J, want: &str) -> String {
    let outs: Vec<&str> = match recipe.get("outs").and_then(|x| x.as_array()) {
        Some(a) => a.iter().filter_map(|x| x.as_str()).collect(),
        None => return "unparsable:outs".into(),
    };
    // Verified rows read the port's artefact from the outcome.
    let mut e = recipe["e"].clone();
    if let J::Object(o) = &mut e { o.insert("__want".into(), J::String(want.to_string())); }
    match build(&e) {
        Err(outcome) => outcome,
        Ok(Built::Value(v)) => v,
        Ok(Built::Env(env)) => report(&env, &outs, None).unwrap_or_else(|x| x),
        Ok(Built::Fmt { env, ctx }) => report(&env, &outs, ctx.as_ref()).unwrap_or_else(|x| x),
        Ok(Built::Verified { env, fields, outs }) => {
            let body = match report(&env, outs, None) { Ok(b) => b, Err(x) => return x };
            let refs: Vec<(&str, String)> = fields.iter().map(|(k, v)| (k.as_str(), v.clone())).collect();
            fields_of(body, &refs)
        }
        Ok(Built::Sskr { groups, original, spec }) => {
            let shares = groups
                .iter()
                .map(|g| g.iter().map(|s| report(s, &["digest", "format"], None).unwrap_or_default()).collect::<Vec<_>>().join("\n,,,\n"))
                .collect::<Vec<_>>()
                .join("\n;;;\n");
            let gt = spec["gt"].as_u64().unwrap_or(0) as usize;
            let mut quorum: Vec<&Envelope> = Vec::new();
            for gi in 0..gt {
                let mt = spec["groups"][gi]["mt"].as_u64().unwrap_or(0) as usize;
                for s in groups[gi].iter().take(mt) { quorum.push(s); }
            }
            match Envelope::sskr_join(&quorum) {
                Ok(joined) => format!("{shares}{SEP}{}", if joined.is_equivalent_to(&original) { "joined" } else { "JOIN-MISMATCH" }),
                Err(err) => err.render(),
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Panics the port reports as typed errors
// ---------------------------------------------------------------------------

/// (recipe kind, a substring of the panic message, the TypeScript code thrown
/// at the same call). Compared by code only; a panic outside this table is a
/// MISMATCH.
const PANIC_MAPPED: &[(&str, &str, &str)] = &[
    // `add_signature_opt` unwraps the signing result: an SSH key without options
    ("sign", "namespace", "Components"),
    // `elide_*_with_action(…, Compress)` unwraps `compress()` on an obscured target
    ("elide", "AlreadyElided", "AlreadyElided"),
    ("elide", "AlreadyEncrypted", "AlreadyEncrypted"),
    // `Response::with_result` / `with_error` on the other branch, `expect_id` without an id
    ("responseOp", "Cannot set result on a failed response", "General"),
    ("responseOp", "Cannot set error on a successful response", "General"),
    ("responseOp", "Expected an ID", "General"),
    // bc-rand asserts the range order under `add_salt_in_range`
    ("salt", "lower_bound <= upper_bound", "Components"),
];
fn panic_mapped(kind: &str, text: &str) -> Option<&'static str> {
    PANIC_MAPPED.iter().find(|(k, needle, _)| *k == kind && text.contains(needle)).map(|(_, _, code)| *code)
}
/// The code of a TypeScript throw: the part before `[` or `|`.
fn ts_code(want: &str) -> Option<&str> {
    want.strip_prefix("throw:").map(|r| r.split(['[', '|']).next().unwrap_or(r))
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

enum Got { Value(String), Panic(String), Hang }
fn payload(p: Box<dyn std::any::Any + Send>) -> String {
    if let Some(s) = p.downcast_ref::<&str>() { return s.to_string(); }
    if let Some(s) = p.downcast_ref::<String>() { return s.clone(); }
    "non-string panic payload".into()
}
/// Runs one vector on its own thread so a reference loop cannot stall the run.
fn run_guarded(v: &Vector, timeout: Duration) -> Got {
    let (tx, rx) = mpsc::channel();
    let (recipe, want) = (v.recipe.clone(), v.expect.clone());
    std::thread::spawn(move || {
        let got = match catch_unwind(AssertUnwindSafe(|| run(&recipe, &want))) { Ok(s) => Got::Value(s), Err(p) => Got::Panic(payload(p)) };
        let _ = tx.send(got);
    });
    rx.recv_timeout(timeout).unwrap_or(Got::Hang)
}
fn kind_of(r: &J) -> String {
    let e = &r["e"];
    let k = e.get("k").and_then(|x| x.as_str()).unwrap_or("");
    if k == "noreg" || k == "late" { return e.get("inner").map(|i| kind_of(&serde_json::json!({ "e": i }))).unwrap_or_default(); }
    k.to_string()
}

fn main() {
    assert_eq!(usize::BITS, 64, "the reference's usize fields are compared as 64-bit integers");
    // No registry directory: the vectors never depend on the runner's home.
    known_values::set_directory_config(DirectoryConfig::new()).expect("the directory configuration is set before any access");
    let args: Vec<String> = std::env::args().collect();
    let path = args.get(1).expect("usage: envelope-validation <vectors.json> [--verbose]");
    let verbose = args.iter().any(|a| a == "--verbose") || std::env::var("VERBOSE").is_ok();
    let file: File = serde_json::from_str(&std::fs::read_to_string(path).expect("read vectors")).expect("parse vectors");
    assert_eq!(file.count, file.vectors.len(), "the file's count must equal its vectors");
    std::panic::set_hook(Box::new(|_| {}));

    let (mut ok, mut mapped, mut js_only, mut scoped, mut mismatch, mut unparsable) = (0usize, 0usize, 0usize, 0usize, 0usize, 0usize);
    let mut js_by: std::collections::BTreeMap<String, usize> = Default::default();
    let mut registered = false;
    let cut = |x: &str| if verbose { x.to_string() } else { x.chars().take(200).collect::<String>() };
    let report_mismatch = |name: &str, detail: String| eprintln!("MISMATCH {name}\n  {detail}");

    for v in &file.vectors {
        let is_noreg = v.recipe["e"].get("k").and_then(|x| x.as_str()) == Some("noreg");
        if is_noreg && registered {
            mismatch += 1;
            report_mismatch(&v.name, "a noreg row after the first registered row; the file must list noreg rows first".into());
            continue;
        }
        if !is_noreg && !registered { bc_envelope::register_tags(); registered = true; }
        let kind = kind_of(&v.recipe);
        let want = v.expect.as_str();
        match run_guarded(v, Duration::from_secs(300)) {
            Got::Value(got) => {
                if got == want { ok += 1; continue; }
                if let Some(class) = got.strip_prefix("js-only:") { js_only += 1; *js_by.entry(class.to_string()).or_default() += 1; continue; }
                if got.starts_with("build-scoped:") { scoped += 1; continue; }
                if let Some(what) = got.strip_prefix("unparsable:") { unparsable += 1; eprintln!("UNPARSABLE {} ({what})", v.name); continue; }
                let (g, w): (Vec<&str>, Vec<&str>) = (got.split(SEP).collect(), want.split(SEP).collect());
                let field = (0..g.len().max(w.len())).find(|&i| g.get(i) != w.get(i)).unwrap_or(0);
                mismatch += 1;
                report_mismatch(&v.name, format!("[field {field}/{}]\n  rust: {}\n  ts:   {}", w.len(), cut(g.get(field).unwrap_or(&"")), cut(w.get(field).unwrap_or(&""))));
            }
            Got::Panic(text) => match panic_mapped(&kind, &text) {
                Some(code) if ts_code(want) == Some(code) => mapped += 1,
                Some(code) => { mismatch += 1; report_mismatch(&v.name, format!("reference panicked ({}) mapped to {code}\n  ts: {}", cut(&text), cut(want))) }
                None => { mismatch += 1; report_mismatch(&v.name, format!("unhandled reference panic: {}\n  ts: {}", cut(&text), cut(want))) }
            },
            Got::Hang => { mismatch += 1; report_mismatch(&v.name, format!("reference did not return within 300s\n  ts: {}", cut(want))) }
        }
    }
    let js_detail: Vec<String> = js_by.iter().map(|(k, n)| format!("{k} {n}")).collect();
    let build = if cfg!(feature = "agent") { " [agent]" } else { "" };
    println!(
        "{} vectors - {ok} match, {mapped} panic-mapped, {js_only} js-only ({}), {scoped} build-scoped, {unparsable} unparsable, {mismatch} MISMATCH{build}",
        file.vectors.len(), js_detail.join(", ")
    );
    std::process::exit(if mismatch == 0 && unparsable == 0 { 0 } else { 1 });
}
