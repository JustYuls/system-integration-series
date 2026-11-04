// Measure how long a call takes. The clock and the call are parameters, so tests run without a network.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
export const loadMeasurements = () => JSON.parse(readFileSync(path.join(docs, "measurements.sample.json"), "utf8"));

// Nearest-rank percentile: the smallest value that is at least p percent of all values.
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.max(rank, 1) - 1];
}

// Call `call()` many times. A call that throws is a failure and is left out of the times.
export async function measureApi(call, { runs = 10, now = () => performance.now() } = {}) {
  const times = [];
  let failures = 0;
  for (let i = 0; i < runs; i++) {
    const start = now();
    try {
      await call();
      times.push(now() - start);
    } catch {
      failures += 1;
    }
  }
  const round = (n) => (n === null ? null : Math.round(n));
  const sum = times.reduce((a, b) => a + b, 0);
  return {
    runs,
    failures,
    minMs: round(times.length ? Math.min(...times) : null),
    avgMs: round(times.length ? sum / times.length : null),
    p95Ms: round(percentile(times, 95)),
    maxMs: round(times.length ? Math.max(...times) : null),
  };
}

// Can the planner meet its time limit? In parallel the slowest outside call counts; one after another they add up.
// `attempts` is the worst case with retries: every try is as slow as the p95.
export function feasibility(apis, { limitMs, overheadMs = 500, parallel = true, attempts = 1 }) {
  const p95s = Object.values(apis).map((a) => a.p95Ms);
  if (p95s.some((v) => v === null)) return { ok: false, reason: "an outside call never answered" };
  const outsideMs = parallel ? Math.max(...p95s) : p95s.reduce((a, b) => a + b, 0);
  const totalMs = outsideMs * attempts + overheadMs;
  return { ok: totalMs <= limitMs, outsideMs, attempts, overheadMs, totalMs, limitMs };
}
