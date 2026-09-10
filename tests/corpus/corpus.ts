/**
 * Deterministic corpus (Phase 1.3): hand-built envelopes covering every case
 * and extension (the shapes the Rust test suite uses), then generated trees
 * over a small vocabulary with the extensions applied on a stride.
 */
import type { E, Leaf, Recipe, Seed } from "../vectors/recipes";

const KEY = "0f6a5c0e6d1b7a2d4e3c9b8a7f6e5d4c3b2a19081716151413121110090807aa";
const KEY2 = "f0e1d2c3b4a5968778695a4b3c2d1e0f0011223344556677889900aabbccddee";
const SEED_A = "59f2293a5bce7d4de59e71b4207ac5d2b5c6bfbf4e4a3d2b1f0e9d8c7b6a5948";
const SEED_B = "ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00";
const ARID_1 = "c66be27dbad7cd095ca77647406d07976dc0f35f0d4d654bb0e96dd227a1e9fc";
const ARID_2 = "1111111111111111111111111111111111111111111111111111111111111111";
const RNG_1: Seed = [
  "17295166580085024720",
  "422929670265678780",
  "5577237070365765850",
  "7953171132032326923",
];
const RNG_2: Seed = ["1", "1", "1", "1"];

const text = (v: string): E => ({ k: "leaf", v: { t: "text", v } });
const int = (v: number | string): E => ({ k: "leaf", v: { t: "int", v: String(v) } });
const kv = (v: number): E => ({ k: "kv", v });
const node = (subject: E, assertions: [E, E][]): E => ({ k: "node", subject, assertions });
const wrap = (e: E): E => ({ k: "wrap", e });

/** The base envelopes: one per leaf shape, plus the classic structures. */
export const LEAVES: Leaf[] = [
  { t: "text", v: "Hello." },
  { t: "text", v: "" },
  { t: "text", v: "Alice" },
  { t: "text", v: 'quote " and \\ backslash' },
  { t: "text", v: "unicode ✓ ☺ 日本" },
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
  { t: "bool", v: true },
  { t: "bool", v: false },
  { t: "null" },
  { t: "float", v: 1.5 },
  { t: "float", v: -0.001 },
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
  alice,
  aliceMore,
  nested,
  deep,
  wrap(alice),
  wrap(wrap(text("x"))),
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
  { k: "sign", e: aliceMore, seed: SEED_B, scheme: "ed25519", note: "Signed by B" },
  { k: "sign", e: wrap(aliceMore), seed: SEED_A, scheme: "ed25519" },
  {
    k: "sign",
    e: { k: "sign", e: aliceMore, seed: SEED_A, scheme: "ed25519" },
    seed: SEED_B,
    scheme: "ecdsa",
  },
  { k: "salt", e: aliceMore, rng: RNG_1 },
  { k: "salt", e: text("x"), rng: RNG_2, len: 16 },
  { k: "salt", e: alice, rng: RNG_1, len: 8 },
  { k: "sskr", e: aliceMore, key: KEY, spec: { gt: 1, groups: [{ mt: 2, mc: 3 }] }, rng: RNG_1 },
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
  { k: "type", e: aliceMore, type: kv(1) },
  { k: "type", e: text("x"), type: text("Thing") },
  { k: "position", e: aliceMore, pos: 3 },
  { k: "position", e: text("x"), pos: 0 },
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
  { k: "response", id: ARID_1, result: int(5) },
  { k: "response", id: ARID_2, error: text("failed") },
  { k: "recipient", e: aliceMore, key: KEY, recipientSeed: SEED_B },
  { k: "lock", e: aliceMore, secret: "70617373776f7264", method: "hkdf" },
  { k: "lock", e: text("x"), secret: "70617373776f7264", method: "pbkdf2" },
  // decode: real envelopes (hex as the baseline produced them) and malformed input
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
  { k: "decode", hex: "d8c8a2d8c96161d8c96162d8c96163d8c96164" }, // assertion map with two keys
  { k: "decode", hex: "d8c8581f" + "00".repeat(31) }, // elided digest of the wrong length
  { k: "decode", hex: "d8c9d8c965416c696365" }, // wrong outer tag
  { k: "decode", hex: "d8c880" }, // node with no elements
  { k: "decode", hex: "d8c881d8c965416c696365" }, // node with a subject only
  { k: "decode", hex: "d8c8d8c965416c69" }, // truncated
  { k: "decode", hex: "d8c8f6" }, // null inside tag 200 (not a leaf)
  { k: "decode", hex: "d8c8d8c9f6" }, // null leaf
  { k: "ur", s: "ur:envelope/tpsoiyfdihjzjzjldmksbaoede" },
  {
    k: "ur",
    s: "ur:envelope/lptpsoihfpjziniaihoyaatpsoiyfpcxjtjljyihoytpsoihjejtjlktjktpsoihfxhsjpjljzoyadtpsoiygdihjpjkjljtoytpsoihjejtjlktjktpsoiafwjlidbepdecjk",
  },
  {
    k: "ur",
    s: "ur:envelope/lptpsoihfpjziniaihoyaatpsoiyfpcxjtjljyihoytpsoihjejtjlktjktpsoihfxhsjpjljzoyadtpsoiygdihjpjkjljtoytpsoihjejtjlktjkhdcxbwrlfpmwnsemrovtnssrtnotcfgshdvezcjedlbbtypatiwtecoxjnjnhtcafhbyrhcaglwl",
  },
  { k: "ur", s: "ur:envelope/aeae" }, // bad checksum
  {
    k: "ur",
    s: "ur:digest/hdcxaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeaeihndnttt",
  }, // wrong type
];

