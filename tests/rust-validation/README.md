# Rust reference cross-validation

Replays vector files against the `bc-envelope` reference: the published
`bc-envelope` 0.43.0 crate from crates.io (sources `bc-envelope-rust`
commit `bae6880`) over the published `bc-components` 0.31.1, `bc-crypto`
0.14.0, `dcbor` 0.25.2, `known-values` 0.15.5, `bc-ur` 0.19.2, `sskr`
0.12.0 and `ssh-key` 0.6.7. Nothing is patched. The toolchain is pinned
(`rust-toolchain.toml`: 1.98.1, Unicode 17.0.0, the tables the `Debug`
escaping of a function mismatch message depends on). Two builds: the
default one, and `--features agent`, which turns on the `ssh-agent` feature
of bc-envelope and bc-components and compares the SSH-agent lock and unlock
rows.

```sh
cd tests/rust-validation
cargo run --release --offline -- ../vectors/vectors.json                    # the golden file
bun run vectors:full                                                          # writes target/corpus.json
cargo run --release --offline -- target/corpus.json                          # the whole corpus
cargo run --release --offline --features agent -- ../vectors/vectors.json    # the ssh-agent build
cargo run --release --offline --features agent -- target/corpus.json
```

Result lines on 2026-09-15:

```
572 vectors - 518 match, 7 panic-mapped, 36 js-only (J1 12, J2 14, J3 7, J4 3), 11 build-scoped, 0 unparsable, 0 MISMATCH
577 vectors - 523 match, 7 panic-mapped, 36 js-only (J1 12, J2 14, J3 7, J4 3), 11 build-scoped, 0 unparsable, 0 MISMATCH
572 vectors - 529 match, 7 panic-mapped, 36 js-only (J1 12, J2 14, J3 7, J4 3), 0 build-scoped, 0 unparsable, 0 MISMATCH [agent]
577 vectors - 534 match, 7 panic-mapped, 36 js-only (J1 12, J2 14, J3 7, J4 3), 0 build-scoped, 0 unparsable, 0 MISMATCH [agent]
```

The full corpus has five rows the golden file leaves out (`isReproducible`
in `tests/corpus/corpus.ts`): an ML-DSA signature draws fresh randomness
and components draws the nonce of a locked key itself, so their bytes
change run to run; the reference verifies them on every full-corpus run
instead.

## What is compared

Every recipe yields one outcome string on each side and the two are
compared textually. The TypeScript outcome is the vector's `expect`
(`scripts/generate-vectors.ts` materialises it with the working tree, error
messages included); the reference's is computed by `src/main.rs`. The
recipe language is `tests/vectors/recipes.ts`; the adapter over the working
tree is `tests/vectors/working-tree-adapter.ts`.

- The outputs a recipe selects (`outs`: tagged CBOR, UR, digest, the
  notation, flat, tree, mermaid, diagnostic, annotated hex and summary
  renderings, and the `"none"`-context and custom-context renderings of
  `fmt` rows) are joined with `\n---\n`.
- A rejection is `throw:<code>[<inner code>]|<message>`: the reference's
  error variant (`UnexpectedResponseID` spelled `UnexpectedResponseId`,
  `SSKR` `Sskr`), the variant it wraps for `Cbor`, `Components` and `Sskr`,
  and its Display. A decoder entry point (`Envelope.fromBytes`, `fromCbor`,
  `Expression.fromEnvelope`, …) returns the dcbor error itself in the
  reference, so its row reads `throw:Cbor[<dcbor variant>]|<dcbor message>`
  with no prefix; an internal site that converts a dcbor error into the
  reference's own `Error::Cbor` reads `dcbor error: <message>`. A bc-ur
  error is its variant with `UR` printed as `Decoder`.
- `ur` rows run the port's `decodeURWith(UR.parse(s), Envelope.codec)` in
  the reference's three steps: the UR grammar, the type check (flattened
  into `dcbor::Error::Custom`, as `from_ur` flattens it), the decoder.
- Rows whose artefact the reference cannot reproduce are verified rather
  than reproduced: the reference opens the port's sealed message with the
  recipient key (`recipient` rows with a fixed nonce and generator, `seal`
  rows, ML-KEM recipients, whose keys the row carries), unlocks the port's
  encrypted key and checks its parameters are the reference's (`lock` rows
  with a fixed salt), verifies the port's ML-DSA signature with the public
  key the row carries, then rebuilds the envelope around the artefact and
  compares every output.
- `agentLock` and `agentUnlock` (the `agent` build) run the reference's
  SSH-agent key derivation over an in-memory agent built from the row's
  seeds (the reference's test agent: identities by comment,
  `test_namespace`, SHA-256): the reference locks a key of its own through
  the same parameters, checks the port's parameters equal them, opens the
  port's key through the agent, decrypts the subject and rebuilds the
  envelope; `agentUnlock` opens a locked envelope the reference produced
  (`examples/dump_agent_lock.rs`). The default build reports these rows
  `build-scoped`.
- `extract` rows replay `extract_subject::<T>()` for every case and type;
  `pred`, `position`, the `requestFrom`/`eventFrom`/`responseFrom`
  operations, the attachment and salt errors, `sskrJoinRaw` and the
  `responseOp` panics compare the reference's accept set, codes and texts.
