/**
 * Deterministic corpus: hand-built envelopes covering every case
 * and extension (the shapes the Rust test suite uses), generated trees
 * over a small vocabulary with the extensions applied on a stride, and
 * the rows that pin every accept-set boundary, error text and format
 * rendering against the reference: decode rejections, typed subject
 * extraction, expression decoding, salt and attachment errors, the
 * registration state of the global format context, and the JavaScript
 * input domain.
 */
import type { E, Leaf, Recipe, Seed } from "../vectors/recipes";

const KEY = "0f6a5c0e6d1b7a2d4e3c9b8a7f6e5d4c3b2a19081716151413121110090807aa";
const KEY2 = "f0e1d2c3b4a5968778695a4b3c2d1e0f0011223344556677889900aabbccddee";
const KEY7 = "07".repeat(32);
const SEED_A = "59f2293a5bce7d4de59e71b4207ac5d2b5c6bfbf4e4a3d2b1f0e9d8c7b6a5948";
const SEED_B = "ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00";
const SEED_C = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
const ARID_1 = "c66be27dbad7cd095ca77647406d07976dc0f35f0d4d654bb0e96dd227a1e9fc";
const ARID_2 = "1111111111111111111111111111111111111111111111111111111111111111";
const ARID_7 = "07".repeat(32);
const RNG_1: Seed = [
  "17295166580085024720",
  "422929670265678780",
  "5577237070365765850",
  "7953171132032326923",
];
const RNG_2: Seed = ["1", "1", "1", "1"];
const NONCE_A = "0b".repeat(12);
const NONCE_B = "0c".repeat(12);
const SALT_16 = "101112131415161718191a1b1c1d1e1f";
const PASSWORD = "70617373776f7264";
/** The order-8 X25519 point: an agreement with it is not contributory. */
const LOW_ORDER_POINT = "e0eb7a7c3b41b8ae1656e3faf19fc46ada098deb9c32b1fd866205165f49b800";

const text = (v: string): E => ({ k: "leaf", v: { t: "text", v } });
const int = (v: number | string): E => ({ k: "leaf", v: { t: "int", v: String(v) } });
const float = (v: number): E => ({ k: "leaf", v: { t: "float", v } });
const bool = (v: boolean): E => ({ k: "leaf", v: { t: "bool", v } });
const nul: E = { k: "leaf", v: { t: "null" } };
const raw = (hex: string): E => ({ k: "leaf", v: { t: "cbor", hex } });
const kv = (v: number, name?: string): E =>
  name === undefined ? { k: "kv", v } : { k: "kv", v, name };
const node = (subject: E, assertions: [E, E][]): E => ({ k: "node", subject, assertions });
const wrap = (e: E): E => ({ k: "wrap", e });
const assertion = (pred: E, obj: E): E => ({ k: "assertion", pred, obj });
const date = (ms: number): E => ({ k: "leaf", v: { t: "date", ms } });
const encryptedOf = (e: E, key = KEY7): E => ({
  k: "encrypt",
  e,
  key,
  subject: true,
  nonce: NONCE_A,
});
const compressedOf = (e: E): E => ({ k: "compress", e });
const elidedOf = (e: E): E => ({ k: "elide", e, removing: [e] });
const op = (
  o: Extract<E, { k: "op" }>["op"],
  e: E,
  rest: Partial<Extract<E, { k: "op" }>> = {},
): E => ({
  k: "op",
  op: o,
  e,
  ...rest,
});

// Known-value codepoints used as predicates in hand-built shapes.
const SIGNED = 3;
const NOTE = 4;
const HAS_RECIPIENT = 5;
const DATE = 16;
const HAS_SECRET = 19;
const POSITION = 23;
const ATTACHMENT = 50;
const VENDOR = 51;
const CONFORMS_TO = 52;
const BODY = 100;
const RESULT = 101;
const ERROR = 102;
const CONTENT = 108;

// Tagged subjects and leaves, as dCBOR hex.
const REQ_7 = "d99c44d99c4c5820" + ARID_7; // 40004(ARID 07…)
const EVT_7 = "d99c5ad99c4c5820" + ARID_7; // 40026(ARID 07…)
const RESP_7 = "d99c45d99c4c5820" + ARID_7; // 40005(ARID 07…)
const FN_F = "d99c466166"; // 40006("f")
const FN_2_60 = "d99c461b1000000000000000"; // 40006(2^60)
const FN_U64_MAX = "d99c461bffffffffffffffff"; // 40006(2^64 - 1)
const FN_NEG = "d99c4620"; // 40006(-1)
const FN_FLOAT = "d99c46f93e00"; // 40006(1.5)
const FN_BYTES = "d99c464100"; // 40006(h'00')
const PARAM_2_53_1 = "d99c471b0020000000000001"; // 40007(2^53 + 1)
const PARAM_2_60 = "d99c471b1000000000000000"; // 40007(2^60)
const PARAM_NEG = "d99c4720"; // 40007(-1)
const DATE_SUBMS = "c1fb3ff000001ad7f29b"; // 1(1.0000001)
const DATE_MICRO = "c1fb41d96285e007e6b4"; // 1(1703548800.123456)
const DATE_NAN = "c1f97e00"; // 1(NaN)
const DATE_FAR_PAST = "c13b000007948cf211ff"; // 1(-8334601228800.5) as dcbor rewrites it
const DATE_LEAP = "c1fb41d96285e0200000"; // 1(1703548800.5): 2023-12-25T23:59:60.5Z

/** The base envelopes: one per leaf shape, plus the classic structures. */
export const LEAVES: Leaf[] = [
  { t: "text", v: "Hello." },
  { t: "text", v: "" },
  { t: "text", v: "Alice" },
  { t: "text", v: 'quote " and \\ backslash' },
  { t: "text", v: "unicode ✓ ☺ 日本" },
  // NFD: "e" + U+0301, kept as given on both sides
  { t: "text", v: "é" },
  { t: "int", v: "0" },
  { t: "int", v: "42" },
  { t: "int", v: "-1" },
  { t: "int", v: "23" },
  { t: "int", v: "256" },
  { t: "int", v: "9007199254740991" },
  { t: "int", v: "18446744073709551615" },
  { t: "int", v: "-18446744073709551616" },
  { t: "bytes", hex: "" },
  { t: "bytes", hex: "0102030405" },
  { t: "bytes", hex: "00".repeat(40) },
  // an astral character's UTF-8 as bytes
  { t: "bytes", hex: "f09f9880" },
  { t: "bool", v: true },
  { t: "bool", v: false },
  { t: "null" },
  { t: "float", v: 1.5 },
  { t: "float", v: -0.001 },
  // a float that ties at the last binary digit of its shortest rendering
  { t: "float", v: 0.1 },
  { t: "float", v: 1e300 },
  {
    t: "array",
    items: [
      { t: "int", v: "1" },
      { t: "text", v: "two" },
      { t: "bool", v: true },
    ],
  },
  { t: "array", items: [] },
  {
    t: "map",
    entries: [
      [
        { t: "int", v: "1" },
        { t: "text", v: "one" },
      ],
      [
        { t: "text", v: "b" },
        { t: "int", v: "2" },
      ],
    ],
  },
  { t: "arid", hex: ARID_1 },
  { t: "digest", hex: "2be2d79b306a21ff8e3e6bd3d1c2c6c74ff4a693b1e7ba3a0f40cdfb9ea493f8" },
  { t: "uuid", hex: "6ea4a9d6b9be4b7f9d5d1a2b3c4d5e6f" },
  { t: "uri", v: "https://example.com/path?q=1" },
  { t: "kv", v: 1 },
  // raw dCBOR leaves: a sub-millisecond date, NaN, a bignum, a mis-tagged known value
  { t: "cbor", hex: DATE_SUBMS },
  { t: "cbor", hex: DATE_NAN },
  { t: "cbor", hex: DATE_LEAP },
  { t: "cbor", hex: "c24101" },
  { t: "cbor", hex: "d99c406161" },
];

const alice = node(text("Alice"), [[text("knows"), text("Bob")]]);
const aliceMore = node(text("Alice"), [
  [text("knows"), text("Bob")],
  [text("knows"), text("Carol")],
  [kv(1), text("Person")],
  [kv(4), text("A note")],
]);
const nested = node(text("Alice"), [
  [text("knows"), node(text("Bob"), [[text("knows"), text("Carol")]])],
  [text("age"), int(30)],
]);
const deep = node(wrap(aliceMore), [[text("meta"), node(int(1), [[int(2), int(3)]])]]);

