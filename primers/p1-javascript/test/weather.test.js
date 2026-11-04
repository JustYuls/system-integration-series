import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { rainChance } from "../src/weather.js";

// A fake fetch: no internet in tests.
const answer = (body, status = 200) => async () => ({ ok: status < 400, status, json: async () => body });
const forecast = { daily: { time: ["2027-03-04", "2027-03-05"], precipitation_probability_max: [20, 85] } };

describe("rainChance", () => {
  test("returns the percent for a date", async () => assert.equal(await rainChance("2027-03-05", { fetch: answer(forecast) }), 85));
  test("returns null for a date outside the forecast", async () => assert.equal(await rainChance("2030-01-01", { fetch: answer(forecast) }), null));
  test("asks Open-Meteo for the campus", async () => {
    let asked = "";
    await rainChance("2027-03-04", { fetch: async (url) => { asked = url; return answer(forecast)(); } });
    assert.match(asked, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=13\.94&longitude=121\.62/);
  });
  test("a 404 answer becomes an error (fetch itself does not throw)", async () => {
    await assert.rejects(rainChance("2027-03-04", { fetch: answer({}, 404) }), /answered 404/);
  });
  test("a network failure becomes a clear error", async () => {
    const down = async () => { throw new Error("offline"); };
    await assert.rejects(rainChance("2027-03-04", { fetch: down }), /Could not get the weather: offline/);
  });
  test("a broken answer becomes an error", async () => {
    await assert.rejects(rainChance("2027-03-04", { fetch: answer({ nothing: 1 }) }), /Could not get the weather|Cannot read/);
  });
});
