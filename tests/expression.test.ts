/**
 * The `/expression` subpath: functions, parameters, expressions, requests,
 * responses and events, with the format strings the reference produces.
 */
import { describe, it, expect } from "vitest";
import { ARID } from "@blockchaincommons/components";
import { CborDate, cbor, decodeCbor, taggedValue } from "@blockchaincommons/dcbor";
import { BODY, CONTENT, DATE, NOTE, RESULT } from "@blockchaincommons/known-values";
import { rustDebugString } from "../src/extension/rust-debug.js";
import {
  Envelope,
  EnvelopeError,
  Function,
  FunctionsStore,
  Parameter,
  ParametersStore,
  Expression,
  Request,
  Response,
  Event,
  ADD,
  SUB,
  LHS,
  RHS,
  add,
  neg,
  globalFunctions,
  globalParameters,
} from "../src/all.js";

const unhex = (h: string): Uint8Array =>
  Uint8Array.from(h.match(/../g)?.map((b) => parseInt(b, 16)) ?? []);
const ARID_1 = ARID.from(unhex("c66be27dbad7cd095ca77647406d07976dc0f35f0d4d654bb0e96dd227a1e9fc"));
const ARID_2 = ARID.from(unhex("1111111111111111111111111111111111111111111111111111111111111111"));

describe("Function", () => {
  it("known and named functions", () => {
    const f = Function.known(1, "add");
    expect(f.isKnown()).toBe(true);
    expect(f.isNamed()).toBe(false);
    expect(f.value).toBe(1);
    expect(f.id).toBe(1);
    expect(f.name).toBe("add");
    expect(f.assignedName).toBe("add");
    expect(f.namedName).toBeUndefined();
    const g = Function.named("greet");
    expect(g.isNamed()).toBe(true);
    expect(g.value).toBeUndefined();
    expect(g.id).toBe("greet");
    expect(g.name).toBe('"greet"');
    expect(g.namedName).toBe("greet");
    expect(Function.from(1).equals(Function.known(1))).toBe(true);
    expect(Function.from("greet").equals(g)).toBe(true);
    expect(Function.known(1).equals(Function.known(2))).toBe(false);
    expect(Function.known(1).equals(Function.named("1"))).toBe(false);
  });

  it('formats as «name» for known functions and «"name"» for named ones', () => {
    expect(ADD.toEnvelope().format()).toBe("«add»");
    expect(Function.known(100).toEnvelope().format()).toBe("«100»");
    expect(Function.named("greet").toEnvelope().format()).toBe('«"greet"»');
  });

  it("round-trips through an envelope", () => {
    const e = Function.named("greet").toEnvelope();
    expect(Expression.fromEnvelope(e).function.equals(Function.named("greet"))).toBe(true);
  });

  it("stores name functions, the global store knows the well-known ones", () => {
    const store = new FunctionsStore();
    const f = Function.known(500, "custom");
    store.register(f);
    expect(store.assignedNameOf(Function.known(500))).toBe("custom");
    expect(store.nameOf(Function.known(500))).toBe("custom");
    expect(store.nameOf(Function.known(501))).toBe("501");
    expect(FunctionsStore.nameForFunction(Function.known(500), store)).toBe("custom");
    expect(globalFunctions().assignedNameOf(ADD)).toBe("add");
  });
});

describe("Parameter", () => {
  it("known, named and valued parameters", () => {
    expect(LHS.isKnown()).toBe(true);
    expect(LHS.name).toBe("lhs");
    const p = Parameter.named("x");
    expect(p.isNamed()).toBe(true);
    expect(p.id).toBe("x");
    expect(p.paramValue).toBeUndefined();
    const v = Parameter.from("x", "y");
    expect(v.paramValue?.expectString()).toBe("y");
    expect(Parameter.from(1).equals(Parameter.known(1))).toBe(true);
    expect(v.equals(Parameter.named("x"))).toBe(true);
  });

  it("formats as ❰name❱ and, with a value, as an assertion", () => {
    expect(LHS.toEnvelope().format()).toBe("❰lhs❱");
    expect(Parameter.named("x").toEnvelope().format()).toBe('❰"x"❱');
    expect(Parameter.from("x", "y").toEnvelope().format()).toBe('❰"x"❱: "y"');
    expect(Parameter.blank(1).paramValue?.expectNumber()).toBe(1);
    expect(Parameter.lhs(2).id).toBe(LHS.id);
    expect(Parameter.rhs(3).id).toBe(RHS.id);
  });

  it("stores name parameters", () => {
    const store = new ParametersStore();
    store.register(Parameter.known(500, "custom"));
    expect(store.assignedNameOf(Parameter.known(500))).toBe("custom");
    expect(store.nameOf(Parameter.known(501))).toBe("501");
    expect(ParametersStore.nameForParameter(Parameter.known(500), store)).toBe("custom");
    expect(globalParameters().assignedNameOf(LHS)).toBe("lhs");
  });
});