export const HAND: E[] = [
  ...LEAVES.map((v): E => ({ k: "leaf", v })),
  kv(1),
  kv(0),
  kv(706),
  kv(100000),
  // a known value with an in-memory name: the global context prints its own name
  kv(9999, "custom"),
  // VALUE (25): declared, not registered; the reference prints its own name in memory
  kv(25, "value"),
  alice,
  aliceMore,
  nested,
  deep,
  wrap(alice),
  wrap(wrap(text("x"))),
  // node assertions sort by digest bytes: 337 before 1 under every locale
  node(text("s"), [
    [text("k"), int(337)],
    [text("k"), int(1)],
  ]),
  // format items sort by code point: U+FF61 before U+1F600
  node(text("s"), [
    [text("p"), text("\u{FF61}")],
    [text("p"), text("\u{1F600}")],
  ]),
  node(text("s"), [
    [text("\u{FF61}"), int(1)],
    [text("\u{1F600}"), int(1)],
  ]),
  { k: "assertion", pred: text("knows"), obj: text("Bob") },
  { k: "assertion", pred: kv(1), obj: kv(2) },
  node({ k: "assertion", pred: text("p"), obj: text("o") }, [[text("q"), text("r")]]),
  { k: "elide", e: aliceMore, removing: [text("Bob")] },
  {
    k: "elide",
    e: aliceMore,
    removing: [{ k: "assertion", pred: text("knows"), obj: text("Bob") }],
  },
  { k: "elide", e: aliceMore, revealing: [aliceMore, text("Alice")] },
  { k: "elide", e: aliceMore, removing: [text("Alice")] },
  { k: "elide", e: nested, removing: [text("Carol")], action: "compress" },
  { k: "elide", e: nested, removing: [text("Carol")], action: { encrypt: KEY } },
  { k: "elide", e: alice, removing: [] },
  { k: "encrypt", e: aliceMore, key: KEY, subject: true },
  { k: "encrypt", e: aliceMore, key: KEY },
  { k: "encrypt", e: text("Hello."), key: KEY },
  { k: "compress", e: aliceMore, subject: true },
  { k: "compress", e: aliceMore },
  { k: "compress", e: text("Lorem ipsum dolor sit amet, ".repeat(8)) },
  { k: "sign", e: aliceMore, seed: SEED_A, scheme: "ed25519" },
  { k: "sign", e: aliceMore, seed: SEED_A, scheme: "ecdsa" },
  { k: "sign", e: aliceMore, seed: SEED_A, scheme: "schnorr" },
  { k: "sign", e: aliceMore, seed: SEED_A, scheme: "schnorr", rng: RNG_1 },
  { k: "sign", e: aliceMore, seed: SEED_B, scheme: "ed25519", note: "Signed by B" },
  { k: "sign", e: wrap(aliceMore), seed: SEED_A, scheme: "ed25519" },
  {
    k: "sign",
    e: { k: "sign", e: aliceMore, seed: SEED_A, scheme: "ed25519" },
    seed: SEED_B,
    scheme: "ecdsa",
  },
  // SSH signing: deterministic with options; without them the reference's `unwrap` panics
  {
    k: "sign",
    e: aliceMore,
    seed: SEED_A,
    scheme: "ssh-ed25519",
    comment: "alice",
    ssh: { namespace: "file", hashAlg: "sha256" },
  },
  { k: "sign", e: aliceMore, seed: SEED_A, scheme: "ssh-ed25519", comment: "alice" },
  // ML-DSA signs with fresh randomness: the reference verifies the port's signature
  { k: "sign", e: aliceMore, seed: SEED_A, scheme: "mldsa44", rng: RNG_1 },
  { k: "salt", e: aliceMore, rng: RNG_1 },
  { k: "salt", e: text("x"), rng: RNG_2, len: 16 },
  { k: "salt", e: alice, rng: RNG_1, len: 8 },
  // Seeded salt *lengths*: the reference samples a `RangeInclusive<usize>`.
  { k: "salt", e: text("x"), rng: RNG_1, range: [8, 16] },
  { k: "salt", e: text("x"), rng: RNG_2, range: [9, 9] },
  { k: "salt", e: aliceMore, rng: RNG_2, range: [8, 1000] },
  { k: "salt", e: text("x"), rng: RNG_1, len: 70000 },
  { k: "salt", e: text("x"), rng: RNG_2 },
  { k: "salt", e: nested, rng: RNG_2 },
  { k: "salt", e: deep, rng: RNG_1 },
  // salt errors: lengths below 8 are the components error; an inverted range panics in the reference
  { k: "salt", e: text("x"), rng: RNG_1, len: 7 },
  { k: "salt", e: text("x"), rng: RNG_1, len: 0 },
  { k: "salt", e: text("x"), rng: RNG_1, range: [7, 10] },
  { k: "salt", e: text("x"), rng: RNG_1, range: [7, 5] },
  { k: "salt", e: text("x"), rng: RNG_1, range: [10, 9] },
  {
    k: "sskr",
    e: text("secret"),
    key: KEY,
    spec: { gt: 1, groups: [{ mt: 2, mc: 3 }] },
    rng: RNG_1,
  },
  {
    k: "sskr",
    e: text("secret"),
    key: KEY2,
    spec: {
      gt: 2,
      groups: [
        { mt: 2, mc: 3 },
        { mt: 3, mc: 5 },
      ],
    },
    rng: RNG_2,
  },
  // a 0-of-3 group: the sskr failure is wrapped as `Sskr`
  {
    k: "sskr",
    e: text("secret"),
    key: KEY,
    spec: { gt: 1, groups: [{ mt: 0, mc: 3 }] },
    rng: RNG_1,
  },
  {
    k: "attach",
    e: aliceMore,
    payload: text("payload"),
    vendor: "com.example",
    conformsTo: "https://example.com/attachment/v1",
  },
  {
    k: "attach",
    e: text("x"),
    payload: node(text("p"), [[text("q"), int(1)]]),
    vendor: "org.test",
  },
  { k: "attach", e: text("x"), payload: text("p"), vendor: "" },
  { k: "type", e: aliceMore, type: kv(1) },
  { k: "type", e: text("x"), type: text("Thing") },
  { k: "position", e: aliceMore, pos: "3" },
  { k: "position", e: text("x"), pos: "0" },
  { k: "position", e: text("x"), pos: "1152921504606846976" },
  { k: "position", e: text("x"), pos: "9007199254740993" },
  { k: "position", e: text("x"), pos: "18446744073709551615" },
  {
    k: "request",
    func: "add",
    id: ARID_1,
    params: [
      ["lhs", int(2)],
      ["rhs", int(3)],
    ],
  },
  {
    k: "request",
    func: 100,
    id: ARID_2,
    params: [["x", text("y")]],
    note: "a note",
    date: 1657512000000,
  },
  {
    // well-known function and parameters print by name («add», ❰lhs❱)
    k: "request",
    func: 1,
    id: ARID_1,
    params: [
      [2, int(2)],
      [3, int(3)],
    ],
  },
  // empty names are ordinary named functions and parameters
  { k: "request", func: "", id: ARID_1, params: [["", int(1)]] },
  { k: "response", id: ARID_1, result: int(5) },
  { k: "response", id: ARID_2, error: text("failed") },
  { k: "recipient", e: aliceMore, key: KEY, recipientSeed: SEED_B },
  { k: "recipient", e: aliceMore, key: KEY, recipientSeed: SEED_B, scheme: "mlkem512" },
  {
    k: "recipient",
    e: text("Hello."),
    key: KEY7,
    recipientSeed: LOW_ORDER_POINT,
    scheme: "lowOrder",
  },
  { k: "lock", e: aliceMore, secret: PASSWORD, method: "hkdf" },
  { k: "lock", e: text("x"), secret: PASSWORD, method: "pbkdf2" },
  { k: "seal", e: aliceMore, seed: SEED_A, recipientSeed: SEED_B },
  // decode: real envelopes and malformed input
  { k: "decode", hex: "d8c8d8c96648656c6c6f2e" }, // "Hello."
  { k: "decode", hex: "d8c882d8c965416c696365a1d8c9656b6e6f7773d8c963426f62" }, // Alice knows Bob
  {
    k: "decode",
    hex: "d8c885d8c965416c696365a104d8c96641206e6f7465a1d8c9656b6e6f7773d8c9654361726f6ca101d8c966506572736f6ea1d8c9656b6e6f7773d8c963426f62",
  }, // Alice with four assertions
  { k: "decode", hex: "d8c801" }, // known value 1
  { k: "decode", hex: "d8c8d8c882d8c965416c696365a1d8c9656b6e6f7773d8c963426f62" }, // wrapped
  { k: "decode", hex: "d8c8a1d8c9656b6e6f7773d8c963426f62" }, // bare assertion
  {
    k: "decode",
    hex: "d8c885d8c965416c696365a104d8c96641206e6f7465a1d8c9656b6e6f7773d8c9654361726f6ca101d8c966506572736f6ea1d8c9656b6e6f7773582013b741949c37b8e09cc3daa3194c58e4fd6b2f14d4b1d0f035a46d6d5a1d3f11",
  }, // with an elided assertion
  {
    k: "decode",
    hex: "d8c882d8c885d8c965416c696365a104d8c96641206e6f7465a1d8c9656b6e6f7773d8c9654361726f6ca101d8c966506572736f6ea1d8c9656b6e6f7773d8c963426f62a103d8c9d99c5482025840b03805c649bbe7d6f35d5b2bcab2e5fcb16c310d6321efc2047be8cdf9c79678727ee9b787a6a6c11b14009253fd2f8e81d3e251103dcb3762f3b14ec0418605",
  }, // signed (ed25519)
  {
    k: "decode",
    hex: "d8c8d99c43841a3bea90931841583cbb71a2f5c6c954c79ccce4d4852c374ea6392ae4e597a42ebc7132353b2fbfbcf8c6c954e7c4a2fc9c858c374ea605a41615e7e721c9253be5270100d99c415820ab2344e45ad4c8dfc9e86a73bf7c91c56999e49980671f0f2a30b31be4f3a563",
  }, // compressed
  { k: "decode", hex: "d8c8d8c9f6" }, // null leaf
  { k: "decode", hex: "d8c8d8c964efbbbf61" }, // a text leaf starting with U+FEFF, kept
  { k: "decode", hex: "d8c8d8c9" + DATE_NAN }, // 1(NaN)
  { k: "decode", hex: "d8c8d8c9c24101" }, // a bignum leaf
  { k: "decode", hex: "d8c8d8c9d99c406161" }, // a mis-tagged known value inside a leaf
  { k: "ur", s: "ur:envelope/tpsoiyfdihjzjzjldmksbaoede" },
  {
    k: "ur",
    s: "ur:envelope/lptpsoihfpjziniaihoyaatpsoiyfpcxjtjljyihoytpsoihjejtjlktjktpsoihfxhsjpjljzoyadtpsoiygdihjpjkjljtoytpsoihjejtjlktjktpsoiafwjlidbepdecjk",
  },
  {
    k: "ur",
    s: "ur:envelope/lptpsoihfpjziniaihoyaatpsoiyfpcxjtjljyihoytpsoihjejtjlktjktpsoihfxhsjpjljzoyadtpsoiygdihjpjkjljtoytpsoihjejtjlktjkhdcxbwrlfpmwnsemrovtnssrtnotcfgshdvezcjedlbbtypatiwtecoxjnjnhtcafhbyrhcaglwl",
  },
];

