//! Replays tests/vectors/vectors.json through bc-envelope 0.43.0.
//!
//! The recipe language mirrors tests/vectors/recipes.ts; the outputs are
//! joined with the same separator so the strings compare directly.
use std::collections::HashSet;

use bc_components::{
    ARID, Decrypter, Digest, KeyDerivationMethod, Nonce, PrivateKeyBase, SSKRGroupSpec, SSKRSpec,
    SigningPrivateKey, SymmetricKey, URI, UUID,
};
use bc_envelope::prelude::*;
use bc_envelope::Assertion;
use bc_rand::SeededRandomNumberGenerator;
use dcbor::CBORCase;
use serde_json::Value as J;

const SEP: &str = "\n---\n";

fn bytes(h: &str) -> Vec<u8> {
    hex::decode(h).unwrap()
}
fn arr32(h: &str) -> [u8; 32] {
    bytes(h).try_into().unwrap()
}
fn seeded(seed: &J) -> SeededRandomNumberGenerator {
    let s: Vec<u64> = seed.as_array().unwrap().iter().map(|x| x.as_str().unwrap().parse().unwrap()).collect();
    SeededRandomNumberGenerator::new([s[0], s[1], s[2], s[3]])
}

fn leaf_cbor(l: &J) -> CBOR {
    match l["t"].as_str().unwrap() {
        "text" => CBOR::from(l["v"].as_str().unwrap()),
        "int" => {
            let s = l["v"].as_str().unwrap();
            if let Ok(v) = s.parse::<i64>() {
                CBOR::from(v)
            } else if let Ok(v) = s.parse::<u64>() {
                CBOR::from(v)
            } else {
                // Beyond i64: a CBOR negative integer holds -1 - n for n up to 2^64 - 1.
                let v: i128 = s.parse().unwrap();
                CBOR::from(CBORCase::Negative((-1 - v) as u64))
            }
        }
        "bytes" => CBOR::to_byte_string(bytes(l["hex"].as_str().unwrap())),
        "bool" => CBOR::from(l["v"].as_bool().unwrap()),
        "null" => CBOR::null(),
        "float" => CBOR::from(l["v"].as_f64().unwrap()),
        "array" => CBOR::from(l["items"].as_array().unwrap().iter().map(leaf_cbor).collect::<Vec<_>>()),
        "map" => {
            let mut m = Map::new();
            for e in l["entries"].as_array().unwrap() {
                m.insert(leaf_cbor(&e[0]), leaf_cbor(&e[1]));
            }
            CBOR::from(m)
        }
        "arid" => ARID::from_data(arr32(l["hex"].as_str().unwrap())).into(),
        "digest" => Digest::from_data(arr32(l["hex"].as_str().unwrap())).into(),
        "uuid" => UUID::from_data(bytes(l["hex"].as_str().unwrap()).try_into().unwrap()).into(),
        "uri" => URI::new(l["v"].as_str().unwrap()).unwrap().into(),
        "kv" => KnownValue::new(l["v"].as_u64().unwrap()).into(),
        "date" => Date::from_timestamp(l["ms"].as_f64().unwrap() / 1000.0).into(),
        t => panic!("leaf {t}"),
    }
}

fn nonce_of(e: &J) -> Option<Nonce> {
    e["nonce"].as_str().map(|h| Nonce::from_data(bytes(h).try_into().unwrap()))
}

fn signer(seed: &str, scheme: &str) -> SigningPrivateKey {
    let base = PrivateKeyBase::from_data(bytes(seed));
    match scheme {
        "ed25519" => base.ed25519_signing_private_key(),
        "ecdsa" => base.ecdsa_signing_private_key(),
        _ => base.schnorr_signing_private_key(),
    }
}

enum Built {
    Env(Envelope),
    Sskr { groups: Vec<Vec<Envelope>>, original: Envelope, spec: J },
}

fn build(e: &J) -> Result<Built, String> {
    Ok(Built::Env(build_env(e)?))
}

