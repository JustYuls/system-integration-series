import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadNfr } from "../src/nfr.js";
import { feasibility, loadMeasurements, measureApi, percentile } from "../src/measure.js";

// A fake world: each call takes the next duration on a fake clock. A duration of null means the call fails.
const fake = (durations) => {
  let time = 0;
  let i = 0;
  return {
    now: () => time,
    call: async () => {
      const d = durations[i++];
      time += d ?? 5;
      if (d === null) throw new Error("down");
    },
    calls: () => i,
  };
};
const limitMs = loadNfr().find((n) => n.id === "NFR-01").target.value;

describe("percentile", () => {
  test("the 95th percentile of 10 values is the largest (nearest rank)", () => assert.equal(percentile([5, 1, 9, 3, 7, 2, 8, 4, 6, 10], 95), 10));
  test("the 50th percentile of 10 values is the fifth", () => assert.equal(percentile([5, 1, 9, 3, 7, 2, 8, 4, 6, 10], 50), 5));
  test("the 95th percentile of 100 values is the 95th", () => assert.equal(percentile(Array.from({ length: 100 }, (_, i) => i + 1), 95), 95));
  test("no values give null", () => assert.equal(percentile([], 95), null));
});

describe("measureApi with a fake clock and a fake call", () => {
  test("it reports min, average, p95 and max", async () => {
    const w = fake([100, 200, 300, 1000]);
    assert.deepEqual(await measureApi(w.call, { runs: 4, now: w.now }), { runs: 4, failures: 0, minMs: 100, avgMs: 400, p95Ms: 1000, maxMs: 1000 });
  });
  test("it calls the function once for each run", async () => {
    const w = fake([1, 1, 1, 1, 1, 1, 1]);
    await measureApi(w.call, { runs: 7, now: w.now });
    assert.equal(w.calls(), 7);
  });
  test("a call that throws is a failure and has no time", async () => {
    const w = fake([50, null, 50, null]);
    const m = await measureApi(w.call, { runs: 4, now: w.now });
    assert.deepEqual([m.runs, m.failures, m.avgMs], [4, 2, 50]);
  });
  test("when every call fails there are no times", async () => {
    const w = fake([null, null, null]);
    assert.deepEqual(await measureApi(w.call, { runs: 3, now: w.now }), { runs: 3, failures: 3, minMs: null, avgMs: null, p95Ms: null, maxMs: null });
  });
});

describe("the real measurements of the free APIs (docs/measurements.sample.json)", () => {
  const sample = loadMeasurements();
  test("Open-Meteo, Nager.Date and Frankfurter were measured, 10 runs each, with no failures", () => {
    assert.deepEqual(Object.keys(sample.apis), ["Open-Meteo", "Nager.Date", "Frankfurter"]);
    for (const m of Object.values(sample.apis)) assert.deepEqual([m.runs, m.failures], [10, 0]);
  });
  test("each row is ordered: min <= avg <= max, and p95 <= max", () => {
    for (const m of Object.values(sample.apis)) assert.ok(m.minMs <= m.avgMs && m.avgMs <= m.maxMs && m.p95Ms <= m.maxMs);
  });
  test("[NFR-01] the three calls in parallel plus 500 ms fit inside 3000 ms", () => {
    const f = feasibility(sample.apis, { limitMs });
    assert.equal(f.ok, true);
    assert.equal(f.totalMs, Math.max(...Object.values(sample.apis).map((m) => m.p95Ms)) + 500);
  });
  test("[NFR-01] one after another they add up: the time is the sum of the three", () => {
    const f = feasibility(sample.apis, { limitMs, parallel: false });
    assert.equal(f.outsideMs, Object.values(sample.apis).reduce((a, m) => a + m.p95Ms, 0));
    assert.ok(f.totalMs > limitMs);
  });
  test("[NFR-01] [NFR-03] three tries of the slowest call do not fit: reliability and speed pull against each other", () => {
    const f = feasibility(sample.apis, { limitMs, attempts: 3 });
    assert.equal(f.ok, false);
    assert.ok(f.totalMs > limitMs);
  });
  test("an API that never answered makes the plan not feasible", () => {
    const apis = { A: { p95Ms: 100 }, B: { p95Ms: null } };
    assert.deepEqual(feasibility(apis, { limitMs }), { ok: false, reason: "an outside call never answered" });
  });
  test("[NFR-01] the limit is a parameter: 1000 ms is not feasible", () => assert.equal(feasibility(sample.apis, { limitMs: 1000 }).ok, false));
});