describe("Expression", () => {
  it("builds and reads parameters", () => {
    const e = new Expression(ADD).withParameter(LHS.id, 2).withParameter(RHS.id, 3);
    expect(e.function.equals(ADD)).toBe(true);
    expect(e.parameters.length).toBe(2);
    expect(e.hasParameter(LHS.id)).toBe(true);
    expect(e.hasParameter("nope")).toBe(false);
    expect(e.parameter(LHS.id)?.expectNumber()).toBe(2);
    expect(e.parameter("nope")).toBeUndefined();
    expect(e.objectsForParameter(RHS.id).map((o) => o.expectNumber())).toEqual([3]);
    expect(e.toEnvelope().format()).toBe("«add» [\n    ❰lhs❱: 2\n    ❰rhs❱: 3\n]");
  });

  it("withParameters takes a record, helpers build arithmetic", () => {
    const e = new Expression(Function.named("f")).withParameters({ a: 1, b: "two" });
    expect(e.parameter("a")?.expectNumber()).toBe(1);
    expect(e.parameter("b")?.expectString()).toBe("two");
    expect(
      add(2, 3)
        .toEnvelope()
        .digest()
        .equals(
          new Expression(ADD)
            .withParameter(LHS.id, 2)
            .withParameter(RHS.id, 3)
            .toEnvelope()
            .digest(),
        ),
    ).toBe(true);
    // The global store seeds four functions: `neg` (5) formats as its id.
    expect(neg(1).toEnvelope().format()).toBe("«5» [\n    ❰_❱: 1\n]");
  });

  it("round-trips through an envelope and rejects non-expressions", () => {
    const e = add(2, 3);
    const back = Expression.fromEnvelope(e.toEnvelope());
    expect(back.function.equals(ADD)).toBe(true);
    expect(back.toEnvelope().digest().equals(e.toEnvelope().digest())).toBe(true);
    expect(() => Expression.fromEnvelope(Envelope.from("Alice"))).toThrow(EnvelopeError);
  });
});

describe("Request", () => {
  it("matches the reference format string", () => {
    const req = Request.from(100, ARID_2)
      .withParameter("x", "y")
      .withNote("a note")
      .withDate(new Date(1657512000000));
    expect(req.toEnvelope().format()).toBe(
      [
        "request(ARID(11111111)) [",
        "    'body': «100» [",
        '        ❰"x"❱: "y"',
        "    ]",
        "    'date': 2022-07-11T04:00:00Z",
        "    'note': \"a note\"",
        "]",
      ].join("\n"),
    );
    expect(req.id.equals(ARID_2)).toBe(true);
    expect(req.note).toBe("a note");
    expect(req.date?.getTime()).toBe(1657512000000);
    expect(req.function.equals(Function.known(100))).toBe(true);
    expect(req.body.parameter("x")?.expectString()).toBe("y");
    expect(req.expressionEnvelope.format()).toBe('«100» [\n    ❰"x"❱: "y"\n]');
    expect(req.summary()).toContain("100");
  });

  it("accepts a name, a Function or an Expression as the body", () => {
    const a = Request.from("add", ARID_1).withParameter(LHS.id, 2).withParameter(RHS.id, 3);
    const b = Request.from(add(2, 3), ARID_1);
    expect(a.function.equals(Function.named("add"))).toBe(true);
    expect(b.function.equals(ADD)).toBe(true);
    expect(Request.from(ADD, ARID_1).function.equals(ADD)).toBe(true);
    expect(b.toEnvelope().format()).toBe(
      "request(ARID(c66be27d)) [\n    'body': «add» [\n        ❰lhs❱: 2\n        ❰rhs❱: 3\n    ]\n]",
    );
  });

  it("round-trips through an envelope and checks the expected function", () => {
    const req = Request.from(add(2, 3), ARID_1).withNote("n").withDate(new Date(1657512000000));
    const env = req.toEnvelope();
    const back = Request.fromEnvelope(env);
    expect(back.equals(req)).toBe(true);
    expect(back.note).toBe("n");
    expect(back.date?.getTime()).toBe(1657512000000);
    expect(Request.fromEnvelope(env, ADD).id.equals(ARID_1)).toBe(true);
    // The mismatch text is the reference's: `Expected function {expected:?}, but found
    // {found:?}` under the `dcbor error: ` prefix of `Request`'s conversion; the decoded
    // function carries no name.
    expect(() => Request.fromEnvelope(env, Function.named("other"))).toThrow(
      'dcbor error: Expected function Named(Dynamic("other")), but found Known(1, None)',
    );
    expect(() => Request.fromEnvelope(Envelope.from("Alice"))).toThrow(
      "no assertion matches the predicate",
    );
    expect(String(back)).toContain("Request(");
  });
});