fn env_of(b: Built) -> Envelope {
    match b {
        Built::Env(e) => e,
        Built::Sskr { .. } => panic!("sskr result used as envelope"),
    }
}

fn build_env(e: &J) -> Result<Envelope, String> {
    let k = e["k"].as_str().unwrap();
    let sub = |key: &str| -> Result<Envelope, String> { build_env(&e[key]) };
    let r: Result<Envelope, String> = match k {
        "leaf" => {
            let l = &e["v"];
            match l["t"].as_str().unwrap() {
                "null" => Ok(Envelope::null()),
                "kv" => Ok(Envelope::new(KnownValue::new(l["v"].as_u64().unwrap()))),
                _ => Ok(Envelope::new(leaf_cbor(l))),
            }
        }
        "kv" => Ok(Envelope::new(KnownValue::new(e["v"].as_u64().unwrap()))),
        "node" => {
            let mut env = sub("subject")?;
            for a in e["assertions"].as_array().unwrap() {
                let assertion = Envelope::new_assertion(build_env(&a[0])?, build_env(&a[1])?);
                env = env.add_assertion_envelope(assertion).map_err(|x| format!("{x:?}"))?;
            }
            Ok(env)
        }
        "wrap" => Ok(sub("e")?.wrap()),
        "assertion" => Ok(Envelope::new_assertion(sub("pred")?, sub("obj")?)),
        "elide" => {
            let env = sub("e")?;
            let set = |key: &str| -> Result<HashSet<Digest>, String> {
                let mut s = HashSet::new();
                if let Some(list) = e[key].as_array() {
                    for x in list {
                        s.insert(build_env(x)?.digest());
                    }
                }
                Ok(s)
            };
            let action = match &e["action"] {
                J::String(s) if s == "compress" => ObscureAction::Compress,
                J::Object(o) => ObscureAction::Encrypt(SymmetricKey::from_data(arr32(o["encrypt"].as_str().unwrap()))),
                _ => ObscureAction::Elide,
            };
            if e.get("revealing").is_some() {
                Ok(env.elide_revealing_set_with_action(&set("revealing")?, &action))
            } else {
                Ok(env.elide_removing_set_with_action(&set("removing")?, &action))
            }
        }
        "encrypt" => {
            let env = sub("e")?;
            let key = SymmetricKey::from_data(arr32(e["key"].as_str().unwrap()));
            // W6: a fixed nonce (`encrypt` = `wrap` + `encrypt_subject`, so the same option applies).
            let nonce = nonce_of(e);
            let target = if e["subject"].as_bool().unwrap_or(false) { env } else { env.wrap() };
            target.encrypt_subject_opt(&key, nonce).map_err(|x| format!("{x:?}"))
        }
        "compress" => {
            let env = sub("e")?;
            if e["subject"].as_bool().unwrap_or(false) {
                env.compress_subject().map_err(|x| format!("{x:?}"))
            } else {
                env.compress().map_err(|x| format!("{x:?}"))
            }
        }
        "sign" => {
            let env = sub("e")?;
            let s = signer(e["seed"].as_str().unwrap(), e["scheme"].as_str().unwrap());
            if let Some(note) = e.get("note").and_then(|n| n.as_str()) {
                let md = SignatureMetadata::new().add_assertion(Assertion::new(known_values::NOTE, note));
                Ok(env.wrap().add_signature_opt(&s, None, Some(md)))
            } else {
                Ok(env.sign(&s))
            }
        }
        "salt" => {
            let env = sub("e")?;
            let mut rng = seeded(&e["rng"]);
            if let Some(range) = e.get("range").and_then(|r| r.as_array()) {
                let (min, max) = (range[0].as_u64().unwrap() as usize, range[1].as_u64().unwrap() as usize);
                env.add_salt_in_range_using(&(min..=max), &mut rng).map_err(|x| format!("{x:?}"))
            } else {
                match e.get("len").and_then(|l| l.as_u64()) {
                    Some(len) => env.add_salt_with_len_using(len as usize, &mut rng).map_err(|x| format!("{x:?}")),
                    None => Ok(env.add_salt_using(&mut rng)),
                }
            }
        }
        "attach" => {
            let env = sub("e")?;
            let payload = sub("payload")?;
            Ok(env.add_attachment(payload, e["vendor"].as_str().unwrap(), e["conformsTo"].as_str()))
        }
        "type" => Ok(sub("e")?.add_type(sub("type")?)),
        "position" => {
            let mut env = sub("e")?;
            env.set_position(e["pos"].as_u64().unwrap() as usize).map_err(|x| format!("{x:?}"))
        }
        "request" => {
            let id = ARID::from_data(arr32(e["id"].as_str().unwrap()));
            let mut req = match &e["func"] {
                J::String(s) => Request::new(Function::new_named(s.as_str()), id),
                J::Number(n) => Request::new(Function::new_known(n.as_u64().unwrap(), None), id),
                _ => panic!("func"),
            };
            for p in e["params"].as_array().unwrap() {
                let param = match &p[0] {
                    J::String(s) => Parameter::new_named(s.as_str()),
                    J::Number(n) => Parameter::new_known(n.as_u64().unwrap(), None),
                    _ => panic!("param"),
                };
                req = req.with_parameter(param, build_env(&p[1])?);
            }
            if let Some(note) = e.get("note").and_then(|n| n.as_str()) {
                req = req.with_note(note);
            }
            if let Some(ms) = e.get("date").and_then(|d| d.as_f64()) {
                req = req.with_date(Date::from_timestamp(ms / 1000.0));
            }
            Ok(req.to_envelope())
        }
        "response" => {
            let id = ARID::from_data(arr32(e["id"].as_str().unwrap()));
            if e.get("result").is_some() {
                Ok(Response::new_success(id).with_result(sub("result")?).to_envelope())
            } else {
                let err: Envelope = if e.get("error").is_some() { sub("error")? } else { Envelope::new("error") };
                Ok(Response::new_failure(id).with_error(err).to_envelope())
            }
        }
        "recipient" => {
            let env = sub("e")?;
            let key = SymmetricKey::from_data(arr32(e["key"].as_str().unwrap()));
            let base = PrivateKeyBase::from_data(bytes(e["recipientSeed"].as_str().unwrap()));
            let recipient = base.encapsulation_private_key().public_key().map_err(|x| format!("{x:?}"))?;
            Ok(env.encrypt_subject(&key).map_err(|x| format!("{x:?}"))?.add_recipient(&recipient, &key))
        }
        "lock" => {
            let env = sub("e")?;
            let method = match e["method"].as_str().unwrap() {
                "hkdf" => KeyDerivationMethod::HKDF,
                "pbkdf2" => KeyDerivationMethod::PBKDF2,
                "scrypt" => KeyDerivationMethod::Scrypt,
                _ => KeyDerivationMethod::Argon2id,
            };
            env.lock(method, bytes(e["secret"].as_str().unwrap())).map_err(|x| format!("{x:?}"))
        }
        "decode" => Envelope::try_from_cbor_data(bytes(e["hex"].as_str().unwrap())).map_err(|x| format!("{x:?}")),
        "ur" => Envelope::from_ur_string(e["s"].as_str().unwrap()).map_err(|x| format!("{x:?}")),
        "sskr" => Err("sskr handled by build_sskr".into()),
        // ---- follow-up Phase 1 (V1) ----
        "nodeEnv" => {
            let mut env = sub("subject")?;
            for a in e["assertions"].as_array().unwrap() {
                env = env.add_assertion_envelope(build_env(a)?).map_err(|x| format!("{x:?}"))?;
            }
            Ok(env)
        }
        "recipientDecode" => {
            let env = Envelope::from_ur_string(e["ur"].as_str().unwrap()).map_err(|x| format!("{x:?}"))?;
            let base = PrivateKeyBase::from_data(bytes(e["recipientSeed"].as_str().unwrap()));
            env.decrypt_subject_to_recipient(&base).map_err(|x| format!("{x:?}"))
        }
        "op" => {
            let env = sub("e")?;
            let key = || SymmetricKey::from_data(arr32(e["key"].as_str().unwrap()));
            let r: Result<Envelope, bc_envelope::Error> = match e["op"].as_str().unwrap() {
                "encryptSubject" => env.encrypt_subject_opt(&key(), nonce_of(e)),
                "decryptSubject" => env.decrypt_subject(&key()),
                "compress" => env.compress(),
                "decompress" => env.decompress(),
                "decryptToRecipient" => env.decrypt_subject_to_recipient(&PrivateKeyBase::from_data(bytes(e["recipientSeed"].as_str().unwrap()))),
                "attachmentPayload" => env.attachment_payload(),
                "expectAttachment" => env.attachment_with_vendor_and_conforms_to(None, None),
                "requestFrom" => {
                    let f = match &e["func"] { J::String(s) => Function::new_named(s.as_str()), J::Number(n) => Function::new_known(n.as_u64().unwrap(), None), _ => panic!("func") };
                    Request::try_from((env, Some(&f))).map(|r| r.to_envelope())
                }
                "roundtrip" => Envelope::try_from_cbor_data(env.tagged_cbor_data()).map_err(bc_envelope::Error::from),
                "addAssertionEnvelope" => env.add_assertion_envelope_salted(sub("assertion")?, e["salt"].as_bool().unwrap_or(false)),
                "verify" => env.verify(&signer(e["seed"].as_str().unwrap(), "ed25519").public_key().unwrap()),
                op => panic!("unhandled op {op}"),
            };
            r.map_err(|x| format!("{x:?}"))
        }
        "domain" => Err("js-only".into()),
        k => panic!("unhandled {k}"),
    };
    r
}

