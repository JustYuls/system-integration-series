// The three outside APIs, made resilient: adapter + cache + retry + circuit breaker. Nothing here throws.
// A failure becomes { available: false, reason }, so the planner can ask for a manual review instead of crashing.
import { createHolidays, fetchYear } from "./adapters/holidays.js";
import { createRates, fetchRate } from "./adapters/rates.js";
import { isTransient } from "./adapters/upstream.js";
import { scatterGather } from "./patterns/aggregator.js";
import { createCache } from "./patterns/cache.js";
import { CircuitOpenError, createBreaker } from "./patterns/circuit-breaker.js";
import { defaultSleep, retry } from "./patterns/retry.js";

const MINUTE = 60_000;
export const DEFAULTS = {
  ttlMs: { holidays: 24 * 60 * MINUTE, rates: 60 * MINUTE, weather: 30 * MINUTE },
  retry: { attempts: 3, backoffMs: [200, 800] },
  breaker: { failureThreshold: 3, coolDownMs: 30_000 },
};

// The weather service of episode 8 is loaded only when it is first needed.
const lazyForecast = (fetch) => async (args) => {
  const { getForecast } = await import("./services/weather-service.js");
  return getForecast(args, { fetch });
};

const timer = (ms) => new Promise((resolve) => setTimeout(resolve, ms).unref());

export function createExternal({
  fetch = globalThis.fetch,
  now = Date.now,
  sleep = defaultSleep,
  forecast = lazyForecast(fetch),
  config = {},
} = {}) {
  const settings = { ...DEFAULTS, ...config, ttlMs: { ...DEFAULTS.ttlMs, ...config.ttlMs } };

  // One guard per outside service: cache first, then the breaker, then retry with backoff around the real call.
  function guard(ttlMs) {
    const cache = createCache({ ttlMs, now });
    const breaker = createBreaker({ ...settings.breaker, now, isFailure: isTransient });
    const retryOptions = { ...settings.retry, sleep, shouldRetry: isTransient };
    const protectedLoad = (load) => () => breaker.call(() => retry(load, retryOptions));
    const call = (key, load) => cache.getOrLoad(key, protectedLoad(load));
    return { call, cache, breaker };
  }
  const guards = { holidays: guard(settings.ttlMs.holidays), rates: guard(settings.ttlMs.rates), weather: guard(settings.ttlMs.weather) };

  const loadYear = (year) => guards.holidays.call(`year:${year}`, () => fetchYear(year, fetch));
  const loadRate = (currency) => guards.rates.call(`rate:${currency}`, () => fetchRate(currency, fetch));
  const holidays = createHolidays({ loadYear });
  const rates = createRates({ loadRate });

  function reason(service, err) {
    if (err instanceof CircuitOpenError) return `${service} is paused after repeated failures (circuit open)`;
    if (err.code === "BAD_INPUT") return err.message;
    return `${service} unavailable: ${err.message}`;
  }

  const failed = (extra, service, err) => ({ ...extra, available: false, reason: reason(service, err) });

  async function holiday(date) {
    try {
      return await holidays.holiday(date);
    } catch (err) {
      return failed({ date, isHoliday: null, name: null }, "holiday service", err);
    }
  }

  async function weather({ date, today }) {
    try {
      return await guards.weather.call(`${date}|${today ?? ""}`, () => forecast({ date, today }));
    } catch (err) {
      return failed({ date }, "weather service", err);
    }
  }

  async function convert({ amount, currency }) {
    try {
      return await rates.convert({ amount, currency });
    } catch (err) {
      return failed({ amountPhp: null, rate: null, asOf: null }, "rate service", err);
    }
  }

  // Aggregator: ask all three at once; a slow one is cut off after timeoutMs.
  async function checkAll({ date, today, amount, currency, timeoutMs = 3000 }) {
    const { results, failures } = await scatterGather(
      { holiday: () => holiday(date), forecast: () => weather({ date, today }), convert: () => convert({ amount, currency }) },
      { timeoutMs, timer },
    );
    const late = (name, extra) => ({ ...extra, available: false, reason: `${name} did not answer: ${failures[name]}` });
    return {
      holiday: results.holiday ?? late("holiday", { date, isHoliday: null, name: null }),
      forecast: results.forecast ?? late("forecast", { date }),
      convert: results.convert ?? late("convert", { amountPhp: null, rate: null, asOf: null }),
      failures,
    };
  }

  const stats = () => {
    const one = ([name, g]) => [name, { ...g.cache.stats(), breaker: g.breaker.state() }];
    return Object.fromEntries(Object.entries(guards).map(one));
  };

  return { holiday, forecast: weather, convert, checkAll, stats };
}