describe("Response", () => {
  it("success carries a result", () => {
    const r = Response.success(ARID_1).withResult(5);
    expect(r.isOk()).toBe(true);
    expect(r.isErr()).toBe(false);
    expect(r.id?.equals(ARID_1)).toBe(true);
    expect(r.expectId().equals(ARID_1)).toBe(true);
    expect(r.result.expectNumber()).toBe(5);
    expect(() => r.error).toThrow(EnvelopeError);
    expect(r.toEnvelope().format()).toBe("response(ARID(c66be27d)) [\n    'result': 5\n]");
    expect(Response.success(ARID_1).result.digest().equals(Response.OK.digest())).toBe(true);
  });

  it("failure carries an error, early failure has no id", () => {
    const r = Response.failure(ARID_2).withError("failed");
    expect(r.isErr()).toBe(true);
    expect(r.error.expectString()).toBe("failed");
    expect(() => r.result).toThrow(EnvelopeError);
    expect(r.toEnvelope().format()).toBe("response(ARID(11111111)) [\n    'error': \"failed\"\n]");
    const early = Response.earlyFailure();
    expect(early.id).toBeUndefined();
    expect(() => early.expectId()).toThrow(EnvelopeError);
    expect(early.error.digest().equals(Response.UNKNOWN.digest())).toBe(true);
    expect(early.toEnvelope().format()).toBe("response('Unknown') [\n    'error': 'Unknown'\n]");
    expect(
      Response.failure(ARID_2)
        .withOptionalError(undefined)
        .error.digest()
        .equals(Response.UNKNOWN.digest()),
    ).toBe(true);
    expect(Response.success(ARID_1).withOptionalResult(undefined).result.isNull()).toBe(true);
    expect(() => Response.success(ARID_1).withError("x")).toThrow(EnvelopeError);
    expect(() => Response.failure(ARID_1).withResult("x")).toThrow(EnvelopeError);
  });

  it("round-trips through an envelope", () => {
    for (const r of [
      Response.success(ARID_1).withResult(5),
      Response.failure(ARID_2).withError("failed"),
      Response.earlyFailure(),
    ]) {
      const back = Response.fromEnvelope(r.toEnvelope());
      expect(back.equals(r)).toBe(true);
      expect(back.summary()).toBeTypeOf("string");
      expect(String(back)).toContain("Response(");
    }
    expect(() => Response.fromEnvelope(Envelope.from("Alice"))).toThrow(EnvelopeError);
  });
});

describe("Event", () => {
  it("builds, formats and reads back", () => {
    const ev = Event.from("hello", ARID_1).withNote("n").withDate(new Date(1657512000000));
    expect(ev.content).toBe("hello");
    expect(ev.id.equals(ARID_1)).toBe(true);
    expect(ev.note).toBe("n");
    expect(ev.date?.getTime()).toBe(1657512000000);
    expect(ev.summary()).toContain("hello");
    const env = ev.toEnvelope();
    expect(env.format()).toBe(
      "event(ARID(c66be27d)) [\n    'content': \"hello\"\n    'date': 2022-07-11T04:00:00Z\n    'note': \"n\"\n]",
    );
    const back = Event.fromEnvelope(env, (e) => e.expectString());
    expect(back.equals(ev)).toBe(true);
    expect(String(back)).toContain("Event(");
    expect(() => Event.fromEnvelope(Envelope.from("Alice"), (e) => e.expectString())).toThrow(
      EnvelopeError,
    );
  });
});

describe("debug renderings follow the reference's Display (D4 closed)", () => {
  it("Function.toString(): name or number; named in quotes", () => {
    expect(String(Function.known(1, "add"))).toBe("add");
    expect(String(Function.known(99))).toBe("99");
    expect(String(Function.named("greet"))).toBe('"greet"');
    // The «…» form is the format context's, unchanged.
    expect(Function.named("greet").toEnvelope().format()).toBe('«"greet"»');
  });
  it("Parameter.toString(): name or number; named in quotes; a carried value appended", () => {
    expect(String(Parameter.known(2, "lhs"))).toBe("lhs");
    expect(String(Parameter.known(77))).toBe("77");
    expect(String(Parameter.named("x"))).toBe('"x"');
    expect(String(Parameter.from("x", "y"))).toBe('"x": y');
  });
  it("Expression.toString(): the quoted format string", () => {
    const e = new Expression(ADD).withParameter(LHS.id, 2);
    expect(String(e)).toBe(JSON.stringify(e.toEnvelope().format()));
    expect(String(e).startsWith('"«add»')).toBe(true);
  });
  it("Response.summary(): no comma before `error:` on the failure branches", () => {
    const id = ARID_1;
    expect(Response.success(id).withResult(42).summary()).toBe("id: c66be27d, result: 42");
    expect(Response.failure(id).withError("e").summary()).toBe('id: c66be27d error: "e"');
    expect(Response.earlyFailure().withError("e").summary()).toBe("id: 'Unknown' error: \"e\"");
  });
});

