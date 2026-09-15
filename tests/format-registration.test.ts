/**
 * The registration state of the global format context, as the reference's
 * `LazyFormatContext::get` and `register_tags()` define it: a fresh process
 * names tags and renders the components summarisers on first use, but the
 * envelope summarisers (known values, functions, parameters, requests,
 * responses, events) appear only after `registerTags()`; the context holds
 * snapshots of the global stores, so a registration made afterwards is seen
 * by the annotated hex dump (dcbor's live store) and nowhere else.
 *
 * The test setup registers the tags for every suite, so the unregistered
 * state is observed in a child process.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { Tag, getGlobalTagsStore, taggedValue } from "@blockchaincommons/dcbor";
import { ARID } from "@blockchaincommons/components";
import {
  KnownValue,
  KnownValuesStore,
  IS_A,
  VALUE,
  getGlobalKnownValuesStore,
} from "@blockchaincommons/known-values";
import { Envelope } from "../src/index.js";
import {
  FormatContext,
  getGlobalFormatContext,
  registerTags,
  registerTagsIn,
} from "../src/format/index.js";
import "../src/all.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const leaf = (hex: string): Envelope => Envelope.fromBytes(Buffer.from(hex, "hex"));
const arid = ARID.from(new Uint8Array(32).fill(0x11));
/** `40004(ARID)` with a `'body'` of `40006(1) [ 40007(2): 2 ]`. */
const request = (): Envelope =>
  Envelope.leaf(taggedValue(40004, arid.toCbor())).addAssertion(
    100,
    Envelope.leaf(taggedValue(40006, 1)).addAssertion(Envelope.leaf(taggedValue(40007, 2)), 2),
  );

/** The renderings a fresh process prints before and after `registerTags()`. */
const CHILD = `
import { Envelope } from "./src/index.ts";
import "./src/all.ts";
import { registerTags } from "./src/format/index.ts";
import { DirectoryConfig, setDirectoryConfig, VALUE, IS_A } from "@blockchaincommons/known-values";
import { taggedValue } from "@blockchaincommons/dcbor";
import { ARID } from "@blockchaincommons/components";
setDirectoryConfig(new DirectoryConfig());
const leaf = (h) => Envelope.fromBytes(Buffer.from(h, "hex"));
const arid = ARID.from(new Uint8Array(32).fill(0x11));
const request = Envelope.leaf(taggedValue(40004, arid.toCbor())).addAssertion(
  100,
  Envelope.leaf(taggedValue(40006, 1)).addAssertion(Envelope.leaf(taggedValue(40007, 2)), 2),
);
const rows = () => ({
  kvLeaf: leaf("d8c8d8c9d99c401819").format(),
  kvCase: Envelope.from(VALUE).format(),
  isACase: Envelope.from(IS_A).format(),
  request: request.formatFlat(),
  fn: leaf("d8c8d8c9d99c4601").format(),
  hex: leaf("d8c8d8c9d99c401819").hex(),
  diag: leaf("d8c8d8c9d99c401819").diagnostic({ annotate: true }),
});
const before = rows();
registerTags();
registerTags();
process.stdout.write(JSON.stringify({ before, after: rows() }));
`;

interface Rows {
  kvLeaf: string;
  kvCase: string;
  isACase: string;
  request: string;
  fn: string;
  hex: string;
  diag: string;
}