/** Every decode rejection, compared by error variant and message. */
export const DECODE_ERRORS: E[] = [
  { k: "decode", hex: "d8c8a2d8c96161d8c96162d8c96163d8c96164" }, // assertion map with two keys
  { k: "decode", hex: "d8c8581f" + "00".repeat(31) }, // elided digest of the wrong length
  { k: "decode", hex: "d8c9d8c965416c696365" }, // wrong outer tag
  { k: "decode", hex: "d8c880" }, // node with no elements
  { k: "decode", hex: "d8c881d8c965416c696365" }, // node with a subject only
  { k: "decode", hex: "d8c8d8c965416c69" }, // truncated
  { k: "decode", hex: "d8c8d8c9616100" }, // a trailing byte
  { k: "decode", hex: "d8c8f6" }, // null inside tag 200 (not a leaf)
  { k: "decode", hex: "d8c820" }, // a negative integer inside tag 200
  { k: "decode", hex: "d8c8f93e00" }, // a float inside tag 200
  { k: "decode", hex: "d8c86161" }, // text inside tag 200
  { k: "decode", hex: "01" }, // untagged
  { k: "decode", hex: "d8c8d99c4001" }, // tag 40000 inside the envelope
  { k: "decode", hex: "d8c8d99c4101" }, // tag 40001 inside the envelope
  { k: "decode", hex: "d8c882d8c96161d8c96162" }, // a node element that is not an assertion
  { k: "decode", hex: "d8c8d8c882d8c96161d8c96162" }, // the same, wrapped
  { k: "decode", hex: "d8c8a1f6f6" }, // an assertion whose key fails to decode
  { k: "decode", hex: "d8c8a1d8c96161f6" }, // an assertion whose value fails to decode
  { k: "decode", hex: "d8c8a1a1f6f6f6" }, // nested: the key is an assertion whose key fails
  { k: "decode", hex: "d8c8a1d8c96161" }, // a truncated map
  {
    k: "decode",
    hex: "d8c8d99c42834100" + "4c" + "00".repeat(12) + "50" + "00".repeat(16),
  }, // encrypted without AAD
  { k: "decode", hex: "d8c8d99c4383000040" }, // compressed without a digest
  { k: "decode", hex: "d8c8d8c9fa4f000000" }, // a non-canonical float inside a leaf
  { k: "decode", hex: "d8c8d8c9fb4000000000000000" }, // a whole float head (2.0) inside a leaf
  { k: "decode", hex: "d8c8d8c96180" }, // invalid UTF-8 text
];

/** `fmt`: renderings of decoded leaves through the summarisers and the three contexts. */
export const FMT: E[] = [
  { k: "fmt", hex: "d8c8d8c9d99c4020" }, // 40000(-1): wraps to 2^64 - 1
  { k: "fmt", hex: "d8c8d8c9d99c406161" }, // 40000("a"): a summariser error
  { k: "fmt", hex: "d8c8d8c9d99c40f93e00" }, // 40000(1.5)
  { k: "fmt", hex: "d8c8d8c9d99c401819" }, // 40000(25): VALUE, unregistered
  { k: "fmt", hex: "d8c8d8c9d99c4001" }, // 40000(1): isA
  { k: "fmt", hex: "d8c8d8c9" + FN_2_60 },
  { k: "fmt", hex: "d8c8d8c9" + FN_U64_MAX },
  { k: "fmt", hex: "d8c8d8c9" + FN_NEG },
  { k: "fmt", hex: "d8c8d8c9" + FN_FLOAT },
  { k: "fmt", hex: "d8c8d8c9" + FN_BYTES },
  { k: "fmt", hex: "d8c8d8c9d99c4601" }, // 40006(1): add
  { k: "fmt", hex: "d8c8d8c9d99c4605" }, // 40006(5): the constant NEG is not seeded
  { k: "fmt", hex: "d8c8d8c9" + PARAM_2_60 },
  { k: "fmt", hex: "d8c8d8c9" + PARAM_NEG },
  { k: "fmt", hex: "d8c8d8c9d99c4702" }, // 40007(2): lhs
  { k: "fmt", hex: "d8c8d8c9" + REQ_7 }, // 40004(ARID)
  { k: "fmt", hex: "d8c8d8c9" + RESP_7 },
  { k: "fmt", hex: "d8c8d8c9" + EVT_7 },
  { k: "fmt", hex: "d8c8d8c9d99c44d8c883d8c96173a1d8c9616b190151a1d8c9616b01" }, // 40004(envelope)
  { k: "fmt", hex: "d8c8d8c9d99c44d99c4019270f" }, // 40004(40000(9999))
  { k: "fmt", hex: "d8c8d8c9" + DATE_NAN },
  { k: "fmt", hex: "d8c8d8c9" + DATE_SUBMS },
  { k: "fmt", hex: "d8c8d8c9c24101" }, // 2(h'01')
  { k: "fmt", hex: "d8c8d8c9c34101" }, // 3(h'01')
  { k: "fmt", hex: "d8c8d8c9fb3fb999999999999a" }, // 0.1
  { k: "fmt", hex: "d8c8d8c944f09f9880" }, // h'f09f9880'
  {
    k: "fmt",
    hex: "d8c8d8c9d99f6378257373682d656432353531392d636572742d763031406f70656e7373682e636f6d2041414141",
  }, // 40803(text): the SSH certificate text form
  // a custom context: an empty tags store and one known value, with and without the envelope summarisers
  {
    k: "fmt",
    hex: "d8c8d8c9d99c44d99c4019270f",
    context: { knownValues: [[9999, "custom"]], register: true },
  },
  {
    k: "fmt",
    hex: "d8c8d8c9d99c44d99c4019270f",
    context: { knownValues: [[9999, "custom"]] },
  },
  {
    k: "fmt",
    hex: "d8c8d8c9d99c4019270f",
    context: { knownValues: [[9999, "custom"]], register: true },
  },
  {
    k: "fmt",
    hex: "d8c8d8c9d99c44d8c883d8c96173a1d8c9616b190151a1d8c9616b01",
    context: { register: true },
  },
];

