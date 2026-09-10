/**
 * The `/expression` subpath: functions, parameters, expressions, requests,
 * responses and events, with the format strings the reference produces.
 */
import { describe, it, expect } from "vitest";
import { ARID } from "@blockchaincommons/components";
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
  LHS,
  RHS,
  add,
  neg,
  GLOBAL_FUNCTIONS,
  GLOBAL_PARAMETERS,
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
    expect(GLOBAL_FUNCTIONS.get().assignedNameOf(ADD)).toBe("add");
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
    expect(GLOBAL_PARAMETERS.get().assignedNameOf(LHS)).toBe("lhs");
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
    expect(neg(1).toEnvelope().format()).toBe("«neg» [\n    ❰_❱: 1\n]");
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
    expect(() => Request.fromEnvelope(env, Function.named("other"))).toThrow(EnvelopeError);
    expect(() => Request.fromEnvelope(Envelope.from("Alice"))).toThrow(EnvelopeError);
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
