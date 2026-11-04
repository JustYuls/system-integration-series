import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { collect } from "../review/patterns-facts.js";

describe("the AI review of integration patterns", async () => {
  const f = await collect();
  test("finding 1: retrying with no pause sends all 5 tries in the same instant", () => {
    assert.deepEqual(f.immediateTimes, [0, 0, 0, 0, 0]);
    assert.ok(f.immediateBurst);
  });
  test("finding 1: with backoff the same 5 tries are spread over 1.5 seconds", () => {
    assert.deepEqual(f.spreadTimes, [0, 100, 300, 700, 1500]);
    assert.equal(f.backoffSpan, 1500);
  });
  test("finding 2: a cache with no expiry still has the old forecast a day later", () => assert.ok(f.foreverStale));
  test("finding 2: a 30 minute TTL has the new forecast", () => assert.ok(f.ttlFresh));
  test("[NFR-02] finding 3: a failure costs 2000 ms while closed and 0 ms while open", () => {
    assert.equal(f.closedFailMs, 2000);
    assert.equal(f.openFailMs, 0);
    assert.equal(f.breakerState, "open");
  });
  test("claim 4 is false: while open, 11 requests make 0 calls to the service", () => {
    assert.equal(f.upstreamCallsWhileOpen, 0);
    assert.equal(f.rejectedWhileOpen, 10);
  });
  test("claim 5 is true: 5 calls, 1 miss, 1 load", () => assert.deepEqual([f.cacheLoads, f.cacheHits, f.cacheMisses], [1, 4, 1]));
  test("claim 6 is false: with a one-year TTL the forecast is stale after one day", () => assert.ok(f.yearTtlStale));
});