fn build_sskr(e: &J) -> Result<Built, String> {
    let env = build_env(&e["e"])?;
    let key = SymmetricKey::from_data(arr32(e["key"].as_str().unwrap()));
    let spec = &e["spec"];
    let groups: Vec<SSKRGroupSpec> = spec["groups"]
        .as_array()
        .unwrap()
        .iter()
        .map(|g| SSKRGroupSpec::new(g["mt"].as_u64().unwrap() as usize, g["mc"].as_u64().unwrap() as usize).unwrap())
        .collect();
    let sskr_spec = SSKRSpec::new(spec["gt"].as_u64().unwrap() as usize, groups).unwrap();
    let mut rng = seeded(&e["rng"]);
    let encrypted = env.encrypt_subject(&key).map_err(|x| format!("{x:?}"))?;
    let shares = encrypted.sskr_split_using(&sskr_spec, &key, &mut rng).map_err(|x| format!("{x:?}"))?;
    Ok(Built::Sskr { groups: shares, original: env, spec: spec.clone() })
}

fn report(env: &Envelope, outs: &[&str]) -> String {
    outs.iter()
        .map(|o| match *o {
            "cbor" => hex::encode(env.tagged_cbor_data()),
            "ur" => env.ur_string(),
            "digest" => env.digest().hex(),
            "format" => env.format(),
            "flat" => env.format_flat(),
            "tree" => env.tree_format(),
            "treeDigests" => env.tree_format_opt(&TreeFormatOpts::default().hide_nodes(false).digest_display(DigestDisplayFormat::Short)),
            "mermaid" => env.mermaid_format(),
            "diagnostic" => env.diagnostic(),
            "hex" => env.hex(),
            "summary" => bc_envelope::with_format_context!(|ctx: &FormatContext| env.summary(40, ctx)),
            _ => "?".to_string(),
        })
        .collect::<Vec<_>>()
        .join(SEP)
}