- The harness pins the known-values directory configuration first
  (`set_directory_config(DirectoryConfig::new())`), as the test setup file
  and the generator pin the port's, so no row reads the runner's home
  directory. The `noreg` rows come first in the file and run before
  `bc_envelope::register_tags()` (the generator and the golden suite do the
  same); the `late` rows come last and register a known value and a tag
  after the global format context exists.
- Where the reference panics (an SSH signing key without options, the
  `Compress` elision action on an obscured target, `Response::with_result`
  on a failure, `expect_id` without an id, an inverted salt range) the port
  throws a typed error at the same call: `PANIC_MAPPED` in `src/main.rs`
  names the code and the row is `panic-mapped`, compared by code only.
- `domain` rows are the JavaScript input domain (`js-only`), in four
  classes: J1 a non-integer number, J2 a negative or out-of-range number,
  J3 a value the reference's types cannot express, J4 a reference surface
  the port reaches differently (the synchronous SSH-agent lock, the
  crate-private node constructor).
- Integers are read exactly; a recipe field this program cannot read is
  `unparsable`. An unhandled panic, or any other difference, is a MISMATCH.
  Both make the process exit 1.

## Rows that guard the sibling packages

Every behaviour the envelope inherits from a sibling package has a row
whose outcome flips if that package changes it:

| Sibling behaviour | Rows |
|---|---|
| dcbor keeps a leading U+FEFF and displays text as encoded | `decode:d8c8d8c964efbbbf61`, `leaf:text:é` (NFD) |
| dcbor rejects whole-float heads and non-canonical numerics | `decode:d8c8d8c9fb40000000000000`, `decode:d8c8d8c9fa4f000000` |
| dcbor float rendering and byte-string previews | `leaf:float:0.1`, `leaf:float:1e300`, `leaf:bytes:f09f9880`, the `fmt` rows for `0.1` and `h'f09f9880'` |
| dcbor dates: `1(NaN)`, sub-millisecond and far-past dates | `decode:d8c8d8c9c1f97e00`, `extract date`, the `requestFrom`/`eventFrom` date rows |
| dcbor names tags in `WrongTag` messages | `decode:d8c9d8c965416c696365`, `op requestFrom(…d99c476166…)` |
| known-values: the reference seed, the negative wrap, the summariser | `kv:706`, `kv:25:value`, the `fmt` rows for `40000(-1)`, `40000("a")`, `40000(25)`, `noreg` rows |
| components: miniz compression bytes | `compress(…)` rows, `op decompress(leaf:cbor:…)` |
| components: raw SSKR shares | `sskrJoinRaw` rows |
| components: SSH and ML-DSA signing, ML-KEM and low-order X25519 recipients, the SSH-agent derivation | `sign:ssh-ed25519`, `sign:mldsa44`, `recipient:mlkem512`, `recipient:lowOrder`, `agentLock`/`agentUnlock` rows (agent build, where `EncryptedKey(SSHAgent("alice"))` renders), the `fmt` row for the SSH certificate text form |
| bc-ur error codes and texts | `ur:ur:envelope/aeae`, `ur:ur:digest/…` |
| sskr accepts a 0-of-N group spec | `sskr:1/0of3` |
| bc-rand draws any length (a 70000-byte salt) | `salt:70000`, and `tests/salt.test.ts` for the secure generator |

## Self-checks

`mismatch.json` holds one row with its last digest digit flipped; the run
must exit 1 with `1 MISMATCH`. `fixtures/classes.json` holds one row per
class and must count them as `1 match, 1 panic-mapped, 4 js-only (J1 1, J2
1, J3 1, J4 1), 1 build-scoped`; `fixtures/malformed.json` has a position
this program cannot read (`1 unparsable`); `fixtures/noreg-order.json` puts
a `noreg` row after a registered one; `fixtures/panic-code.json` maps a
panic to the wrong port code. The last three must exit 1.

## CI

The `rust-validation` job in `.github/workflows/ci.yml` points `HOME` at an
empty directory, checks the golden file against the working tree
(`bun run test:golden`), materialises the full corpus, builds the harness
against the pinned crates and toolchain (`cargo run --locked --offline`
after `cargo fetch --locked`), runs the golden file and the corpus in both
builds, then the mismatch fixture and the class fixtures. The `locale` job
runs the golden suite under `LC_ALL=da_DK.UTF-8`, where a locale-dependent
sort would reorder node assertions. A MISMATCH anywhere fails the job.

## Maintenance

When the reference moves: update the pins in `Cargo.toml`, run
`cargo update -p bc-envelope`, check the toolchain pin, regenerate the
vectors (`bun run vectors:generate`), regenerate the agent fixture if the
key derivation changed (`cargo run --release --offline --features agent
--example dump_agent_lock`, then `AGENT_LOCKED_HEX` in
`tests/corpus/corpus.ts`), run the four replays and copy the result lines
above. A new difference is a bug on one side: fix it, or add the js-only
class or the panic mapping with its reason in `src/main.rs` and here.
