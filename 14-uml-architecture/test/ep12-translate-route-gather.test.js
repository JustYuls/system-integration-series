import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { scatterGather, TimeoutError, withTimeout } from "../src/patterns/aggregator.js";
import { createRouter } from "../src/patterns/router.js";
import { readPath, translate, TranslationError } from "../src/patterns/translator.js";

describe("message translator", () => {
  const mapping = { rate: "rates.PHP", asOf: "date", pair: (p) => `${p.base}/PHP` };
  const upstream = { amount: 1, base: "USD", date: "2027-03-04", rates: { PHP: 56.5 }, extra: "ignored" };

  test("readPath follows a dotted path", () => assert.equal(readPath(upstream, "rates.PHP"), 56.5));
  test("it maps upstream fields to internal fields, by path or by function", () => {
    assert.deepEqual(translate(upstream, mapping), { rate: 56.5, asOf: "2027-03-04", pair: "USD/PHP" });
  });
  test("fields that are not in the mapping do not leak in", () => assert.ok(!("extra" in translate(upstream, mapping))));
  test("a missing field is an error that names the field", () => {
    assert.throws(() => translate({ date: "2027-03-04" }, mapping), (e) => e instanceof TranslationError && e.missing.includes("rates.PHP"));
  });
});

describe("content-based router", () => {
  const route = createRouter({ by: "kind", routes: { a: () => "handler A", b: () => "handler B" }, fallback: (m) => `default for ${m.kind}` });

  test("it picks the handler named by the message property", () => assert.equal(route({ kind: "b" }), "handler B"));
  test("an unknown value goes to the default", () => assert.equal(route({ kind: "z" }), "default for z"));
  test("names like constructor are not routes", () => assert.equal(route({ kind: "constructor" }), "default for constructor"));
  test("without a default, an unknown value is an error", () => {
    const strict = createRouter({ by: "kind", routes: {} });
    assert.throws(() => strict({ kind: "x" }), /no route/);
  });
});

describe("aggregator (scatter-gather)", () => {
  const never = new Promise(() => {});
  const timerThatFires = () => new Promise((resolve) => setImmediate(resolve)); // an injected timer: fires after the fast calls

  test("it collects the results of all calls", async () => {
    const r = await scatterGather({ a: async () => 1, b: async () => 2 });
    assert.deepEqual(r, { results: { a: 1, b: 2 }, failures: {} });
  });
  test("one failing call does not lose the others", async () => {
    const r = await scatterGather({ a: async () => 1, b: async () => { throw new Error("down"); } });
    assert.deepEqual(r, { results: { a: 1 }, failures: { b: "down" } });
  });
  test("the calls run in parallel, not one after another", async () => {
    const order = [];
    let releaseA;
    const a = () => new Promise((resolve) => { order.push("a started"); releaseA = resolve; });
    const b = async () => { order.push("b started"); releaseA(); return "b"; };
    await scatterGather({ a, b });
    assert.deepEqual(order, ["a started", "b started"]);
  });
  test("[NFR-02] a call that never answers is cut off by the timer", async () => {
    const r = await scatterGather({ fast: async () => "ok", stuck: () => never }, { timeoutMs: 3000, timer: (ms) => (ms === 3000 ? timerThatFires() : never) });
    assert.equal(r.results.fast, "ok");
    assert.match(r.failures.stuck, /no answer within 3000 ms/);
  });
  test("withTimeout fails with a TimeoutError; a fast answer wins the race", async () => {
    await assert.rejects(withTimeout(never, 50, timerThatFires), TimeoutError);
    assert.equal(await withTimeout(Promise.resolve("quick"), 50, () => never), "quick");
  });
});