fn run(recipe: &J) -> Result<String, String> {
    let e = &recipe["e"];
    let outs: Vec<&str> = recipe["outs"].as_array().unwrap().iter().map(|x| x.as_str().unwrap()).collect();
    if e["k"] == "sskr" {
        let Built::Sskr { groups, original, spec } = build_sskr(e)? else { unreachable!() };
        let shares = groups
            .iter()
            .map(|g| g.iter().map(|s| report(s, &["digest", "format"])).collect::<Vec<_>>().join("\n,,,\n"))
            .collect::<Vec<_>>()
            .join("\n;;;\n");
        let gt = spec["gt"].as_u64().unwrap() as usize;
        let mut quorum: Vec<&Envelope> = Vec::new();
        for gi in 0..gt {
            let mt = spec["groups"][gi]["mt"].as_u64().unwrap() as usize;
            for s in groups[gi].iter().take(mt) {
                quorum.push(s);
            }
        }
        let joined = Envelope::sskr_join(&quorum).map_err(|x| format!("{x:?}"))?;
        return Ok(format!("{shares}{SEP}{}", if joined.is_equivalent_to(&original) { "joined" } else { "JOIN-MISMATCH" }));
    }
    let env = env_of(build(e)?);
    Ok(report(&env, &outs))
}

