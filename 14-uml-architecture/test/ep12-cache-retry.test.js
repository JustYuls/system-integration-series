import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createCache } from "../src/patterns/cache.js";
import { createFakeClock } from "../src/patterns/fakes.js";
import { retry } from "../src/patterns/retry.js";

describe("cache-aside", () => {
  const setup = (ttlMs = 1000) => {
    const clock = createFakeClock();
    let loads = 0;
    const loader = async () => ++loads;
    return { clock, cache: createCache({ ttlMs, now: clock.now }), loader, loads: () => loads };
  };

  test("the first call is a miss and loads from the source", async () => {
    const { cache, loader, loads } = setup();
    assert.equal(await cache.getOrLoad("a", loader), 1);
    assert.equal(loads(), 1);
  });
  test("a second call within the TTL is a hit: no new load", async () => {
    const { cache, loader, loads } = setup();
    await cache.getOrLoad("a", loader);
    assert.equal(await cache.getOrLoad("a", loader), 1);
    assert.equal(loads(), 1);
  });
  test("hits and misses are counted", async () => {
    const { cache, loader } = setup();
    for (let i = 0; i < 4; i++) await cache.getOrLoad("a", loader);
    await cache.getOrLoad("b", loader);
    assert.deepEqual(cache.stats(), { hits: 3, misses: 2, size: 2 });
  });
  test("an entry expires when the TTL has passed", async () => {
    const { clock, cache, loader } = setup(1000);
    await cache.getOrLoad("a", loader);
    clock.advance(999);
    assert.equal(await cache.getOrLoad("a", loader), 1); // still fresh
    clock.advance(1);
    assert.equal(await cache.getOrLoad("a", loader), 2); // exactly at the TTL: stale, loaded again
  });
  test("keys are independent", async () => {
    const { cache, loader } = setup();
    assert.equal(await cache.getOrLoad("a", loader), 1);
    assert.equal(await cache.getOrLoad("b", loader), 2);
  });
  test("a failing loader stores nothing, so the next call tries again", async () => {
    const { cache } = setup();
    await assert.rejects(cache.getOrLoad("a", async () => { throw new Error("down"); }), /down/);
    assert.equal(await cache.getOrLoad("a", async () => "ok"), "ok");
  });
  test("one call can use its own TTL", async () => {
    const { clock, cache, loader } = setup(1000);
    await cache.getOrLoad("a", loader, 10);
    clock.advance(10);
    assert.equal(await cache.getOrLoad("a", loader), 2);
  });
  test("clear forgets everything", async () => {
    const { cache, loader } = setup();
    await cache.getOrLoad("a", loader);
    cache.clear();
    assert.equal(cache.stats().size, 0);
  });
});

describe("retry with backoff", () => {
  const flaky = (failures) => {
    let calls = 0;
    return { fn: async () => { if (++calls <= failures) throw new Error(`fail ${calls}`); return "ok"; }, calls: () => calls };
  };

  test("a success on the first try needs no pause", async () => {
    const clock = createFakeClock();
    const f = flaky(0);
    assert.equal(await retry(f.fn, { sleep: clock.sleep }), "ok");
    assert.deepEqual(clock.sleeps, []);
  });
  test("[NFR-02] [NFR-03] a service that fails twice and then works still gives an answer", async () => {
    const clock = createFakeClock();
    const f = flaky(2);
    assert.equal(await retry(f.fn, { attempts: 3, backoffMs: [200, 800], sleep: clock.sleep }), "ok");
    assert.equal(f.calls(), 3);
  });
  test("[NFR-02] the pauses grow: 200 ms, then 800 ms", async () => {
    const clock = createFakeClock();
    await retry(flaky(2).fn, { attempts: 3, backoffMs: [200, 800], sleep: clock.sleep });
    assert.deepEqual(clock.sleeps, [200, 800]);
  });
  test("one number as backoff doubles every time", async () => {
    const clock = createFakeClock();
    await retry(flaky(3).fn, { attempts: 4, backoffMs: 100, sleep: clock.sleep });
    assert.deepEqual(clock.sleeps, [100, 200, 400]);
  });
  test("[NFR-03] after the last attempt the last error is thrown, with no pause after it", async () => {
    const clock = createFakeClock();
    const f = flaky(99);
    await assert.rejects(retry(f.fn, { attempts: 3, backoffMs: [10, 20], sleep: clock.sleep }), /fail 3/);
    assert.equal(f.calls(), 3);
    assert.equal(clock.sleeps.length, 2);
  });
  test("shouldRetry can stop the retries at once", async () => {
    const clock = createFakeClock();
    const f = flaky(99);
    await assert.rejects(retry(f.fn, { attempts: 5, sleep: clock.sleep, shouldRetry: () => false }), /fail 1/);
    assert.equal(f.calls(), 1);
  });
});