const ARID_7 = ARID.from(new Uint8Array(32).fill(7));
/** `throw:<code>:<message>` of a call, or `ok`. */
const outcome = (f: () => unknown): string => {
  try {
    f();
    return "ok";
  } catch (e) {
    const x = e as { code?: string; message: string };
    return `throw:${x.code ?? "?"}:${x.message}`;
  }
};
const ID_DOMAIN = "an integer in [0, 9007199254740991] or a bigint in [0, 18446744073709551615]";
/** A request envelope whose subject and body are built from raw parts. */
const rawRequest = (
  body: Envelope,
  id: Envelope = Envelope.leaf(taggedValue(40004, ARID_7.toCbor())),
): Envelope => id.addAssertion(BODY, body);

describe("function and parameter ids are the reference's u64", () => {
  it("accepts safe numbers and bigints up to 2^64 - 1, rejects the rest", () => {
    expect(Function.known(2 ** 53 - 1).value).toBe(2 ** 53 - 1);
    expect(Function.known(2n ** 53n + 1n).value).toBe(2n ** 53n + 1n);
    expect(Function.known(2n ** 60n).valueBigInt).toBe(2n ** 60n);
    expect(Function.known(2n ** 64n - 1n).id).toBe(2n ** 64n - 1n);
    expect(Function.known(5n).value).toBe(5);
    expect(Parameter.known(2n ** 64n - 1n).valueBigInt).toBe(2n ** 64n - 1n);
    expect(Parameter.from(2n ** 60n).id).toBe(2n ** 60n);
    expect(Function.named("f").valueBigInt).toBeUndefined();
    expect(outcome(() => Function.known(-1))).toBe(
      `throw:InvalidParameter:value must be ${ID_DOMAIN}, got -1`,
    );
    expect(outcome(() => Function.known(1.5))).toBe(
      `throw:InvalidParameter:value must be ${ID_DOMAIN}, got 1.5`,
    );
    expect(outcome(() => Function.known(2 ** 53))).toBe(
      `throw:InvalidParameter:value must be ${ID_DOMAIN}, got 9007199254740992`,
    );
    expect(outcome(() => Function.known(2n ** 64n))).toBe(
      `throw:InvalidParameter:value must be ${ID_DOMAIN}, got 18446744073709551616n`,
    );
    expect(outcome(() => Parameter.known(-1n))).toBe(
      `throw:InvalidParameter:value must be ${ID_DOMAIN}, got -1n`,
    );
    expect(outcome(() => Parameter.from(1.5))).toBe(
      `throw:InvalidParameter:id must be ${ID_DOMAIN}, got 1.5`,
    );
    expect(Function.known(1n).equals(Function.known(1))).toBe(true);
    expect(Function.from(2n ** 60n).equals(Function.known(2n ** 60n))).toBe(true);
  });

  it("encodes the exact id and round-trips ids above 2^53 through an envelope", () => {
    const f = Function.known(2n ** 64n - 1n);
    const e = new Expression(f).withParameter(Parameter.known(2n ** 64n - 1n), 1).toEnvelope();
    expect(Buffer.from(e.toCbor().toData()).toString("hex")).toBe(
      "d8c882d8c9d99c461bffffffffffffffffa1d8c9d99c471bffffffffffffffffd8c901",
    );
    const back = Expression.fromEnvelope(Envelope.fromBytes(e.toCbor().toData()));
    expect(back.function.valueBigInt).toBe(2n ** 64n - 1n);
    expect(back.parameters.map((p) => p.valueBigInt)).toEqual([2n ** 64n - 1n]);
    expect(back.objectsForParameter(2n ** 64n - 1n).length).toBe(1);
    for (const id of [2n ** 53n + 1n, 2n ** 60n]) {
      const req = Request.from(Function.known(id), ARID_1).withParameter(id, "v");
      const rt = Request.fromEnvelope(Envelope.fromBytes(req.toEnvelope().toCbor().toData()));
      expect(rt.function.valueBigInt).toBe(id);
      expect(rt.body.parameter(id)?.expectString()).toBe("v");
      expect(rt.equals(req)).toBe(true);
    }
    // The wire bytes of small ids are unchanged.
    expect(Buffer.from(ADD.toCbor().toData()).toString("hex")).toBe("d99c4601");
    expect(Buffer.from(Parameter.named("x").toCbor().toData()).toString("hex")).toBe("d99c476178");
  });

  it("decodes the reference's untagged forms and rejects the rest", () => {
    expect(Function.fromUntaggedCbor(cbor(1)).equals(Function.known(1))).toBe(true);
    expect(Function.fromUntaggedCbor(cbor("f")).equals(Function.named("f"))).toBe(true);
    expect(outcome(() => Function.fromUntaggedCbor(cbor(-1)))).toBe(
      "throw:Custom:invalid function",
    );
    expect(outcome(() => Function.fromUntaggedCbor(cbor(1.5)))).toBe(
      "throw:Custom:invalid function",
    );
    expect(outcome(() => Parameter.fromUntaggedCbor(cbor(new Uint8Array([0]))))).toBe(
      "throw:Custom:invalid parameter",
    );
    expect(Function.fromCbor(ADD.toCbor()).equals(ADD)).toBe(true);
    expect(Parameter.fromCbor(LHS.toCbor()).equals(LHS)).toBe(true);
    expect(Function.codec.decode(Function.codec.encode(ADD)).equals(ADD)).toBe(true);
    expect(outcome(() => Function.fromCbor(cbor(1)))).toBe(
      "throw:WrongType:the decoded CBOR value was not the expected type",
    );
    expect(outcome(() => Function.fromCbor(LHS.toCbor()))).toMatch(
      /^throw:WrongTag:expected CBOR tag (function|40006), but got (parameter|40007)$/,
    );
  });
});

