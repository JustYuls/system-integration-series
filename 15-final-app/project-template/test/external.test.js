// The three outside-API adapters, with a fake fetch (no internet): shapes, retry, and "never throws".
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createExternal, createFakeExternal, retry } from "../src/external.js";

// A fake fetch. handler(url, callNumber) returns { status, body } or throws.
function fakeFetch(handler) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(String(url));
    const { status = 200, body } = await handler(String(url), calls.length);
    return { ok: status < 400, status, json: async () => body };
  };
  fetch.calls = calls;
  return fetch;
}
const noWait = async () => {};

describe("the adapters read the real shapes of the free APIs", () => {
  test("Nager.Date: a holiday and an ordinary day", async () => {
    const fetch = fakeFetch(() => ({ body: [{ date: "2027-12-25", localName: "Araw ng Pasko", name: "Christmas Day" }] }));
    const outside = createExternal({ fetch, sleep: noWait });
    assert.deepEqual(await outside.holiday("2027-12-25"), { date: "2027-12-25", isHoliday: true, name: "Christmas Day", available: true });
    assert.equal((await outside.holiday("2027-03-04")).isHoliday, false);
    assert.match(fetch.calls[0], /date\.nager\.at\/api\/v3\/PublicHolidays\/2027\/PH/);
  });
  test("Open-Meteo: the rain chance of a date, or 'no forecast' beyond 16 days", async () => {
    const body = { daily: { time: ["2027-03-04", "2027-03-05"], precipitation_probability_max: [20, 80] } };
    const outside = createExternal({ fetch: fakeFetch(() => ({ body })), sleep: noWait });
    assert.equal((await outside.forecast("2027-03-05")).rainChancePercent, 80);
    const far = await outside.forecast("2028-01-01");
    assert.equal(far.available, false);
    assert.match(far.reason, /no forecast/);
  });
  test("Frankfurter: dollars to pesos; pesos need no call", async () => {
    const fetch = fakeFetch(() => ({ body: { amount: 1, base: "USD", rates: { PHP: 56.5 } } }));
    const outside = createExternal({ fetch, sleep: noWait });
    assert.equal((await outside.convert({ amount: 100, from: "USD" })).converted, 5650);
    assert.equal((await outside.convert({ amount: 100, from: "PHP" })).rate, 1);
    assert.equal(fetch.calls.length, 1);
  });
});

describe("retry and failure", () => {
  test("[NFR-02] an API that is down gives { available: false } after 3 attempts, and never throws", async () => {
    const fetch = fakeFetch(() => ({ status: 503, body: {} }));
    const result = await createExternal({ fetch, sleep: noWait }).holiday("2027-03-04");
    assert.equal(result.available, false);
    assert.match(result.reason, /unavailable/);
    assert.equal(fetch.calls.length, 3);
  });
  test("an API that fails twice and then answers is used after the third attempt", async () => {
    const fetch = fakeFetch((url, n) => (n <= 2 ? { status: 500, body: {} } : { body: [] }));
    assert.equal((await createExternal({ fetch, sleep: noWait }).holiday("2027-03-04")).available, true);
    assert.equal(fetch.calls.length, 3);
  });
  test("retry waits longer each time", async () => {
    const pauses = [];
    await assert.rejects(retry(async () => { throw new Error("no"); }, { sleep: async (ms) => void pauses.push(ms) }), /no/);
    assert.deepEqual(pauses, [200, 800]);
  });
  test("the fake has the same shapes, and can be switched off", async () => {
    const fake = createFakeExternal({ down: ["holiday"] });
    assert.equal((await fake.holiday("2027-03-04")).available, false);
    assert.equal((await fake.forecast("2027-03-04")).rainChancePercent, 20);
    assert.equal((await fake.convert({ amount: 10, from: "USD" })).converted, 560);
  });
});