/** Typed subject extraction on every case. */
export const EXTRACT: E[] = [
  { k: "extract", e: wrap(text("a")), decoder: "envelope" },
  { k: "extract", e: wrap(text("a")), decoder: "text" },
  { k: "extract", e: elidedOf(text("a")), decoder: "digest" },
  { k: "extract", e: elidedOf(text("a")), decoder: "bytes" },
  { k: "extract", e: kv(9999, "custom"), decoder: "knownValue" },
  { k: "extract", e: kv(9999, "custom"), decoder: "u64" },
  { k: "extract", e: kv(9999, "custom"), decoder: "passthrough" },
  { k: "extract", e: encryptedOf(text("a")), decoder: "encryptedMessage" },
  { k: "extract", e: encryptedOf(text("a")), decoder: "text" },
  { k: "extract", e: compressedOf(text("a")), decoder: "compressed" },
  { k: "extract", e: compressedOf(text("a")), decoder: "text" },
  { k: "extract", e: assertion(text("p"), text("o")), decoder: "text" },
  { k: "extract", e: assertion(text("p"), text("o")), decoder: "envelope" },
  { k: "extract", e: assertion(text("p"), text("o")), decoder: "passthrough" },
  { k: "extract", e: raw("d99c4001"), decoder: "knownValue" },
  { k: "extract", e: node(kv(1), [[text("p"), text("o")]]), decoder: "knownValue" },
  { k: "extract", e: node(text("s"), [[text("p"), text("o")]]), decoder: "text" },
  { k: "extract", e: node(int(7), [[text("p"), text("o")]]), decoder: "f64" },
  { k: "extract", e: int("9007199254740992"), decoder: "f64" },
  { k: "extract", e: int("9007199254740993"), decoder: "f64" },
  { k: "extract", e: int("18446744073709551614"), decoder: "f64" },
  { k: "extract", e: int("18446744073709551615"), decoder: "f64" },
  { k: "extract", e: int("-9007199254740993"), decoder: "f64" },
  { k: "extract", e: int("-9007199254740994"), decoder: "f64" },
  { k: "extract", e: int("-18446744073709551616"), decoder: "f64" },
  { k: "extract", e: float(1.5), decoder: "f64" },
  { k: "extract", e: text("a"), decoder: "f64" },
  { k: "extract", e: int("18446744073709551615"), decoder: "u64" },
  { k: "extract", e: int("-1"), decoder: "u64" },
  { k: "extract", e: int("-1"), decoder: "i64" },
  { k: "extract", e: int("-18446744073709551616"), decoder: "i64" },
  { k: "extract", e: bool(true), decoder: "bool" },
  { k: "extract", e: nul, decoder: "null" },
  { k: "extract", e: text("a"), decoder: "null" },
  { k: "extract", e: raw(DATE_SUBMS), decoder: "date" },
  { k: "extract", e: raw(DATE_NAN), decoder: "date" },
  { k: "extract", e: int(5), decoder: "date" },
  { k: "extract", e: { k: "leaf", v: { t: "arid", hex: ARID_1 } }, decoder: "arid" },
  { k: "extract", e: text("a"), decoder: "arid" },
  { k: "extract", e: { k: "leaf", v: { t: "bytes", hex: "0102" } }, decoder: "bytes" },
];

/** `f64::try_from(Envelope)`, `String::try_from`, `Date::try_from`: leaf-only extraction. */
export const EXPECT: E[] = [
  op("expectNumber", int("9007199254740992")),
  op("expectNumber", int("9007199254740993")),
  op("expectNumber", int("18446744073709551614")),
  op("expectNumber", int("18446744073709551615")),
  op("expectNumber", int("-9007199254740993")),
  op("expectNumber", int("-9007199254740994")),
  op("expectNumber", int("-18446744073709551616")),
  op("expectNumber", float(1.5)),
  op("expectNumber", text("a")),
  op("expectNumber", node(int(7), [[text("p"), text("o")]])),
  op("expectNumber", wrap(int(7))),
  op("expectString", text("a")),
  op("expectString", int(7)),
  op("expectString", node(text("s"), [[text("p"), text("o")]])),
  op("expectString", wrap(text("a"))),
  op("expectString", kv(1)),
  op("unwrap", wrap(text("a"))),
  op("unwrap", text("a")),
  op("checkSubjectUnit", node(kv(0), [[text("p"), text("o")]])),
  op("checkSubjectUnit", text("a")),
];

/** Boolean queries on non-leaf shapes. */
export const PREDICATES: E[] = [
  { k: "pred", e: node(bool(true), [[text("p"), text("o")]]), pred: "isTrue" },
  { k: "pred", e: node(bool(false), [[text("p"), text("o")]]), pred: "isFalse" },
  { k: "pred", e: node(bool(true), [[text("p"), text("o")]]), pred: "isBool" },
  { k: "pred", e: node(nul, [[text("p"), text("o")]]), pred: "isNull" },
  { k: "pred", e: node(int(1), [[text("p"), text("o")]]), pred: "isNumber" },
  { k: "pred", e: node(int(1), [[text("p"), text("o")]]), pred: "isSubjectNumber" },
  { k: "pred", e: node(kv(0), [[text("p"), text("o")]]), pred: "isSubjectUnit" },
  { k: "pred", e: wrap(bool(true)), pred: "isTrue" },
  { k: "pred", e: wrap(nul), pred: "isNull" },
  { k: "pred", e: bool(true), pred: "isTrue" },
  { k: "pred", e: text("true"), pred: "isTrue" },
  { k: "pred", e: raw("f97e00"), pred: "isNaN" },
  { k: "pred", e: node(raw("f97e00"), [[text("p"), text("o")]]), pred: "isNaN" },
  { k: "pred", e: kv(0), pred: "isSubjectUnit" },
  { k: "pred", e: kv(1), pred: "isSubjectUnit" },
];

/** `position()` on hand-built `'position'` objects. */
export const POSITION_READS: E[] = [
  op("position", node(text("x"), [[kv(POSITION), int("1152921504606846976")]])),
  op("position", node(text("x"), [[kv(POSITION), int("9007199254740993")]])),
  op("position", node(text("x"), [[kv(POSITION), int("-1")]])),
  op("position", node(text("x"), [[kv(POSITION), float(1.5)]])),
  op("position", node(text("x"), [[kv(POSITION), text("3")]])),
  op("position", node(text("x"), [[kv(POSITION), node(int(3), [[text("p"), text("o")]])]])),
  op("position", node(text("x"), [[kv(POSITION), wrap(int(3))]])),
  op("position", text("x")),
  op(
    "position",
    node(text("x"), [
      [kv(POSITION), int(1)],
      [kv(POSITION), int(2)],
    ]),
  ),
  { k: "position", e: node(text("x"), [[kv(POSITION), int(1)]]), pos: "2" },
  {
    k: "position",
    e: node(text("x"), [
      [kv(POSITION), int(1)],
      [kv(POSITION), int(2)],
    ]),
    pos: "3",
  },
];