describe("expression decoding follows the reference", () => {
  // The bare `dcbor::Error` of `Expression::try_from`, and the `dcbor error: ` prefix
  // of `Request`'s conversion. A body whose subject is not a leaf is `invalid format`;
  // a leaf that is not a function nests the dcbor text once more.
  const fn = (content: ReturnType<typeof cbor>): Envelope =>
    Envelope.leaf(taggedValue(40006, content));
  it("Expression.fromEnvelope: bare dcbor texts", () => {
    expect(outcome(() => Expression.fromEnvelope(Envelope.knownValue(4)))).toBe(
      "throw:Cbor:invalid format",
    );
    expect(outcome(() => Expression.fromEnvelope(fn(cbor(-1))))).toBe(
      "throw:Cbor:dcbor error: invalid function",
    );
    expect(outcome(() => Expression.fromEnvelope(fn(cbor(new Uint8Array([0])))))).toBe(
      "throw:Cbor:dcbor error: invalid function",
    );
    expect(outcome(() => Expression.fromEnvelope(Envelope.from(1)))).toBe(
      "throw:Cbor:dcbor error: the decoded CBOR value was not the expected type",
    );
    expect(outcome(() => Expression.fromEnvelope(Function.named("f").toEnvelope().wrap()))).toBe(
      "throw:Cbor:invalid format",
    );
    expect(
      outcome(() => Expression.fromEnvelope(add(1, 2).toEnvelope(), Function.named("f"))),
    ).toBe('throw:Cbor:Expected function Named(Dynamic("f")), but found Known(1, None)');
  });

  it("Request.fromEnvelope: the reference's prefixed texts", () => {
    expect(outcome(() => Request.fromEnvelope(rawRequest(Envelope.knownValue(4))))).toBe(
      "throw:Cbor:dcbor error: invalid format",
    );
    expect(outcome(() => Request.fromEnvelope(rawRequest(fn(cbor(new Uint8Array([0]))))))).toBe(
      "throw:Cbor:dcbor error: dcbor error: invalid function",
    );
    expect(outcome(() => Request.fromEnvelope(rawRequest(fn(cbor(-1)))))).toBe(
      "throw:Cbor:dcbor error: dcbor error: invalid function",
    );
    expect(outcome(() => Request.fromEnvelope(rawRequest(Envelope.from(1))))).toBe(
      "throw:Cbor:dcbor error: dcbor error: the decoded CBOR value was not the expected type",
    );
    expect(
      outcome(() => Request.fromEnvelope(rawRequest(Function.named("f").toEnvelope().wrap()))),
    ).toBe("throw:Cbor:dcbor error: invalid format");
    // The expected function's `Debug`: the module constants carry `Static` names, a
    // user-supplied name is `Dynamic`, a nameless known function is `None`.
    const env = Request.from(add(2, 3), ARID_1).toEnvelope();
    expect(outcome(() => Request.fromEnvelope(env, Function.known(2)))).toBe(
      "throw:Cbor:dcbor error: Expected function Known(2, None), but found Known(1, None)",
    );
    expect(outcome(() => Request.fromEnvelope(env, Function.known(2, "sub")))).toBe(
      'throw:Cbor:dcbor error: Expected function Known(2, Some(Dynamic("sub"))), but found Known(1, None)',
    );
    expect(outcome(() => Request.fromEnvelope(env, SUB))).toBe(
      'throw:Cbor:dcbor error: Expected function Known(2, Some(Static("sub"))), but found Known(1, None)',
    );
    const named = Request.from("f", ARID_1).toEnvelope();
    expect(outcome(() => Request.fromEnvelope(named, ADD))).toBe(
      'throw:Cbor:dcbor error: Expected function Known(1, Some(Static("add"))), but found Named(Dynamic("f"))',
    );
    expect(outcome(() => Request.fromEnvelope(Envelope.from("x")))).toBe(
      "throw:NonexistentPredicate:no assertion matches the predicate",
    );
    expect(
      outcome(() =>
        Request.fromEnvelope(rawRequest(Function.named("f").toEnvelope()).addAssertion(BODY, "g")),
      ),
    ).toBe("throw:AmbiguousPredicate:more than one assertion matches the predicate");
  });

  it("the id: TAG_REQUEST over an ARID, as bare tag numbers", () => {
    const body = Function.named("f").toEnvelope();
    expect(outcome(() => Request.fromEnvelope(rawRequest(body, Envelope.from(1))))).toBe(
      "throw:Cbor:dcbor error: the decoded CBOR value was not the expected type",
    );
    expect(outcome(() => Request.fromEnvelope(rawRequest(body, Envelope.from("s").wrap())))).toBe(
      "throw:NotLeaf:the envelope's subject is not a leaf",
    );
    // A decoded subject carries no tag name: the wrong tag prints as its number.
    const decoded = Envelope.fromBytes(rawRequest(body, Envelope.from(ARID_7)).toCbor().toData());
    expect(outcome(() => Request.fromEnvelope(decoded))).toBe(
      "throw:Cbor:dcbor error: expected CBOR tag 40004, but got 40012",
    );
    expect(
      outcome(() => Request.fromEnvelope(rawRequest(body, Envelope.leaf(taggedValue(40004, "x"))))),
    ).toBe("throw:Cbor:dcbor error: the decoded CBOR value was not the expected type");
    expect(
      outcome(() =>
        Request.fromEnvelope(
          rawRequest(
            body,
            Envelope.leaf(taggedValue(40004, taggedValue(40012, new Uint8Array(31).fill(1)))),
          ),
        ),
      ),
    ).toBe("throw:Cbor:dcbor error: invalid ARID size: expected 32, got 31");
    // An in-memory Request handed to Response.fromEnvelope with a result: the request
    // tag is reported by number, never by name.
    const req = Request.from(add(2, 3), ARID_1).toEnvelope().addAssertion(RESULT, "ok");
    expect(outcome(() => Response.fromEnvelope(req))).toBe(
      "throw:Cbor:dcbor error: expected CBOR tag 40005, but got 40004",
    );
    expect(outcome(() => Response.fromEnvelope(Envelope.fromBytes(req.toCbor().toData())))).toBe(
      "throw:Cbor:dcbor error: expected CBOR tag 40005, but got 40004",
    );
    expect(outcome(() => Response.fromEnvelope(Request.from(add(2, 3), ARID_1).toEnvelope()))).toBe(
      "throw:InvalidResponse:invalid response",
    );
    expect(
      outcome(() =>
        Event.fromEnvelope(
          Envelope.leaf(taggedValue(40004, ARID_7.toCbor())).addAssertion(CONTENT, "c"),
          (e) => e.expectString(),
        ),
      ),
    ).toBe("throw:Cbor:dcbor error: expected CBOR tag 40026, but got 40004");
    expect(outcome(() => Response.earlyFailure().expectId())).toBe(
      "throw:General:general error: Expected an ID",
    );
  });

  it("'note' and 'date' by subject extraction", () => {
    const base = Request.from("f", ARID_7).toEnvelope();
    const note = (o: Envelope): string =>
      outcome(() => Request.fromEnvelope(base.addAssertion(NOTE, o)).note);
    expect(
      Request.fromEnvelope(base.addAssertion(NOTE, Envelope.from("hi").addAssertion("k", "v")))
        .note,
    ).toBe("hi");
    expect(note(Envelope.from("hi").wrap())).toBe("throw:InvalidFormat:invalid format");
    expect(note(Envelope.from(5))).toBe(
      "throw:Cbor:dcbor error: the decoded CBOR value was not the expected type",
    );
    const date = (o: Envelope): string =>
      outcome(() => Request.fromEnvelope(base.addAssertion(DATE, o)).date);
    expect(
      Request.fromEnvelope(
        base.addAssertion(DATE, Envelope.from(new Date(1000)).addAssertion("k", "v")),
      ).date?.getTime(),
    ).toBe(1000);
    expect(date(Envelope.from(new Date(1000)).wrap())).toBe("throw:InvalidFormat:invalid format");
    expect(date(Envelope.from(5))).toBe(
      "throw:Cbor:dcbor error: the decoded CBOR value was not the expected type",
    );
    const evBase = Envelope.leaf(taggedValue(40026, ARID_7.toCbor())).addAssertion(CONTENT, "c");
    expect(
      outcome(() => Event.fromEnvelope(evBase.addAssertion(NOTE, 5), (e) => e.expectString())),
    ).toBe("throw:Cbor:dcbor error: the decoded CBOR value was not the expected type");
    expect(
      outcome(() => Event.fromEnvelope(evBase.addAssertion(CONTENT, "d"), (e) => e.expectString())),
    ).toBe("throw:AmbiguousPredicate:more than one assertion matches the predicate");
    expect(
      outcome(() =>
        Event.fromEnvelope(
          Envelope.leaf(taggedValue(40026, ARID_7.toCbor())).addAssertion(CONTENT, 5),
          (e) => e.expectString(),
        ),
      ),
    ).toBe("throw:General:general error: Failed to parse content");
  });

  it("parameters are read through the envelope", () => {
    const e = new Expression(Function.named("f"))
      .withParameter("a", 1)
      .withParameter("a", 2)
      .withParameter("b", 3);
    expect(e.objectsForParameter("a").map((o) => o.expectNumber())).toEqual([1, 2]);
    expect(outcome(() => e.objectForParameter("a"))).toBe(
      "throw:AmbiguousPredicate:more than one assertion matches the predicate",
    );
    expect(outcome(() => e.parameter("a"))).toBe(
      "throw:AmbiguousPredicate:more than one assertion matches the predicate",
    );
    expect(outcome(() => e.objectForParameter("c"))).toBe(
      "throw:NonexistentPredicate:no assertion matches the predicate",
    );
    expect(e.parameter("c")).toBeUndefined();
    expect(e.objectForParameter("b").expectNumber()).toBe(3);
    expect(e.hasParameter("b")).toBe(true);
    expect(e.hasParameter("c")).toBe(false);
    // A repeated assertion is not added twice.
    expect(e.withParameter("a", 1).objectsForParameter("a").length).toBe(2);
    // A known id and a name never match each other.
    const g = new Expression(Function.named("g"))
      .withParameter(7, "known")
      .withParameter("7", "named");
    expect(g.objectForParameter(7).expectString()).toBe("known");
    expect(g.objectForParameter("7").expectString()).toBe("named");
    expect(g.objectForParameter(Parameter.known(7)).expectString()).toBe("known");
    // Assertions are sorted by digest, so the parameters come in digest order.
    expect(g.parameters.map((p) => String(p.id))).toEqual(["7", "7"]);
    expect(g.parameters.map((p) => p.isKnown()).sort()).toEqual([false, true]);
    // A non-parameter assertion survives the round trip and is not a parameter.
    const withNote = e.toEnvelope().addAssertion("note", "x");
    const back = Expression.fromEnvelope(withNote);
    expect(back.toEnvelope().digest().equals(withNote.digest())).toBe(true);
    expect(back.parameters.length).toBe(3);
    expect(back.toEnvelope().assertions().length).toBe(4);
    expect(String(e)).toBe(
      '"«\\"f\\"» [\\n    ❰\\"a\\"❱: 1\\n    ❰\\"a\\"❱: 2\\n    ❰\\"b\\"❱: 3\\n]"',
    );
  });
});

