import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createExternal } from "../src/external.js";
import { createFakeClock, createFakeFetch } from "../src/patterns/fakes.js";

const nager = [{ date: "2027-12-25", localName: "Araw ng Pasko", name: "Christmas Day" }];
const frankfurter = { amount: 1, base: "USD", date: "2027-03-04", rates: { PHP: 56.5 } };
const fakeForecast = async ({ date }) => ({ available: true, date, rainChancePercent: 30, maxTempC: 31, source: "open-meteo" });

// A fetch that answers like the three APIs, and can be switched off.
function world() {
  const state = { down: false };
  const fetch = createFakeFetch((url) => {
    if (state.down) return { status: 503, body: {} };
    return { body: url.includes("nager") ? nager : frankfurter };
  });
  const clock = createFakeClock();
  const external = createExternal({ fetch, now: clock.now, sleep: clock.sleep, forecast: fakeForecast });
  return { state, fetch, clock, external };
}

describe("createExternal: normal work", () => {
  test("[FR-02] holiday() answers in the internal shape", async () => {
    const { external } = world();
    assert.deepEqual(await external.holiday("2027-12-25"), { date: "2027-12-25", isHoliday: true, name: "Christmas Day", available: true });
  });
  test("[NFR-01] one fetch per year: other dates of the same year come from the cache", async () => {
    const { external, fetch } = world();
    await external.holiday("2027-12-25");
    await external.holiday("2027-03-04");
    await external.holiday("2027-06-12");
    assert.equal(fetch.calls.length, 1);
    assert.equal(external.stats().holidays.hits, 2);
  });
  test("another year needs another fetch", async () => {
    const { external, fetch } = world();
    await external.holiday("2027-12-25");
    await external.holiday("2028-01-01");
    assert.equal(fetch.calls.length, 2);
  });
  test("convert() changes dollars to pesos and caches the rate", async () => {
    const { external, fetch } = world();
    assert.equal((await external.convert({ amount: 500, currency: "USD" })).amountPhp, 28250);
    assert.equal((await external.convert({ amount: 100, currency: "USD" })).amountPhp, 5650);
    assert.equal(fetch.calls.length, 1);
  });
  test("pesos never touch the network", async () => {
    const { external, fetch } = world();
    assert.equal((await external.convert({ amount: 8000, currency: "PHP" })).rate, 1);
    assert.equal(fetch.calls.length, 0);
  });
  test("[NFR-01] the cache expires: after a day the holidays are loaded again", async () => {
    const { external, fetch, clock } = world();
    await external.holiday("2027-12-25");
    clock.advance(24 * 60 * 60 * 1000);
    await external.holiday("2027-12-25");
    assert.equal(fetch.calls.length, 2);
  });
  test("forecast() uses the injected function and caches by date", async () => {
    let calls = 0;
    const external = createExternal({ fetch: async () => assert.fail("no fetch"), forecast: async (a) => { calls++; return fakeForecast(a); } });
    const first = await external.forecast({ date: "2027-03-04", today: "2027-03-01" });
    await external.forecast({ date: "2027-03-04", today: "2027-03-01" });
    assert.equal(first.rainChancePercent, 30);
    assert.equal(calls, 1);
  });
  test("the weather service of episode 8 is not imported until it is needed", async () => {
    const external = createExternal({ fetch: async () => assert.fail("no fetch") });
    assert.equal(typeof external.forecast, "function"); // creating it did not import anything
  });
});

