// The patterns at work.   Run:  node patterns-demo.js
// Part 1 calls the REAL free APIs (needs internet) and repeats calls to show the cache.
// Part 2 simulates an outage with a fake fetch and a fake clock, to show the circuit breaker.
import { createExternal } from "./src/external.js";
import { createFakeClock, createFakeFetch } from "./src/patterns/fakes.js";

const pad = (text, n) => String(text).padEnd(n);

async function timed(label, fn) {
  const t0 = performance.now();
  const r = await fn();
  const ms = Math.round(performance.now() - t0);
  console.log(`${pad(label, 34)} ${pad(`${ms} ms`, 8)} ${JSON.stringify(r)}`);
  return r;
}

console.log("PART 1  real APIs, repeated calls");
const live = createExternal();
await timed("holiday 2027-12-25 (first call)", () => live.holiday("2027-12-25"));
await timed("holiday 2027-12-25 (again)", () => live.holiday("2027-12-25"));
await timed("holiday 2027-03-04 (same year)", () => live.holiday("2027-03-04"));
await timed("convert 500 USD (first call)", () => live.convert({ amount: 500, currency: "USD" }));
await timed("convert 500 USD (again)", () => live.convert({ amount: 500, currency: "USD" }));
await timed("convert 8000 PHP (no call)", () => live.convert({ amount: 8000, currency: "PHP" }));
const today = new Date().toISOString().slice(0, 10);
const inThreeDays = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
await timed("forecast in 3 days (first call)", () => live.forecast({ date: inThreeDays, today }));
await timed("forecast in 3 days (again)", () => live.forecast({ date: inThreeDays, today }));
const stats = live.stats();
console.log(`cache  holidays: ${stats.holidays.hits} hit, ${stats.holidays.misses} miss   rates: ${stats.rates.hits} hit, ${stats.rates.misses} miss   weather: ${stats.weather.hits} hit, ${stats.weather.misses} miss`);

console.log("");
console.log("PART 2  outage with a fake fetch and a fake clock");
let down = true;
const fetch = createFakeFetch((url) => {
  if (down) return { status: 503, body: {} };
  return { body: { amount: 1, base: "USD", date: "2027-03-04", rates: { PHP: 56.5 } } };
});
const clock = createFakeClock();
const external = createExternal({ fetch, now: clock.now, sleep: clock.sleep });
const state = () => external.stats().rates.breaker;

for (let i = 1; i <= 4; i++) {
  const before = fetch.calls.length;
  const r = await external.convert({ amount: 100, currency: "USD" });
  console.log(`request ${i}  fetch calls: ${fetch.calls.length - before}  breaker: ${pad(state(), 10)} ${r.reason}`);
}
clock.advance(30_000);
console.log(`...30 seconds later (fake clock), the service is back, breaker: ${state()}`);
down = false;
const probe = await external.convert({ amount: 100, currency: "USD" });
console.log(`probe request  fetch calls: 1  breaker: ${pad(state(), 10)} ${probe.amountPhp} PHP`);
console.log(`pauses between retries: ${clock.sleeps.slice(0, 2).join(" ms, ")} ms`);