const reqSubject = raw(REQ_7);
const evtSubject = raw(EVT_7);
const respSubject = raw(RESP_7);
const bodyF = raw(FN_F);
/** Request, event and response decoding on hand-built shapes. */
export const EXPRESSIONS: E[] = [
  op("requestFrom", node(reqSubject, [[kv(BODY), bodyF]])),
  op("requestFrom", node(reqSubject, [[kv(BODY), bodyF]]), { func: "f" }),
  op("requestFrom", node(reqSubject, [[kv(BODY), bodyF]]), { func: "g" }),
  op("requestFrom", node(reqSubject, [[kv(BODY), bodyF]]), { func: 1 }),
  op("requestFrom", node(reqSubject, [[kv(BODY), bodyF]]), { func: "$ADD" }),
  op("requestFrom", node(reqSubject, [[kv(BODY), raw("d99c4601")]]), { func: "$ADD" }),
  op("requestFrom", node(reqSubject, [[kv(BODY), raw("d99c4601")]]), { func: 1 }),
  op("requestFrom", node(reqSubject, [[kv(BODY), raw("d99c4601")]]), { func: 2 }),
  op("requestFrom", node(reqSubject, [[kv(BODY), raw("d99c46655c22e28099")]]), { func: "g" }), // a name with a quote and a non-ASCII char
  op("requestFrom", node(reqSubject, [[kv(BODY), kv(1)]])),
  op("requestFrom", node(reqSubject, [[kv(BODY), raw(FN_NEG)]])),
  op("requestFrom", node(reqSubject, [[kv(BODY), raw(FN_FLOAT)]])),
  op("requestFrom", node(reqSubject, [[kv(BODY), raw(FN_BYTES)]])),
  op("requestFrom", node(reqSubject, [[kv(BODY), raw("d99c476166")]])), // a parameter where a function belongs
  op("requestFrom", node(reqSubject, [[kv(BODY), raw(FN_2_60)]])),
  op("requestFrom", node(reqSubject, [[kv(BODY), raw(FN_U64_MAX)]])),
  op("requestFrom", node(reqSubject, [[kv(BODY), wrap(bodyF)]])),
  op("requestFrom", node(reqSubject, [[kv(BODY), node(bodyF, [[raw(PARAM_2_53_1), int(5)]])]])),
  op("requestParams", node(reqSubject, [[kv(BODY), node(bodyF, [[raw(PARAM_2_53_1), int(5)]])]]), {
    param: "#9007199254740993",
  }),
  op(
    "requestParams",
    node(reqSubject, [
      [
        kv(BODY),
        node(bodyF, [
          [raw("d99c476161"), int(1)],
          [raw("d99c476161"), int(2)],
          [text("meta"), int(3)],
        ]),
      ],
    ]),
    { param: "a" },
  ),
  op("requestParams", node(reqSubject, [[kv(BODY), node(bodyF, [[raw("d99c4707"), int(1)]])]]), {
    param: "7",
  }),
  op("requestParams", node(reqSubject, [[kv(BODY), node(bodyF, [[raw("d99c4707"), int(1)]])]]), {
    param: 7,
  }),
  op(
    "requestFrom",
    node(reqSubject, [
      [kv(BODY), bodyF],
      [kv(NOTE), text("hi")],
    ]),
  ),
  op(
    "requestFrom",
    node(reqSubject, [
      [kv(BODY), bodyF],
      [kv(NOTE), node(text("hi"), [[text("k"), int(1)]])],
    ]),
  ),
  op(
    "requestFrom",
    node(reqSubject, [
      [kv(BODY), bodyF],
      [kv(NOTE), wrap(text("hi"))],
    ]),
  ),
  op(
    "requestFrom",
    node(reqSubject, [
      [kv(BODY), bodyF],
      [kv(NOTE), int(1)],
    ]),
  ),
  op(
    "requestFrom",
    node(reqSubject, [
      [kv(BODY), bodyF],
      [kv(DATE), int(5)],
    ]),
  ),
  op(
    "requestFrom",
    node(reqSubject, [
      [kv(BODY), bodyF],
      [kv(DATE), wrap(raw(DATE_SUBMS))],
    ]),
  ),
  op(
    "requestFrom",
    node(reqSubject, [
      [kv(BODY), bodyF],
      [kv(DATE), node(raw(DATE_SUBMS), [[text("k"), int(1)]])],
    ]),
  ),
  op(
    "requestFrom",
    node(reqSubject, [
      [kv(BODY), bodyF],
      [kv(DATE), raw(DATE_SUBMS)],
    ]),
  ),
  op(
    "requestFrom",
    node(reqSubject, [
      [kv(BODY), bodyF],
      [kv(DATE), raw(DATE_MICRO)],
    ]),
  ),
  op(
    "requestFrom",
    node(reqSubject, [
      [kv(BODY), bodyF],
      [kv(DATE), raw(DATE_NAN)],
    ]),
  ),
  op(
    "requestFrom",
    node(reqSubject, [
      [kv(BODY), bodyF],
      [kv(DATE), raw(DATE_FAR_PAST)],
    ]),
  ),
  op(
    "requestFrom",
    node(reqSubject, [
      [kv(BODY), bodyF],
      [kv(DATE), raw(DATE_LEAP)],
    ]),
  ),
  op("requestFrom", node(text("x"), [[kv(BODY), bodyF]])),
  op("requestFrom", node(raw(RESP_7), [[kv(BODY), bodyF]])),
  op("requestFrom", node(wrap(reqSubject), [[kv(BODY), bodyF]])),
  op("requestFrom", node(reqSubject, [[text("p"), text("o")]])),
  op(
    "requestFrom",
    node(reqSubject, [
      [kv(BODY), bodyF],
      [kv(BODY), raw("d99c466167")],
    ]),
  ),
  op("eventFrom", node(evtSubject, [[kv(CONTENT), text("c")]])),
  op(
    "eventFrom",
    node(evtSubject, [
      [kv(CONTENT), text("c")],
      [kv(NOTE), text("hi")],
    ]),
  ),
  op(
    "eventFrom",
    node(evtSubject, [
      [kv(CONTENT), text("c")],
      [kv(NOTE), node(text("hi"), [[text("k"), int(1)]])],
    ]),
  ),
  op(
    "eventFrom",
    node(evtSubject, [
      [kv(CONTENT), text("c")],
      [kv(NOTE), int(1)],
    ]),
  ),
  op(
    "eventFrom",
    node(evtSubject, [
      [kv(CONTENT), text("c")],
      [kv(DATE), raw(DATE_SUBMS)],
    ]),
  ),
  op(
    "eventFrom",
    node(evtSubject, [
      [kv(CONTENT), text("c")],
      [kv(DATE), raw(DATE_MICRO)],
    ]),
  ),
  op(
    "eventFrom",
    node(evtSubject, [
      [kv(CONTENT), text("c")],
      [kv(DATE), raw(DATE_NAN)],
    ]),
  ),
  op(
    "eventFrom",
    node(evtSubject, [
      [kv(CONTENT), text("c")],
      [kv(DATE), raw(DATE_FAR_PAST)],
    ]),
  ),
  op(
    "eventFrom",
    node(evtSubject, [
      [kv(CONTENT), text("c")],
      [kv(DATE), int(5)],
    ]),
  ),
  op("eventFrom", node(evtSubject, [[kv(CONTENT), int(1)]])),
  op("eventFrom", node(evtSubject, [[kv(NOTE), text("hi")]])),
  op("eventFrom", node(reqSubject, [[kv(CONTENT), text("c")]])),
  op("responseFrom", node(respSubject, [[kv(RESULT), int(5)]])),
  op("responseFrom", node(respSubject, [[kv(ERROR), text("e")]])),
  op("responseFrom", node(raw("d99c45d99c4011"), [[kv(ERROR), text("e")]])), // 40005('Unknown')
  op("responseFrom", node(raw("d99c45d99c4001"), [[kv(ERROR), text("e")]])), // 40005('isA')
  op("responseFrom", node(raw("d99c45d99c4011"), [[kv(RESULT), int(5)]])),
  op(
    "responseFrom",
    node(respSubject, [
      [kv(RESULT), int(5)],
      [kv(ERROR), text("e")],
    ]),
  ),
  op("responseFrom", node(respSubject, [[text("p"), text("o")]])),
  op("responseFrom", node(reqSubject, [[kv(RESULT), int(5)]])),
  op("responseFrom", node(raw("d99c456161"), [[kv(RESULT), int(5)]])), // 40005("a")
  op("responseFrom", { k: "request", func: "f", id: ARID_1, params: [] }),
  { k: "responseOp", op: "resultOnFailure", id: ARID_1 },
  { k: "responseOp", op: "errorOnSuccess", id: ARID_1 },
  { k: "responseOp", op: "expectIdEarly", id: ARID_1 },
];