describe("global format context registration", () => {
  it("a fresh process names tags and components on first use; the envelope summarisers wait for registerTags()", () => {
    const out = execFileSync("bun", ["-e", CHILD], { cwd: root, encoding: "utf8" });
    const { before, after } = JSON.parse(out) as { before: Rows; after: Rows };
    // Unregistered: the components summarisers (ARID) and every tag name
    // are present, the envelope summarisers are not; the known-value CASE
    // prints through notation whatever the registration state.
    expect(before.kvLeaf).toBe("40000(25)");
    expect(before.kvCase).toBe("'value'");
    expect(before.isACase).toBe("'isA'");
    expect(before.request).toBe("40004(ARID(11111111)) [ 100: 40006(1) [ 40007(2): 2 ] ]");
    expect(before.fn).toBe("40006(1)");
    expect(before.hex).toContain("# tag(40000) known-value");
    expect(before.diag).toContain("40000(25)   / known-value /");
    // Registered (twice: the second call is a no-op)
    expect(after.kvLeaf).toBe("'25'");
    expect(after.kvCase).toBe("'value'");
    expect(after.request).toBe("request(ARID(11111111)) [ 100: «add» [ ❰lhs❱: 2 ] ]");
    expect(after.fn).toBe("«add»");
    expect(after.hex).toBe(before.hex);
  });

  it("registerTags() is idempotent", () => {
    const ctx = getGlobalFormatContext();
    const before = ctx.tags.summarizer(40000);
    expect(before).toBeDefined();
    registerTags();
    expect(ctx.tags.summarizer(40000)).toBe(before);
    expect(getGlobalFormatContext()).toBe(ctx);
  });

  it("the context holds snapshots: a late registration is seen only by the annotated hex dump", () => {
    const late = Envelope.knownValue(777).addAssertion("t", Envelope.leaf(taggedValue(999, 1)));
    expect(late.formatFlat()).toBe("'777' [ \"t\": 999(1) ]");
    getGlobalKnownValuesStore().register(new KnownValue(777, "late"));
    getGlobalTagsStore().register(Tag.from(999, "late-tag"));
    expect(late.formatFlat()).toBe("'777' [ \"t\": 999(1) ]");
    expect(late.format()).toBe("'777' [\n    \"t\": 999(1)\n]");
    expect(Envelope.knownValue(777).format()).toBe("'777'");
    expect(leaf("d8c8d8c9d99c40190309").format()).toBe("'777'");
    expect(Envelope.knownValue(777).summary()).toBe("'777'");
    expect(late.treeFormat()).toContain("obj 999(1)");
    expect(late.diagnostic({ annotate: true })).not.toContain("late-tag");
    expect(late.hex()).toContain("# tag(999) late-tag");
    expect(late.hex({ context: "none" })).not.toContain("late-tag");
    expect(late.hex({ context: getGlobalFormatContext() })).not.toContain("late-tag");
  });

  it("a custom context renders through its own stores once its tags are registered", () => {
    const ctx = new FormatContext({
      knownValues: new KnownValuesStore([new KnownValue(9999, "custom")]),
    });
    const reqKv = leaf("d8c8d8c9d99c44d99c4019270f");
    expect(reqKv.format({ context: ctx })).toBe("40004(40000(9999))");
    registerTagsIn(ctx);
    expect(reqKv.format({ context: ctx })).toBe("request('custom')");
    expect(leaf("d8c8d8c9d99c4019270f").format({ context: ctx })).toBe("'custom'");
    // the summarisers captured clones: a value registered afterwards is not seen
    ctx.knownValues.register(new KnownValue(8888, "later"));
    expect(leaf("d8c8d8c9d99c401922b8").format({ context: ctx })).toBe("'8888'");
    // the known-value case reads the context's live store
    expect(Envelope.knownValue(8888).format({ context: ctx })).toBe("'later'");
    // clones are independent
    const copy = ctx.clone();
    copy.knownValues.register(new KnownValue(7777, "copy"));
    expect(Envelope.knownValue(7777).format({ context: ctx })).toBe("'7777'");
    expect(Envelope.knownValue(7777).format({ context: copy })).toBe("'copy'");
  });

  it("the global context is one per process and the reference's seed names known values", () => {
    expect(request().formatFlat()).toBe("request(ARID(11111111)) [ 100: «add» [ ❰lhs❱: 2 ] ]");
    expect(Envelope.from(IS_A).format()).toBe("'isA'");
    expect(Envelope.fromCbor(Envelope.from(VALUE).toCbor()).format()).toBe("'25'");
  });
});