describe("the reference's Debug rendering of names", () => {
  it("escapes as <str as Debug> does", () => {
    const rows: [string, string][] = [
      ["'", '"\'"'],
      ['"', '"\\""'],
      ["\\", '"\\\\"'],
      ["\t", '"\\t"'],
      ["\n", '"\\n"'],
      ["\r", '"\\r"'],
      ["\0", '"\\0"'],
      ["\u{feff}", '"\\u{feff}"'],
      ["\u{7f}", '"\\u{7f}"'],
      ["\u{a0}", '"\\u{a0}"'],
      ["\u{200d}", '"\\u{200d}"'],
      ["\u{10ffff}", '"\\u{10ffff}"'],
      ["a\u{301}", '"a\\u{301}"'],
      ["\u{301}a", '"\\u{301}a"'],
      ["é", '"é"'],
      ["日本", '"日本"'],
      ["\u{1f600}", '"\u{1f600}"'],
      ["\u{2028}", '"\\u{2028}"'],
      ["\u{e000}", '"\\u{e000}"'],
      ["\u{ad}", '"\\u{ad}"'],
      ["\u{2060}", '"\\u{2060}"'],
      ["\u{200b}", '"\\u{200b}"'],
      ["\u{fe0f}", '"\\u{fe0f}"'],
      ["a b", '"a b"'],
    ];
    for (const [input, expected] of rows) expect(rustDebugString(input)).toBe(expected);
  });
});