const attachmentOf = (payload: E, vendor: E, extra: [E, E][] = []): E =>
  assertion(kv(ATTACHMENT), node(wrap(payload), [[kv(VENDOR), vendor], ...extra]));
/** Attachment validation on hand-built shapes. */
export const ATTACHMENTS: E[] = [
  op("validateAttachment", attachmentOf(text("p"), text("com.example"))),
  op("validateAttachment", attachmentOf(text("p"), text(""))),
  op("validateAttachment", attachmentOf(text("p"), int(1))),
  op(
    "validateAttachment",
    attachmentOf(text("p"), text("com.example"), [[kv(CONFORMS_TO), text("https://x")]]),
  ),
  op(
    "validateAttachment",
    attachmentOf(text("p"), text("com.example"), [[kv(CONFORMS_TO), int(1)]]),
  ),
  op("validateAttachment", attachmentOf(text("p"), text("com.example"), [[text("extra"), int(1)]])),
  op(
    "validateAttachment",
    assertion(text("attachment"), node(wrap(text("p")), [[kv(VENDOR), text("com.example")]])),
  ),
  op("validateAttachment", assertion(kv(ATTACHMENT), node(text("p"), [[kv(VENDOR), text("v")]]))),
  op("validateAttachment", assertion(kv(ATTACHMENT), wrap(text("p")))),
  op("validateAttachment", text("x")),
  op("validateAttachment", node(attachmentOf(text("p"), text("v")), [[text("k"), int(1)]])),
  op("attachmentVendor", attachmentOf(text("p"), node(text("v"), [[text("k"), int(1)]]))),
  op("attachmentVendor", attachmentOf(text("p"), wrap(text("v")))),
  op("attachmentVendor", attachmentOf(text("p"), int(1))),
  op("attachmentVendor", text("x")),
  op("attachmentConformsTo", attachmentOf(text("p"), text("v"))),
  op("attachmentConformsTo", attachmentOf(text("p"), text("v"), [[kv(CONFORMS_TO), int(1)]])),
  op("attachmentPayload", assertion(kv(ATTACHMENT), text("p"))),
  op("expectAttachment", text("x")),
  op(
    "expectAttachment",
    node(text("x"), [
      [kv(ATTACHMENT), node(wrap(text("p")), [[kv(VENDOR), text("v")]])],
      [kv(ATTACHMENT), node(wrap(text("q")), [[kv(VENDOR), text("v")]])],
    ]),
  ),
  op(
    "expectAttachment",
    node(text("x"), [[kv(ATTACHMENT), node(wrap(text("p")), [[kv(VENDOR), text("v")]])]]),
  ),
];

const RUST_RECIPIENT_UR =
  "ur:envelope/lftansfwlrhdcxkeprstbbuoetprjkbdvefhhyjppfkggdrhaxamrfdsgesbjndyhknywyrhemhtzsgsykskwedtwsqdqzknjeyanngonnlfhddkdsrpnttnknwzwppyjodefwlncsfxhsnnsnfmhtuywktdrsbaotlndsjoktlniyahcpwlfwmhcncxhdctbwrocmvlfrrpfmbdmnkgbtytjnjnaaimjkmoosoyahtpsotansgulftansfwlshddadedlkbadvytdrpiykidmfmnnnsdazcbtlnbebbfywswdytgapmaovoyaeewsctpfhyrekgkgtnwtfyrtcyplasoxsrzoaasfbaadpsoxlnwyfdiyaedecpgrwsgsgekihkfnckrymolfoyahtpsotansgulftansfwlshddapknlrolpgehydtptsfwsatjolpkbbnjnahmwjeadfxdlnnfhfehewsrlghaeiyweiaflbwstkbnyseheeykeleksfgspvwaasnbdiepkkkjkeynyaxnbgtwdgrnybaeecywpvtwfoxdtwdayoyahtpsotansgulftansfwlshddaldgtjodyvyplierevecfdlotcpvtidonhtrsrofhoxynwprsgtpthhhtrpgtkgzsjndsbbstcwsnjezswtmyhsjpidiyjnsfcxinfxmoeeoyckgleedkvowsuobyfrdrwmbamdcpplhpjnhtenvsecbygdnycxmttsemssiaadcxutlnhstiretaesknmomtgesahsrlcstbhkiegwgdlolseygofebndrnnmhgmlpjlwdhsmykpstcwglgdadfsoltyktvdrpknuywlfxjkrykpswhewkzcbyisrpgwtpioetrecx";
