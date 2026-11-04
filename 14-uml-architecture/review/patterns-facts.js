// Facts for the AI review: what an AI said about integration patterns, decided with fake clocks (no real waiting).
import { createBreaker } from "../src/patterns/circuit-breaker.js";
import { createCache } from "../src/patterns/cache.js";
import { createFakeClock } from "../src/patterns/fakes.js";
import { retry } from "../src/patterns/retry.js";

const DAY = 24 * 60 * 60 * 1000;

// Finding 1: retrying at once sends every try in the same instant.
async function retryTimes(backoffMs) {
  const clock = createFakeClock();
  const times = [];
  const run = async () => {
    times.push(clock.now());
    throw new Error("503");
  };
  await retry(run, { attempts: 5, backoffMs, sleep: clock.sleep }).catch(() => {});
  return times;
}

// Finding 2: a cache without expiry (ttl = forever) against a cache with a TTL, while the source changes.
async function staleness(ttlMs) {
  const clock = createFakeClock();
  const cache = createCache({ ttlMs, now: clock.now });
  let rainChance = 20; // the forecast at the source
  const load = () => Promise.resolve(rainChance);
  const first = await cache.getOrLoad("2027-03-04", load);
  rainChance = 80; // the forecast changes the next day
  clock.advance(DAY);
  const later = await cache.getOrLoad("2027-03-04", load);
  return { first, later };
}

// Finding 3: a failing service that needs 2 seconds to time out; the breaker stops paying that price.
async function breakerCost() {
  const clock = createFakeClock();
  const breaker = createBreaker({ failureThreshold: 3, coolDownMs: 30_000, now: clock.now });
  let upstream = 0;
  const slowFail = async () => {
    upstream += 1;
    clock.advance(2000); // a timeout costs 2 seconds
    throw new Error("timeout");
  };
  const spent = async () => {
    const t0 = clock.now();
    await breaker.call(slowFail).catch(() => {});
    return clock.now() - t0;
  };
  const closedMs = await spent();
  await spent();
  await spent(); // third failure opens the breaker
  const state = breaker.state();
  const before = upstream;
  const openMs = await spent();
  let rejected = 0;
  for (let i = 0; i < 10; i++) await breaker.call(slowFail).catch((e) => { if (e.code === "CIRCUIT_OPEN") rejected += 1; });
  return { closedMs, openMs, state, callsWhileOpen: upstream - before, rejected };
}

// Claim 5: cache-aside loads from the source only on a miss.
async function cacheAside() {
  const clock = createFakeClock();
  const cache = createCache({ ttlMs: 60_000, now: clock.now });
  let loads = 0;
  for (let i = 0; i < 5; i++) await cache.getOrLoad("holidays:2027", async () => { loads += 1; return ["Christmas Day"]; });
  return { loads, ...cache.stats() };
}

export async function collect() {
  const immediate = await retryTimes([0]);
  const spread = await retryTimes([100, 200, 400, 800]);
  const forever = await staleness(Infinity);
  const yearTtl = await staleness(365 * DAY);
  const halfHour = await staleness(30 * 60 * 1000);
  const breaker = await breakerCost();
  const aside = await cacheAside();
  return {
    immediateTimes: immediate, // all the same instant
    spreadTimes: spread,
    immediateBurst: immediate.every((t) => t === immediate[0]),
    backoffSpan: spread[spread.length - 1] - spread[0],
    foreverStale: forever.later === forever.first && forever.later !== 80,
    yearTtlStale: yearTtl.later === 20, // one year: still the old forecast one day later
    ttlFresh: halfHour.later === 80,
    closedFailMs: breaker.closedMs,
    openFailMs: breaker.openMs,
    breakerState: breaker.state,
    upstreamCallsWhileOpen: breaker.callsWhileOpen,
    rejectedWhileOpen: breaker.rejected,
    cacheLoads: aside.loads,
    cacheHits: aside.hits,
    cacheMisses: aside.misses,
  };
}
