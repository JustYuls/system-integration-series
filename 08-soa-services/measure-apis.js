// Live demo: measure the three free APIs (10 calls each) and save the numbers.   Run:  node measure-apis.js
// Needs a network. The tests never run this file; they read docs/measurements.sample.json.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { measureApi } from "./src/measure.js";

const year = new Date().getFullYear() + 1;
const apis = {
  "Open-Meteo": "https://api.open-meteo.com/v1/forecast?latitude=13.94&longitude=121.62&daily=precipitation_probability_max,temperature_2m_max&timezone=Asia%2FManila&forecast_days=16",
  "Nager.Date": `https://date.nager.at/api/v3/PublicHolidays/${year}/PH`,
  "Frankfurter": "https://api.frankfurter.dev/v1/latest?base=USD&symbols=PHP",
};

// A call counts only when the answer is a good one (status 200 and a JSON body).
const get = (url) => async () => {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await res.json();
};

const runs = 10;
const result = {};
for (const [name, url] of Object.entries(apis)) result[name] = await measureApi(get(url), { runs });

const pad = (v, n) => String(v ?? "-").padStart(n);
console.log("API          runs fails   min   avg   p95   max   (ms)");
for (const [name, m] of Object.entries(result)) {
  console.log(`${name.padEnd(12)} ${pad(m.runs, 4)} ${pad(m.failures, 5)} ${pad(m.minMs, 5)} ${pad(m.avgMs, 5)} ${pad(m.p95Ms, 5)} ${pad(m.maxMs, 5)}`);
}

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "docs", "measurements.sample.json");
const sample = { measuredAt: new Date().toISOString().slice(0, 10), from: "one laptop, one network, one afternoon", apis: result };
writeFileSync(file, JSON.stringify(sample, null, 2) + "\n");
console.log("written", path.relative(process.cwd(), file));