const assertionFor = (pred: E, obj: E): E => ({ k: "assertion", pred, obj });
const salted = (e: E): E => ({ k: "salt", e, rng: RNG_1, len: 8 });
const saltedNode: E = {
  k: "nodeEnv",
  subject: text("A"),
  assertions: [salted(assertionFor(text("p"), text("o")))],
};
const elidedInner: E = {
  k: "elide",
  e: saltedNode,
  removing: [assertionFor(text("p"), text("o"))],
};
const recipientEnv: E = { k: "recipient", e: text("Hello."), key: KEY7, recipientSeed: SEED_B };
const encrypted: E = { k: "encrypt", e: text("Hello."), key: KEY7, subject: true };
const signedWithJunk: E = node(text("Hello."), [[kv(SIGNED), wrap(text("x"))]]);
/** The wire shapes: duplicates, salted assertions, dates, a reference-produced recipient envelope, nonce-pinned AEAD bytes. */
export const WIRE: E[] = [
  node(text("Alice"), [
    [text("knows"), text("Bob")],
    [text("knows"), text("Bob")],
  ]),
  {
    k: "nodeEnv",
    subject: text("Alice"),
    assertions: [
      assertionFor(text("knows"), text("Bob")),
      assertionFor(text("knows"), text("Bob")),
    ],
  },
  saltedNode,
  elidedInner,
  op("roundtrip", elidedInner),
  date(0),
  date(1657512000000),
  node(text("event"), [[text("at"), date(1657512000000)]]),
  { k: "recipientDecode", ur: RUST_RECIPIENT_UR, recipientSeed: SEED_B },
  op("addAssertionEnvelope", text("A"), { assertion: text("not-an-assertion"), salt: true }),
  op("addAssertionEnvelope", text("A"), { assertion: text("not-an-assertion") }),
  op("addAssertionEnvelope", text("A"), { assertion: salted(assertionFor(text("p"), text("o"))) }),
  ...([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const).map((f): E => ({
    k: "request",
    func: f,
    id: ARID_1,
    params: [[2, int(1)]],
  })),
  // A fixed nonce pins the AEAD bytes on both sides.
  { k: "encrypt", e: text("Hello."), key: KEY7, subject: true, nonce: NONCE_A },
  { k: "encrypt", e: text("Hello."), key: KEY7, nonce: NONCE_A },
  {
    k: "encrypt",
    e: node(text("Alice"), [[text("knows"), text("Bob")]]),
    key: KEY7,
    subject: true,
    nonce: NONCE_A,
  },
  op("encryptSubject", node(text("Alice"), [[kv(1), text("Bob")]]), { key: KEY, nonce: NONCE_A }),
  // Exact bytes with every entropy source fixed: the reference opens the
  // port's sealed message or encrypted key and rebuilds the envelope.
  {
    k: "recipient",
    e: text("Hello."),
    key: KEY7,
    recipientSeed: SEED_B,
    nonce: NONCE_A,
    sealNonce: NONCE_B,
    rng: RNG_1,
  },
  {
    k: "recipient",
    e: aliceMore,
    key: KEY7,
    recipientSeed: SEED_B,
    scheme: "mlkem512",
    nonce: NONCE_A,
    sealNonce: NONCE_B,
    rng: RNG_1,
  },
  {
    k: "recipient",
    e: text("Hello."),
    key: KEY7,
    recipientSeed: LOW_ORDER_POINT,
    scheme: "lowOrder",
    nonce: NONCE_A,
    sealNonce: NONCE_B,
    rng: RNG_1,
  },
  {
    k: "lock",
    e: text("x"),
    secret: PASSWORD,
    method: "hkdf",
    key: KEY7,
    nonce: NONCE_A,
    salt: SALT_16,
  },
  {
    k: "lock",
    e: text("x"),
    secret: PASSWORD,
    method: "pbkdf2",
    key: KEY7,
    nonce: NONCE_A,
    salt: SALT_16,
  },
  {
    k: "lock",
    e: text("x"),
    secret: PASSWORD,
    method: "scrypt",
    key: KEY7,
    nonce: NONCE_A,
    salt: SALT_16,
  },
  {
    k: "lock",
    e: text("x"),
    secret: PASSWORD,
    method: "argon2id",
    key: KEY7,
    nonce: NONCE_A,
    salt: SALT_16,
  },
  { k: "seal", e: aliceMore, seed: SEED_A, recipientSeed: SEED_B, nonce: NONCE_A, rng: RNG_1 },
  // The `Encrypt` elision action on obscured targets, and `Compress` on them (the reference panics).
  {
    k: "elide",
    e: node(text("s"), [[text("p"), encryptedOf(text("o"))]]),
    removing: [encryptedOf(text("o"))],
    action: { encrypt: KEY },
  },
  {
    k: "elide",
    e: node(text("s"), [[text("p"), elidedOf(text("o"))]]),
    removing: [elidedOf(text("o"))],
    action: { encrypt: KEY },
  },
  {
    k: "elide",
    e: node(text("s"), [[text("p"), compressedOf(text("o"))]]),
    removing: [compressedOf(text("o"))],
    action: { encrypt: KEY },
  },
  {
    k: "elide",
    e: node(text("s"), [[text("p"), encryptedOf(text("o"))]]),
    removing: [encryptedOf(text("o"))],
    action: "compress",
  },
  {
    k: "elide",
    e: node(text("s"), [[text("p"), elidedOf(text("o"))]]),
    removing: [elidedOf(text("o"))],
    action: "compress",
  },
  op(
    "walkDecrypt",
    {
      k: "elide",
      e: node(text("s"), [[text("p"), encryptedOf(text("o"))]]),
      removing: [encryptedOf(text("o"))],
      action: { encrypt: KEY },
    },
    { key: KEY },
  ),
];
/** Rejections, compared by code and message on both sides. */
export const REJECT: E[] = [
  op("encryptSubject", encrypted, { key: KEY7 }),
  op(
    "encryptSubject",
    { k: "elide", e: text("Hello."), removing: [text("Hello.")] },
    { key: KEY7 },
  ),
  op("decryptSubject", text("Hello."), { key: KEY7 }),
  op("decryptSubject", encrypted, { key: KEY2 }),
  op("compress", encrypted),
  op("compress", { k: "elide", e: text("Hello."), removing: [text("Hello.")] }),
  op("decompress", text("Hello.")),
  op(
    "decompress",
    raw(
      "d99c43841a3bea90931841583cbb71a2f5c6c954c79ccce4d4852c374ea6392ae4e597a42ebc7132353b2fbfbcf8c6c954e7c4a2fc9c858c374ea605a41615e7e721c9253be5270100d99c415820ab2344e45ad4c8dfc9e86a73bf7c91c56999e49980671f0f2a30b31be4f3a563",
    ),
  ),
  op("decryptToRecipient", recipientEnv, { recipientSeed: SEED_A }),
  op("decryptToRecipient", encrypted, { recipientSeed: SEED_B }),
  op("decryptToRecipient", text("Hello."), { recipientSeed: SEED_B }),
  op("decryptToRecipient", node(encrypted, [[kv(HAS_RECIPIENT), text("nope")]]), {
    recipientSeed: SEED_B,
  }),
  op("recipients", node(encrypted, [[kv(HAS_RECIPIENT), text("nope")]])),
  op("recipients", node(encrypted, [[kv(HAS_RECIPIENT), elidedOf(text("nope"))]])),
  op("unlock", node(encrypted, [[kv(HAS_SECRET), text("nope")]]), { secret: PASSWORD }),
  op("unlock", node(encrypted, [[kv(HAS_SECRET), elidedOf(text("nope"))]]), { secret: PASSWORD }),
  op("unlock", { k: "lock", e: text("x"), secret: PASSWORD, method: "hkdf" }, { secret: "00" }),
  op("sskrJoin", node(encrypted, [[kv(6), text("nope")]])),
  op("sskrJoin", encrypted),
  op("attachmentPayload", text("Hello.")),
  op("expectAttachment", text("Hello.")),
  op("requestFrom", { k: "request", func: "f", id: ARID_1, params: [] }, { func: "g" }),
  op("verify", signedWithJunk, { seed: SEED_A }),
  op("verify", node(text("Hello."), [[kv(SIGNED), raw("d99c548241006178")]]), { seed: SEED_A }),
  op("verify", node(text("Hello."), [[kv(SIGNED), raw("d99c548304182c4100")]]), { seed: SEED_A }),
  op("verify", { k: "sign", e: text("Hello."), seed: SEED_A, scheme: "ed25519" }, { seed: SEED_B }),
  op(
    "verify",
    { k: "sign", e: text("Hello."), seed: SEED_A, scheme: "ed25519" },
    { pub: "ff".repeat(32) },
  ),
  op("decryptToRecipient", recipientEnv, { recipientSeed: SEED_B }),
];

// Deterministic SSKR shares of KEY2 (1 of [2-of-3], seed 1,1,1,1) with the
// content encrypted under KEY2: raw share bytes attached as they are.
const SHARE_1 = "8080000100c8d7c00abb59aefb72f5678b59e5806d5787cb2bb35bb38e42157e0fba6177b2";
const SHARE_2 = "80800001015ee923350f7c385caa3c9d48d9c671b99996591052f3c7c75907e14ca6c280b8";
const SHARE_3 = "8080000102ffab1d74c81399aed97c881642a379ded0a5f45d6a105b1c74315b89823c82a6";
const sskrSecret: E = { k: "encrypt", e: text("secret"), key: KEY2, subject: true, nonce: NONCE_A };
/** `sskrJoin` over raw share bytes: a malformed share's group is skipped. */
export const SSKR_RAW: E[] = [
  { k: "sskrJoinRaw", e: sskrSecret, shares: [SHARE_1, SHARE_2] },
  { k: "sskrJoinRaw", e: sskrSecret, shares: [SHARE_1, SHARE_2, SHARE_3] },
  { k: "sskrJoinRaw", e: sskrSecret, shares: [SHARE_1] },
  // reserved bits set in the header of a third share of another identifier
  { k: "sskrJoinRaw", e: sskrSecret, shares: [SHARE_1, SHARE_2, "c0c0" + SHARE_3.slice(4)] },
  // a 4-byte share
  { k: "sskrJoinRaw", e: sskrSecret, shares: [SHARE_1, SHARE_2, "00010203"] },
  // group threshold above the group count
  { k: "sskrJoinRaw", e: sskrSecret, shares: [SHARE_1, SHARE_2, "7f7f" + SHARE_3.slice(4)] },
  { k: "sskrJoinRaw", e: sskrSecret, shares: ["00010203"] },
];

const agentIdentities = [{ seed: SEED_A, comment: "alice" }];
/** `"Hello."` wrapped and locked by the reference through an agent holding `alice` (`examples/dump_agent_lock.rs`). */
const AGENT_LOCKED_HEX =
  "d8c882d99c42844ded54c2b0579a4bda2ba34c40cd4c0b0b0b0b0b0b0b0b0b0b0b0b504dfc77a794df25088d0fa538e7b944765825d99c415820172a5e51431062e7b13525cbceb8ad8475977444cf28423e21c0d1dcbdfcaf47a113d8c9d99c5bd99c42845820e5c15daf21ad66490c3f6c25ce2a8d5ee6030f3c5539ba5f8f5a16bd4a34d8e84c03693036f330be5219839aff50af31fd59763745fff372b520972358a3581c8304d99c5250101112131415161718191a1b1c1d1e1f65616c696365";
const twoIdentities = [
  { seed: SEED_A, comment: "alice" },
  { seed: SEED_C, comment: "carol" },
];
/** SSH-agent lock and unlock over an in-memory agent (the harness's `agent` build). */
export const AGENT: E[] = [
  {
    k: "agentLock",
    e: text("Hello."),
    identities: agentIdentities,
    id: "alice",
    salt: SALT_16,
    nonce: NONCE_A,
    rng: RNG_1,
  },
  {
    k: "agentLock",
    e: aliceMore,
    identities: twoIdentities,
    id: "carol",
    salt: SALT_16,
    nonce: NONCE_B,
    rng: RNG_2,
  },
  {
    k: "agentLock",
    e: text("Hello."),
    identities: agentIdentities,
    id: "",
    salt: SALT_16,
    nonce: NONCE_A,
    rng: RNG_1,
  },
  {
    k: "agentLock",
    e: text("Hello."),
    identities: twoIdentities,
    id: "",
    salt: SALT_16,
    nonce: NONCE_A,
    rng: RNG_1,
  },
  {
    k: "agentLock",
    e: text("Hello."),
    identities: agentIdentities,
    id: "nobody",
    salt: SALT_16,
    nonce: NONCE_A,
    rng: RNG_1,
  },
  {
    k: "agentLock",
    e: text("Hello."),
    identities: [],
    id: "alice",
    salt: SALT_16,
    nonce: NONCE_A,
    rng: RNG_1,
  },
  {
    k: "agentLock",
    e: text("Hello."),
    identities: agentIdentities,
    id: "alice",
    salt: SALT_16,
    nonce: NONCE_A,
    rng: RNG_1,
    refuse: true,
  },
  { k: "agentUnlock", hex: AGENT_LOCKED_HEX, identities: agentIdentities, id: "alice" },
  { k: "agentUnlock", hex: AGENT_LOCKED_HEX, identities: agentIdentities },
  { k: "agentUnlock", hex: AGENT_LOCKED_HEX, identities: twoIdentities, id: "carol" },
  { k: "agentUnlock", hex: AGENT_LOCKED_HEX, identities: [] },
];

/** The registration state of the global format context. */
export const NOREG: E[] = [
  { k: "noreg", inner: kv(1) },
  { k: "noreg", inner: kv(25) },
  { k: "noreg", inner: raw("d99c401819") }, // 40000(25) inside a leaf
  { k: "noreg", inner: node(text("s"), [[kv(1), text("Person")]]) },
  {
    k: "noreg",
    inner: {
      k: "request",
      func: 1,
      id: ARID_2,
      params: [[2, int(2)]],
    },
  },
  { k: "noreg", inner: raw(REQ_7) },
  { k: "noreg", inner: raw(FN_F) },
  { k: "noreg", inner: raw("d99c4702") },
  { k: "noreg", inner: { k: "leaf", v: { t: "arid", hex: ARID_1 } } },
  { k: "noreg", inner: raw(DATE_SUBMS) },
];
export const LATE: E[] = [
  {
    k: "late",
    knownValues: [[777, "late"]],
    tags: [[999, "late-tag"]],
    inner: node(kv(777), [[text("t"), raw("d903e701")]]),
  },
  { k: "late", inner: kv(777) },
  { k: "late", inner: raw("d903e701") },
];

/** The JavaScript input domain: cases the reference's types cannot express. */
export const DOMAIN_CASES: [string, "J1" | "J2" | "J3" | "J4"][] = [
  ["node.emptyAssertions", "J4"],
  ["knownValue.-1", "J2"],
  ["knownValue.1.5", "J1"],
  ["knownValue.NaN", "J1"],
  ["knownValue.2^53", "J2"],
  ["knownValue.2n**64n", "J2"],
  ["setPosition.1.5", "J1"],
  ["setPosition.-1", "J2"],
  ["setPosition.NaN", "J1"],
  ["setPosition.2^53", "J2"],
  ["digests.1.5", "J1"],
  ["digests.-1", "J2"],
  ["addSalt.length.1.5", "J1"],
  ["addSalt.length.NaN", "J1"],
  ["addSalt.length.-1", "J2"],
  ["addSalt.length.2^32", "J2"],
  ["addSalt.range.min.8.5", "J1"],
  ["lock.method.99", "J2"],
  ["lock.method.sshAgent", "J4"],
  ["addSecret.method.sshAgent", "J4"],
  ["function.known.-1", "J2"],
  ["function.known.1.5", "J1"],
  ["function.known.2^53", "J2"],
  ["function.known.2n**64n", "J2"],
  ["parameter.from.1.5", "J1"],
  ["parameter.known.-1", "J2"],
  ["hasSignaturesFromThreshold.1.5", "J1"],
  ["hasSignaturesFromThreshold.NaN", "J1"],
  ["hasSignaturesFromThreshold.-1", "J2"],
  ["leaf.undefined", "J3"],
  ["leaf.dateNaN", "J3"],
  ["leaf.symbol", "J3"],
  ["leaf.function", "J3"],
  ["expectSubject.foreignClass", "J3"],
];

const VOCAB_SUBJECTS: E[] = [
  text("Alice"),
  int(7),
  kv(1),
  { k: "leaf", v: { t: "bytes", hex: "0102" } },
];
const VOCAB_PREDICATES: E[] = [text("knows"), kv(1), kv(4), int(9)];
const VOCAB_OBJECTS: E[] = [text("Bob"), int(42), bool(true), nul, kv(2)];

/** Deterministic trees: every subject × predicate × object pair, then two-level nests. */
function* generated(): Generator<E> {
  let i = 0;
  for (const s of VOCAB_SUBJECTS) {
    for (const p of VOCAB_PREDICATES) {
      for (const o of VOCAB_OBJECTS) {
        const base = node(s, [[p, o]]);
        // the extensions on a stride so every kind meets every shape
        switch (i++ % 7) {
          case 0:
            yield base;
            break;
          case 1:
            yield wrap(base);
            break;
          case 2:
            yield { k: "elide", e: base, removing: [o] };
            break;
          case 3:
            yield { k: "encrypt", e: base, key: KEY, subject: true, nonce: NONCE_A };
            break;
          case 4:
            yield { k: "compress", e: base };
            break;
          case 5:
            yield { k: "sign", e: base, seed: SEED_A, scheme: "ed25519" };
            break;
          case 6:
            yield node(base, [[text("meta"), node(int(1), [[int(2), int(3)]])]]);
            break;
        }
      }
    }
  }
}

export const categories: Record<string, () => Generator<Recipe>> = {
  hand: function* () {
    for (const e of HAND) yield { e };
  },
  generated: function* () {
    for (const e of generated()) yield { e };
  },
  wire: function* () {
    for (const e of WIRE) yield { e };
  },
  reject: function* () {
    for (const e of REJECT) yield { e, out: ["format"] };
  },
  decodeErrors: function* () {
    for (const e of DECODE_ERRORS) yield { e, out: ["cbor", "digest", "format"] };
  },
  fmt: function* () {
    for (const e of FMT) yield { e };
  },
  extract: function* () {
    for (const e of EXTRACT) yield { e, out: ["format"] };
    for (const e of EXPECT) yield { e, out: ["format"] };
  },
  predicates: function* () {
    for (const e of PREDICATES) yield { e, out: ["format"] };
  },
  position: function* () {
    for (const e of POSITION_READS) yield { e };
  },
  expressions: function* () {
    for (const e of EXPRESSIONS) yield { e };
  },
  attachments: function* () {
    for (const e of ATTACHMENTS) yield { e, out: ["format"] };
  },
  sskrRaw: function* () {
    for (const e of SSKR_RAW) yield { e, out: ["format"] };
  },
  agent: function* () {
    for (const e of AGENT) yield { e };
  },
  noreg: function* () {
    for (const e of NOREG) yield { e };
  },
  late: function* () {
    for (const e of LATE) yield { e, out: ["format", "flat", "diagAnn", "hex"] };
  },
  domain: function* () {
    for (const [c, cls] of DOMAIN_CASES)
      yield { e: { k: "domain", case: c, cls }, out: ["format"] };
  },
};
/**
 * The whole corpus in the order the harness replays it: the `noreg` rows
 * first (before the envelope summarisers are registered), the `late` rows
 * last (after the global format context has been built by the rows before).
 */
export function* allRecipes(): Generator<Recipe> {
  yield* categories["noreg"]();
  for (const [name, g] of Object.entries(categories))
    if (name !== "noreg" && name !== "late") yield* g();
  yield* categories["late"]();
}
/**
 * Rows whose TypeScript artefact cannot be reproduced run to run: an ML-DSA
 * signature draws fresh randomness, and components draws the nonce of a
 * locked key itself. The reference verifies them on every full-corpus run;
 * the golden file, which must replay byte for byte, leaves them out.
 */
export function isReproducible(e: E): boolean {
  if (e.k === "sign" && e.scheme === "mldsa44") return false;
  if (e.k === "lock" && e.key !== undefined) return false;
  return true;
}
/** Golden subset: every reproducible row (the corpus is small enough to pin whole). */
export function* goldenRecipes(): Generator<Recipe> {
  for (const r of allRecipes()) if (isReproducible(r.e)) yield r;
}