/// Expected divergences (see RUST_DIVERGENCES.md):
/// D1  compressed bytes differ (pako vs miniz_oxide; components D3): byte-level
///     outputs differ, everything else matches.
/// D2  the TypeScript registry names codepoints the reference's format context
///     does not (e.g. 706 'Self'): `'Name'` vs `'706'` in the format strings.
/// D3  summaries truncate by characters in TypeScript and by bytes in the
///     reference, so a non-ASCII text leaf may be cut differently.
/// E1  both reject, different error taxonomies.
fn expected_divergence(recipe: &J, got: &[&str], want: &[&str], outs: &[&str]) -> Option<&'static str> {
    // E1: both reject and the port reports a foreign class (dcbor's `CborError`, a UR error) or the
    // reference's dcbor / components wrapper: a message-level difference with no code to compare.
    // Since follow-up Phase 1 an `op` row must match by code, so it never lands here.
    if got.len() == 1 && want.len() == 1 && got[0].starts_with("throw:") && want[0].starts_with("throw:") && recipe["e"]["k"] != "op" && recipe["e"]["k"] != "recipientDecode" {
        return Some("E1");
    }
    if got.len() != want.len() {
        return None;
    }
    let text = serde_json::to_string(&recipe["e"]).unwrap();
    let byte_level = ["cbor", "ur", "diagnostic", "hex"];
    let mut classes: Vec<&'static str> = Vec::new();
    for (o, (g, w)) in outs.iter().zip(got.iter().zip(want.iter())) {
        if g == w {
            continue;
        }
        if byte_level.contains(o) && text.contains("\"compress\"") {
            classes.push("D1");
        } else if g.contains('\u{2026}') && !w.is_ascii() && !w.contains('\u{2026}') {
            classes.push("D3");
        } else if *o == "diagnostic" && !w.is_ascii() && g.split_whitespace().collect::<String>() == w.split_whitespace().collect::<String>() {
            // the diagnostic line-breaking threshold counts bytes in the reference
            classes.push("D3");
        } else if g.contains('\'') && w.contains('\'') && !g.is_empty() {
            // D2: exactly the two constants the reference declares but never registers
            // (`VALUE` 25, `SELF` 706 — known-values D4): TypeScript prints their names,
            // the reference their codepoints. Any other name difference is a mismatch.
            if w.replace("'value'", "'25'").replace("'Self'", "'706'") == *g {
                classes.push("D2");
            } else {
                if std::env::var("DEBUG_CLASS").is_ok() {
                    eprintln!("unclassified field {o}:\n  rust: {}\n  ts:   {}", g.chars().take(300).collect::<String>(), w.chars().take(300).collect::<String>());
                }
                return None;
            }
        } else {
            if std::env::var("DEBUG_CLASS").is_ok() {
                eprintln!("unclassified field {o}:\n  rust: {}\n  ts:   {}", g.chars().take(300).collect::<String>(), w.chars().take(300).collect::<String>());
            }
            return None;
        }
    }
    classes.sort();
    classes.dedup();
    Some(match classes.as_slice() {
        ["D1"] => "D1",
        ["D2"] => "D2",
        ["D3"] => "D3",
        _ => "mixed",
    })
}

