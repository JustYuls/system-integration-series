// Aggregator (scatter-gather): start every call at once, wait for all, keep the results and the failures.
// Each call has its own time limit: Promise.race between the call and a timer.
export class TimeoutError extends Error {
  constructor(ms) {
    super(`no answer within ${ms} ms`);
    this.name = "TimeoutError";
    this.code = "TIMEOUT";
  }
}

// The default timer does not keep the process alive when nothing else is waiting.
const realTimer = (ms) => new Promise((resolve) => setTimeout(resolve, ms).unref());

export function withTimeout(promise, ms, timer = realTimer) {
  const late = timer(ms).then(() => {
    throw new TimeoutError(ms);
  });
  return Promise.race([promise, late]);
}

// calls: { name: () => Promise }. Returns { results: { name: value }, failures: { name: message } }.
export async function scatterGather(calls, { timeoutMs = 3000, timer = realTimer } = {}) {
  const names = Object.keys(calls);
  const start = (name) => withTimeout(Promise.resolve().then(calls[name]), timeoutMs, timer);
  const settled = await Promise.allSettled(names.map(start));
  const results = {};
  const failures = {};
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") results[names[i]] = outcome.value;
    else failures[names[i]] = outcome.reason.message;
  });
  return { results, failures };
}