const VOCAB_SUBJECTS: E[] = [
  text("Alice"),
  int(7),
  kv(1),
  { k: "leaf", v: { t: "bytes", hex: "0102" } },
];
const VOCAB_PREDS: E[] = [text("knows"), kv(1), kv(4), int(9)];
const VOCAB_OBJS: E[] = [
  text("Bob"),
  int(42),
  { k: "leaf", v: { t: "bool", v: true } },
  text("Carol"),
];

/** Generated trees: every subject × 0..3 assertions from the vocabulary, nested one level on a stride. */
export function* generated(): Generator<E> {
  let i = 0;
  for (const subject of VOCAB_SUBJECTS) {
    for (let n = 0; n <= 3; n++) {
      const assertions: [E, E][] = [];
      for (let a = 0; a < n; a++) {
        const pred = VOCAB_PREDS[(a + i) % VOCAB_PREDS.length]!;
        let obj = VOCAB_OBJS[(a * 2 + i) % VOCAB_OBJS.length]!;
        if ((a + n + i) % 3 === 0)
          obj = node(obj, [[VOCAB_PREDS[(a + 1) % 4]!, VOCAB_OBJS[(a + 3) % 4]!]]);
        assertions.push([pred, obj]);
      }
      const e = n === 0 ? subject : node(subject, assertions);
      yield e;
      if (i % 2 === 0) yield wrap(e);
      if (n >= 1) {
        yield { k: "elide", e, removing: [assertions[0]![1]] };
        if (i % 3 === 0)
          yield { k: "sign", e, seed: SEED_A, scheme: i % 2 === 0 ? "ed25519" : "ecdsa" };
        if (i % 3 === 1) yield { k: "compress", e, subject: true };
        if (i % 3 === 2) yield { k: "salt", e, rng: RNG_1, len: 8 };
        if (i % 4 === 0) yield { k: "encrypt", e, key: KEY, subject: true };
      }
      i++;
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
};
export function* allRecipes(): Generator<Recipe> {
  for (const g of Object.values(categories)) yield* g();
}
/** Golden subset: everything (the corpus is small enough to pin whole). */
export function* goldenRecipes(): Generator<Recipe> {
  yield* allRecipes();
}