/// The port's adapter reports an `EnvelopeError` code in SCREAMING_SNAKE_CASE (`ALREADY_ENCRYPTED`,
/// `CBOR`); the reference's variant name converts to the same spelling, acronyms included.
fn screaming(name: &str) -> String {
    let mut out = String::new();
    let chars: Vec<char> = name.chars().collect();
    for (i, c) in chars.iter().enumerate() {
        if c.is_uppercase() && i > 0 {
            let prev = chars[i - 1];
            let next_lower = chars.get(i + 1).map_or(false, |n| n.is_lowercase());
            if prev.is_lowercase() || prev.is_ascii_digit() || (prev.is_uppercase() && next_lower) {
                out.push('_');
            }
        }
        out.push(c.to_ascii_uppercase());
    }
    out
}

/// Pending divergences: port outcomes a plan wave is about to change. Empty since the envelope
/// follow-up's Phase 3 landed (P-B1/B2/B3/B4/B6/B7/B11/B17 all closed); a future plan adds its
/// classes here and deletes them as they land.
fn pending(_recipe: &J, _got: &str, _want: &str) -> Option<&'static str> {
    None
}

fn main() {
    bc_envelope::register_tags();
    let path = std::env::args().nth(1).expect("path");
    let verbose = std::env::var("VERBOSE").is_ok();
    let file: J = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
    let vectors = file["vectors"].as_array().unwrap();
    assert_eq!(file["count"].as_u64().unwrap() as usize, vectors.len());
    let (mut ok, mut expected, mut js_only, mut mismatch) = (0, 0, 0, 0);
    let mut by_class = std::collections::BTreeMap::new();
    for v in vectors {
        let got = match run(&v["recipe"]) {
            Ok(s) => s,
            Err(e) if e == "js-only" => { js_only += 1; continue; }
            Err(e) => format!("throw:{}", screaming(e.split(['(', ' ']).next().unwrap_or("Error"))),
        };
        let want = v["expect"].as_str().unwrap();
        if got == want {
            ok += 1;
            continue;
        }
        if let Some(class) = pending(&v["recipe"], &got, want) {
            expected += 1;
            *by_class.entry(class).or_insert(0) += 1;
            if verbose { println!("expected-divergence [{class}] {} | rust={} | ts={}", v["name"], got.chars().take(60).collect::<String>(), want.chars().take(60).collect::<String>()); }
            continue;
        }
        let outs: Vec<&str> = v["recipe"]["outs"].as_array().unwrap().iter().map(|x| x.as_str().unwrap()).collect();
        let g: Vec<&str> = got.split(SEP).collect();
        let w: Vec<&str> = want.split(SEP).collect();
        if let Some(class) = expected_divergence(&v["recipe"], &g, &w, &outs) {
            expected += 1;
            *by_class.entry(class).or_insert(0) += 1;
            if verbose {
                println!("expected-divergence [{class}] {}", v["name"]);
            }
            continue;
        }
        mismatch += 1;
        let field = (0..g.len().max(w.len())).find(|&i| g.get(i) != w.get(i)).unwrap_or(0);
        let cut = |s: &str| s.chars().take(if verbose { 4000 } else { 160 }).collect::<String>();
        eprintln!(
            "MISMATCH {} [field {}/{} = {}]\n  rust: {}\n  ts:   {}",
            v["name"],
            field,
            w.len(),
            outs.get(field).unwrap_or(&"?"),
            cut(g.get(field).unwrap_or(&"")),
            cut(w.get(field).unwrap_or(&""))
        );
    }
    for (c, n) in by_class {
        println!("expected-divergence [{c}] x{n}");
    }
    println!("{} vectors - {ok} match, {expected} expected-divergence, {js_only} js-only, {mismatch} MISMATCH", vectors.len());
    std::process::exit(if mismatch == 0 { 0 } else { 1 });
}