describe("Request and Event keep the decoded CborDate", () => {
  const body = Function.named("f").toEnvelope();
  const dateLeaf = (hex: string): Envelope => Envelope.leaf(decodeCbor(unhex(hex)));
  const rows: [string, string, string, string][] = [
    // date hex, request digest, event digest, re-encoded date hex
    [
      "c1fb3ff000001ad7f29b",
      "75abfcf9ceb4973e1dc3de9c0842ca1f35c21199f4ad3970840144b3af04f9ac",
      "cf9ad0be7ba66cbc15753fed3e92120cc91f91f67c26e598aaf013ffccd13a13",
      "c1fb3ff000001ad7f29b",
    ],
    [
      "c1fb41d96285e007e6b4",
      "eb23892b823ae9f5f0174e187b349c3d349f3b686400c225f0223faeeca1945f",
      "06b951d9c2baf6d0cfff72f0896998f2544d1141ae36b65711bea23276162c18",
      "c1fb41d96285e007e6b4",
    ],
    [
      "c100",
      "2f6348ec09ef9b42232f3a3650c5a17bcfb7d364fcc4de956fd6d64a9b03bd4a",
      "c6ce9faed5365ac7a8e6cd8588344857a4ff1ac1f4e20d86208d2cac85222105",
      "c100",
    ],
    [
      "c13b000007948cf211ff",
      "e2938ad9eae35af30506e423a50fcfe6efb90c37bb0e81cd82452b09788e952d",
      "0aae1a6a799ffceb0f0889b90a83fd5cffe5d722e4b0f40d669e7c7df2eb521b",
      "c13b000007948cf211ff",
    ],
  ];
  it("re-encodes a decoded request and event with the reference's bytes", () => {
    for (const [hex, reqDigest, evDigest, back] of rows) {
      const reqEnv = rawRequest(body).addAssertion(DATE, dateLeaf(hex));
      expect(reqEnv.digest().toHex()).toBe(reqDigest);
      const req = Request.fromEnvelope(Envelope.fromBytes(reqEnv.toCbor().toData()));
      const re = req.toEnvelope();
      expect(re.digest().toHex()).toBe(reqDigest);
      expect(Buffer.from(re.objectForPredicate(DATE).expectLeaf().toData()).toString("hex")).toBe(
        back,
      );
      const evEnv = Envelope.leaf(taggedValue(40026, ARID_7.toCbor()))
        .addAssertion(CONTENT, "c")
        .addAssertion(DATE, dateLeaf(hex));
      expect(evEnv.digest().toHex()).toBe(evDigest);
      const ev = Event.fromEnvelope(Envelope.fromBytes(evEnv.toCbor().toData()), (e) =>
        e.expectString(),
      );
      expect(ev.toEnvelope().digest().toHex()).toBe(evDigest);
      expect(ev.cborDate?.equals(CborDate.fromTaggedCbor(decodeCbor(unhex(hex))))).toBe(true);
    }
  });
  it("withDate takes a CborDate or a Date; date is the millisecond view", () => {
    const leap = CborDate.fromString("2023-12-25T23:59:60.5Z");
    const req = Request.from("f", ARID_7).withDate(leap);
    expect(
      Buffer.from(req.toEnvelope().objectForPredicate(DATE).expectLeaf().toData()).toString("hex"),
    ).toBe("c1fb41d96285e0200000");
    expect(req.cborDate?.equals(leap)).toBe(true);
    expect(req.date).toEqual(leap.toDate());
    const ev = Event.from("c", ARID_7).withDate(new Date(1657512000000));
    expect(ev.cborDate?.equals(CborDate.fromDate(new Date(1657512000000)))).toBe(true);
    expect(ev.date?.getTime()).toBe(1657512000000);
    const a = Request.from("f", ARID_7).withDate(CborDate.fromEpochSeconds(1.0000001));
    const b = Request.from("f", ARID_7).withDate(CborDate.fromEpochSeconds(1.0));
    expect(a.equals(b)).toBe(false);
    expect(a.equals(Request.from("f", ARID_7).withDate(CborDate.fromEpochSeconds(1.0000001)))).toBe(
      true,
    );
    expect(Request.from("f", ARID_7).equals(Request.from("g", ARID_7))).toBe(false);
  });
});
