import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createHolidays, fetchYear, holidaysUrl } from "../src/adapters/holidays.js";
import { createRates, fetchRate, ratesUrl } from "../src/adapters/rates.js";
import { getJson, isTransient, UpstreamError } from "../src/adapters/upstream.js";
import { createFakeFetch } from "../src/patterns/fakes.js";

const nager = [
  { date: "2027-12-25", localName: "Araw ng Pasko", name: "Christmas Day", countryCode: "PH", global: true },
  { date: "2027-01-01", localName: "Bagong Taon", name: "New Year's Day", countryCode: "PH", global: true },
];
const frankfurter = { amount: 1, base: "USD", date: "2027-03-04", rates: { PHP: 56.5 } };

describe("the holiday adapter (Nager.Date)", () => {
  test("the URL asks for the Philippines and the year", () => assert.equal(holidaysUrl(2027), "https://date.nager.at/api/v3/PublicHolidays/2027/PH"));
  test("fetchYear keeps only date and name", async () => {
    const fetch = createFakeFetch(() => ({ body: nager }));
    assert.deepEqual(await fetchYear(2027, fetch), [{ date: "2027-12-25", name: "Christmas Day" }, { date: "2027-01-01", name: "New Year's Day" }]);
  });
  test("[FR-02] a holiday is found by its date", async () => {
    const h = createHolidays({ loadYear: async () => await fetchYear(2027, createFakeFetch(() => ({ body: nager }))) });
    assert.deepEqual(await h.holiday("2027-12-25"), { date: "2027-12-25", isHoliday: true, name: "Christmas Day", available: true });
  });
  test("an ordinary day is not a holiday", async () => {
    const h = createHolidays({ loadYear: async () => [{ date: "2027-12-25", name: "Christmas Day" }] });
    assert.deepEqual(await h.holiday("2027-03-04"), { date: "2027-03-04", isHoliday: false, name: null, available: true });
  });
  test("the year is taken from the date, and a bad date is refused", async () => {
    const years = [];
    const h = createHolidays({ loadYear: async (y) => { years.push(y); return []; } });
    await h.holiday("2028-02-14");
    assert.deepEqual(years, [2028]);
    await assert.rejects(h.holiday("14/02/2028"), (e) => e.code === "BAD_INPUT");
  });
  test("a payload that is not a list is a translation error", async () => {
    await assert.rejects(fetchYear(2027, createFakeFetch(() => ({ body: { error: "x" } }))), (e) => e.code === "BAD_SHAPE");
  });
});

describe("the rates adapter (Frankfurter)", () => {
  const loadRate = (fetch) => (currency) => fetchRate(currency, fetch);

  test("the URL asks for pesos", () => assert.equal(ratesUrl("USD"), "https://api.frankfurter.dev/v1/latest?base=USD&symbols=PHP"));
  test("[FR-07] dollars become pesos with the rate and its date", async () => {
    const r = createRates({ loadRate: loadRate(createFakeFetch(() => ({ body: frankfurter }))) });
    assert.deepEqual(await r.convert({ amount: 500, currency: "USD" }), { amountPhp: 28250, rate: 56.5, asOf: "2027-03-04", available: true });
  });
  test("pesos are returned unchanged with rate 1, and nothing is fetched", async () => {
    const fetch = createFakeFetch(() => ({ body: frankfurter }));
    const r = createRates({ loadRate: loadRate(fetch) });
    assert.deepEqual(await r.convert({ amount: 8000, currency: "PHP" }), { amountPhp: 8000, rate: 1, asOf: null, available: true });
    assert.equal(fetch.calls.length, 0);
  });
  test("amounts are rounded to centavos", async () => {
    const r = createRates({ loadRate: async () => ({ rate: 56.333, asOf: "2027-03-04" }) });
    assert.equal((await r.convert({ amount: 10.5, currency: "USD" })).amountPhp, 591.5);
  });
  test("a bad amount or currency is refused before any call", async () => {
    const r = createRates({ loadRate: async () => assert.fail("must not be called") });
    await assert.rejects(r.convert({ amount: -5, currency: "USD" }), (e) => e.code === "BAD_INPUT");
    await assert.rejects(r.convert({ amount: 5, currency: "usd" }), (e) => e.code === "BAD_INPUT");
  });
  test("a payload without PHP rates is a translation error", async () => {
    await assert.rejects(fetchRate("USD", createFakeFetch(() => ({ body: { date: "2027-03-04", rates: {} } }))), (e) => e.code === "BAD_SHAPE");
  });
});

describe("getJson and isTransient", () => {
  test("a 503 answer becomes an UpstreamError with the status", async () => {
    await assert.rejects(getJson(createFakeFetch(() => ({ status: 503, body: {} })), "https://x.test/a"), (e) => e instanceof UpstreamError && e.status === 503);
  });
  test("a network error becomes an UpstreamError", async () => {
    const fetch = async () => { throw new TypeError("fetch failed"); };
    await assert.rejects(getJson(fetch, "https://x.test/a"), /cannot reach x.test/);
  });
  test("5xx, 429 and network errors are worth another try; 404 and our own bad input are not", () => {
    assert.equal(isTransient(new UpstreamError("x", 503)), true);
    assert.equal(isTransient(new UpstreamError("x", 429)), true);
    assert.equal(isTransient(new UpstreamError("x")), true);
    assert.equal(isTransient(new UpstreamError("x", 404)), false);
    assert.equal(isTransient(Object.assign(new Error("x"), { code: "BAD_INPUT" })), false);
  });
});
