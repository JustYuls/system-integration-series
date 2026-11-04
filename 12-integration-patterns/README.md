# Campus Event Planner, episode 12: integration patterns

Week 14, LO 2.3, CLO 3. The three outside APIs (Open-Meteo, Nager.Date, Frankfurter) become resilient: when one is slow, wrong or down, the planner gets `{ available: false, reason }` instead of a crash (NFR-02 availability, NFR-07 fault tolerance).

An integration pattern is a named, reusable solution to a problem that integrators meet again and again (see the catalog *Enterprise Integration Patterns*). This episode applies six of them.

| Pattern | File | What it does here |
|---|---|---|
| Message translator | `src/patterns/translator.js` | explicit field mapping from an upstream payload to our model; a changed payload is an error |
| Content-based router | `src/patterns/router.js` | picks a handler by a message property (`currency`: PHP stays, others call Frankfurter) |
| Aggregator (scatter-gather) | `src/patterns/aggregator.js` | runs calls in parallel, collects results and failures, per-call timeout with `Promise.race` |
| Cache-aside | `src/patterns/cache.js` | TTL cache, loads from the source only on a miss, counts hits and misses |
| Retry with backoff | `src/patterns/retry.js` | tries again after growing pauses (200 ms, 800 ms), then gives up |
| Circuit breaker | `src/patterns/circuit-breaker.js` | closed, open (fails fast), half-open (one probe after a cool-down) |

Adapters: `src/adapters/holidays.js` (Nager.Date -> `{ date, isHoliday, name, available }`, one fetch per year), `src/adapters/rates.js` (Frankfurter -> `{ amountPhp, rate, asOf, available }`), `src/adapters/upstream.js` (`getJson`, `UpstreamError`, `isTransient`).

`src/external.js` composes them: `createExternal({ fetch, now, sleep, forecast })` returns `holiday(date)`, `forecast({ date, today })`, `convert({ amount, currency })`, `checkAll(...)` (aggregator) and `stats()`. Order of the layers for each service: cache, then breaker, then retry, then the call. It never throws. The weather service of episode 8 (`src/services/weather-service.js`) is loaded with a dynamic `import()` the first time a forecast is needed, so this stage also runs on its own; tests inject a fake `forecast`.

`src/patterns/fakes.js` has a fake clock and a fake `fetch`: tests and demos move time without waiting and never touch the network.

## Run it

```
npm run patterns-demo      # part 1 calls the real APIs (internet needed); part 2 is an outage with fakes
npm run review:patterns    # the AI review: 3 findings, 3 claims, each decided by code
npm test                   # all tests of the folder (no network)
```

## The AI review

- Finding 1: retrying at once, without a pause, hammers a struggling service (5 tries in the same instant; with backoff they are spread over 1.5 seconds).
- Finding 2: a cache without expiry serves old data forever.
- Finding 3: an open breaker fails fast (2000 ms per failure while closed, 0 ms while open).
- Claim 4 (false): "a circuit breaker retries every request until it succeeds". While open it makes no call at all; retrying is the retry pattern's job.
- Claim 5 (true): "cache-aside loads from the source only on a miss".
- Claim 6 (false): "a cache TTL of one year is fine for weather". With the fake clock, the forecast is already stale after one day.

## Tests

`test/ep12-*.test.js`. Resilience tests carry the tags `[NFR-02]` and `[NFR-07]`; other tests carry `[FR-02]` (holiday), `[FR-07]` (currency), `[FR-12]` (needs-review when a service does not answer), `[NFR-01]` (cache) and `[NFR-03]` (at most 3 attempts).