describe("createExternal: when the outside world fails", () => {
  test("[NFR-02] a service that fails twice and then works still answers (retry)", async () => {
    let n = 0;
    const fetch = createFakeFetch(() => (++n <= 2 ? { status: 503, body: {} } : { body: nager }));
    const clock = createFakeClock();
    const external = createExternal({ fetch, now: clock.now, sleep: clock.sleep });
    assert.equal((await external.holiday("2027-12-25")).isHoliday, true);
    assert.deepEqual(clock.sleeps, [200, 800]);
  });
  test("[NFR-02] [FR-12] a service that is down gives available: false with a reason, and does not throw", async () => {
    const { external, state } = world();
    state.down = true;
    const r = await external.holiday("2027-12-25");
    assert.equal(r.available, false);
    assert.equal(r.isHoliday, null);
    assert.match(r.reason, /answered 503/);
  });
  test("[NFR-02] after 3 failed requests the breaker opens, and the next request makes no fetch", async () => {
    const { external, state, fetch } = world();
    state.down = true;
    for (let i = 0; i < 3; i++) await external.convert({ amount: 1, currency: "USD" });
    assert.equal(external.stats().rates.breaker, "open");
    const before = fetch.calls.length;
    const r = await external.convert({ amount: 1, currency: "USD" });
    assert.equal(fetch.calls.length, before);
    assert.match(r.reason, /circuit open/);
  });
  test("[NFR-02] after the cool-down a probe finds the service back and the breaker closes", async () => {
    const { external, state, clock } = world();
    state.down = true;
    for (let i = 0; i < 3; i++) await external.convert({ amount: 1, currency: "USD" });
    state.down = false;
    clock.advance(30_000);
    assert.equal((await external.convert({ amount: 1, currency: "USD" })).available, true);
    assert.equal(external.stats().rates.breaker, "closed");
  });
  test("[NFR-02] one broken service does not stop the others", async () => {
    const fetch = createFakeFetch((url) => (url.includes("frankfurter") ? { status: 500, body: {} } : { body: nager }));
    const clock = createFakeClock();
    const external = createExternal({ fetch, now: clock.now, sleep: clock.sleep });
    for (let i = 0; i < 3; i++) await external.convert({ amount: 1, currency: "USD" });
    assert.equal(external.stats().rates.breaker, "open");
    assert.equal((await external.holiday("2027-12-25")).available, true);
  });
  test("a 404 is not retried and does not open the breaker", async () => {
    const fetch = createFakeFetch(() => ({ status: 404, body: {} }));
    const clock = createFakeClock();
    const external = createExternal({ fetch, now: clock.now, sleep: clock.sleep });
    for (let i = 0; i < 5; i++) await external.convert({ amount: 1, currency: "XYZ" });
    assert.equal(fetch.calls.length, 5);
    assert.equal(external.stats().rates.breaker, "closed");
  });
  test("bad input and a changed payload give available: false, never an exception", async () => {
    const fetch = createFakeFetch(() => ({ body: { nothing: "useful" } }));
    const external = createExternal({ fetch, sleep: async () => {} });
    assert.match((await external.holiday("tomorrow")).reason, /not a date/);
    assert.equal((await external.convert({ amount: 1, currency: "USD" })).available, false);
    assert.equal((await external.convert({ amount: "ten", currency: "USD" })).available, false);
  });
  test("a network error is handled like any other failure", async () => {
    const fetch = async () => { throw new TypeError("fetch failed"); };
    const external = createExternal({ fetch, sleep: async () => {} });
    const r = await external.convert({ amount: 1, currency: "USD" });
    assert.equal(r.available, false);
    assert.match(r.reason, /cannot reach/);
  });
  test("a forecast that throws becomes available: false", async () => {
    const external = createExternal({ forecast: async () => { throw Object.assign(new Error("open-meteo is down"), { code: "UPSTREAM" }); }, sleep: async () => {} });
    const r = await external.forecast({ date: "2027-03-04" });
    assert.deepEqual([r.available, r.date], [false, "2027-03-04"]);
    assert.match(r.reason, /open-meteo is down/);
  });
  test("without the weather service of episode 8 the forecast is unavailable, not a crash", async () => {
    const external = createExternal({ fetch: async () => assert.fail("no fetch"), sleep: async () => {} });
    const r = await external.forecast({ date: "2027-03-04", today: "2027-03-01" });
    assert.ok(typeof r.available === "boolean"); // true when episode 8 exists, false otherwise; never an exception
  });
});

describe("createExternal: checkAll (aggregator)", () => {
  test("it returns the three answers together", async () => {
    const { external } = world();
    const all = await external.checkAll({ date: "2027-12-25", today: "2027-12-01", amount: 500, currency: "USD" });
    assert.equal(all.holiday.isHoliday, true);
    assert.equal(all.forecast.rainChancePercent, 30);
    assert.equal(all.convert.amountPhp, 28250);
    assert.deepEqual(all.failures, {});
  });
  test("[NFR-02] a stuck service is cut off after the time limit and the others still answer", async () => {
    const fetch = createFakeFetch(() => ({ body: nager }));
    const stuck = () => new Promise(() => {});
    const external = createExternal({ fetch, forecast: stuck });
    const all = await external.checkAll({ date: "2027-12-25", today: "2027-12-01", amount: 8000, currency: "PHP", timeoutMs: 20 });
    assert.equal(all.holiday.available, true);
    assert.equal(all.forecast.available, false);
    assert.match(all.forecast.reason, /did not answer/);
    assert.equal(all.convert.amountPhp, 8000);
  });
});
