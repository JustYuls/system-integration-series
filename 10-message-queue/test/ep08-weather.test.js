import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ServiceError, buildUrl, getForecast } from "../src/services/weather-service.js";

// What Open-Meteo really sends (shortened): parallel arrays, one entry for each day.
const raw = {
  latitude: 13.9,
  daily_units: { precipitation_probability_max: "%", temperature_2m_max: "°C" },
  daily: {
    time: ["2027-03-04", "2027-03-05", "2027-03-06"],
    precipitation_probability_max: [10, 75, 40],
    temperature_2m_max: [33.4, 29.1, 31],
  },
};
const answer = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const fakeFetch = (body, status) => {
  const calls = [];
  const fn = async (url) => (calls.push(url), answer(body, status));
  fn.calls = calls;
  return fn;
};
const today = "2027-03-04";
const fail = async (promise) => promise.then(() => assert.fail("should have thrown"), (e) => e);

describe("the weather service: the normalized result", () => {
  test("a date in the window gives the rain chance and the highest temperature", async () => {
    const result = await getForecast({ date: "2027-03-05", today }, { fetch: fakeFetch(raw) });
    assert.deepEqual(result, { available: true, date: "2027-03-05", rainChancePercent: 75, maxTempC: 29.1, source: "open-meteo" });
  });
  test("the result has none of Open-Meteo's field names", async () => {
    const result = await getForecast({ date: "2027-03-04", today }, { fetch: fakeFetch(raw) });
    assert.ok(!JSON.stringify(result).includes("daily"));
    assert.ok(!JSON.stringify(result).includes("precipitation_probability_max"));
  });
  test("today and the last day of the window are inside", async () => {
    const body = { daily: { time: ["2027-03-04", "2027-03-19"], precipitation_probability_max: [1, 2], temperature_2m_max: [30, 31] } };
    assert.equal((await getForecast({ date: "2027-03-04", today }, { fetch: fakeFetch(body) })).available, true);
    assert.equal((await getForecast({ date: "2027-03-19", today }, { fetch: fakeFetch(body) })).rainChancePercent, 2);
  });
  test("a zero rain chance is a real answer, not a missing one", async () => {
    const body = { daily: { time: ["2027-03-04"], precipitation_probability_max: [0], temperature_2m_max: [30] } };
    assert.equal((await getForecast({ date: "2027-03-04", today }, { fetch: fakeFetch(body) })).rainChancePercent, 0);
  });
});

describe("the weather service: the request to Open-Meteo", () => {
  test("it asks for the campus place, the two daily values and the Manila time zone", async () => {
    const f = fakeFetch(raw);
    await getForecast({ date: "2027-03-04", today }, { fetch: f });
    const url = new URL(f.calls[0]);
    assert.equal(url.origin + url.pathname, "https://api.open-meteo.com/v1/forecast");
    assert.equal(url.searchParams.get("latitude"), "13.94");
    assert.equal(url.searchParams.get("longitude"), "121.62");
    assert.equal(url.searchParams.get("daily"), "precipitation_probability_max,temperature_2m_max");
    assert.equal(url.searchParams.get("timezone"), "Asia/Manila");
    assert.equal(url.searchParams.get("forecast_days"), "16");
  });
  test("another place can be asked for", async () => {
    const f = fakeFetch(raw);
    await getForecast({ date: "2027-03-04", today, latitude: 14.6, longitude: 121 }, { fetch: f });
    assert.ok(f.calls[0].includes("latitude=14.6") && f.calls[0].includes("longitude=121"));
    assert.equal(buildUrl(1, 2), "https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2&daily=precipitation_probability_max%2Ctemperature_2m_max&timezone=Asia%2FManila&forecast_days=16");
  });
});

describe("the weather service: beyond the forecast window", () => {
  test("a date 16 days or more ahead is not available, and nothing is called", async () => {
    const f = fakeFetch(raw);
    const result = await getForecast({ date: "2027-03-20", today }, { fetch: f });
    assert.deepEqual(result, { available: false, date: "2027-03-20", reason: "beyond the 16 day forecast window" });
    assert.equal(f.calls.length, 0);
  });
  test("a date far in the future is not available", async () => {
    assert.equal((await getForecast({ date: "2028-01-09", today }, { fetch: fakeFetch(raw) })).available, false);
  });
  test("a date in the past is not available either", async () => {
    assert.equal((await getForecast({ date: "2027-03-03", today }, { fetch: fakeFetch(raw) })).available, false);
  });
});

describe("the weather service: bad input", () => {
  test("a date in another format is BAD_INPUT", async () => {
    const e = await fail(getForecast({ date: "04/03/2027", today }, { fetch: fakeFetch(raw) }));
    assert.ok(e instanceof ServiceError);
    assert.equal(e.code, "BAD_INPUT");
  });
  test("a date that does not exist is BAD_INPUT", async () => {
    assert.equal((await fail(getForecast({ date: "2027-02-30", today }, { fetch: fakeFetch(raw) }))).code, "BAD_INPUT");
  });
  test("a missing date is BAD_INPUT", async () => {
    assert.equal((await fail(getForecast({ today }, { fetch: fakeFetch(raw) }))).code, "BAD_INPUT");
  });
  test("a latitude or longitude out of range is BAD_INPUT", async () => {
    assert.equal((await fail(getForecast({ date: "2027-03-04", today, latitude: 120 }, { fetch: fakeFetch(raw) }))).code, "BAD_INPUT");
    assert.equal((await fail(getForecast({ date: "2027-03-04", today, longitude: "east" }, { fetch: fakeFetch(raw) }))).code, "BAD_INPUT");
  });
  test("bad input never calls Open-Meteo", async () => {
    const f = fakeFetch(raw);
    await fail(getForecast({ date: "tomorrow", today }, { fetch: f }));
    assert.equal(f.calls.length, 0);
  });
});

describe("the weather service: when Open-Meteo fails", () => {
  test("an error status is UPSTREAM", async () => {
    const e = await fail(getForecast({ date: "2027-03-04", today }, { fetch: fakeFetch({}, 503) }));
    assert.deepEqual([e.code, e.message], ["UPSTREAM", "Open-Meteo answered with status 503"]);
  });
  test("a network failure is UPSTREAM", async () => {
    const down = async () => {
      throw new TypeError("fetch failed");
    };
    const e = await fail(getForecast({ date: "2027-03-04", today }, { fetch: down }));
    assert.equal(e.code, "UPSTREAM");
    assert.ok(e.message.includes("fetch failed"));
  });
  test("an answer that is not JSON is UPSTREAM", async () => {
    const broken = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token"); } });
    assert.equal((await fail(getForecast({ date: "2027-03-04", today }, { fetch: broken }))).code, "UPSTREAM");
  });
  test("an answer without the date or with empty values is UPSTREAM", async () => {
    assert.equal((await fail(getForecast({ date: "2027-03-10", today }, { fetch: fakeFetch(raw) }))).code, "UPSTREAM");
    const empty = { daily: { time: ["2027-03-04"], precipitation_probability_max: [null], temperature_2m_max: [30] } };
    assert.equal((await fail(getForecast({ date: "2027-03-04", today }, { fetch: fakeFetch(empty) }))).code, "UPSTREAM");
  });
  test("a ServiceError carries its code and name", () => {
    const e = new ServiceError("UPSTREAM", "x");
    assert.deepEqual([e.name, e.code, e instanceof Error], ["ServiceError", "UPSTREAM", true]);
  });
});
