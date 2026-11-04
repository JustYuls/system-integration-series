// Outside APIs, three free ones with no key, as EXAMPLES. Keep the ones your project needs, delete the others,
// or add yours. Other free, keyless APIs to consider: JSONPlaceholder (fake posts, users, todos), Open Library
// (books), REST Countries (countries; it may redirect, so follow redirects), Frankfurter (rates, used below).
//
// The rule of this file: an outside API can be slow, wrong or down, so NOTHING here throws.
// A failure becomes { available: false, reason }, and the planner turns it into the decision "needs-review".

export const URLS = {
  // Nager.Date: public holidays of a country, for a year.
  holidays: (year, country) => `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
  // Open-Meteo: a daily forecast for 16 days.
  forecast: (latitude, longitude) =>
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=precipitation_probability_max&timezone=auto&forecast_days=16`,
  // Frankfurter: the exchange rate from one currency to another.
  rate: (from, to) => `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`,
};

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Try again after a growing pause. Three attempts in all.
export async function retry(work, { attempts = 3, backoffMs = [200, 800], sleep = realSleep } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await sleep(backoffMs[Math.min(attempt, backoffMs.length) - 1]);
    }
  }
}

async function getJson(fetch, url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`);
  return response.json();
}

export function createExternal({ fetch = globalThis.fetch, sleep = realSleep, country = "PH", latitude = 14.6, longitude = 121 } = {}) {
  const ask = (url) => retry(() => getJson(fetch, url), { sleep });
  const unavailable = (extra, error) => ({ ...extra, available: false, reason: `outside service unavailable: ${error.message}` });

  return {
    // Is this date a public holiday?  { date, isHoliday, name, available }
    async holiday(date) {
      try {
        const year = Number(date.slice(0, 4));
        const found = (await ask(URLS.holidays(year, country))).find((h) => h.date === date);
        return { date, isHoliday: Boolean(found), name: found?.name ?? null, available: true };
      } catch (error) {
        return unavailable({ date, isHoliday: null, name: null }, error);
      }
    },

    // Chance of rain on a date within 16 days.  { date, rainChancePercent, available }
    async forecast(date) {
      try {
        const daily = (await ask(URLS.forecast(latitude, longitude))).daily;
        const i = daily.time.indexOf(date);
        if (i < 0) return { date, rainChancePercent: null, available: false, reason: "no forecast for that date (the forecast reaches 16 days)" };
        return { date, rainChancePercent: daily.precipitation_probability_max[i], available: true };
      } catch (error) {
        return unavailable({ date, rainChancePercent: null }, error);
      }
    },

    // An amount in another currency.  { amount, from, to, converted, rate, available }
    async convert({ amount, from, to = "PHP" }) {
      if (from === to) return { amount, from, to, converted: amount, rate: 1, available: true };
      try {
        const rate = (await ask(URLS.rate(from, to))).rates[to];
        return { amount, from, to, converted: Math.round(amount * rate * 100) / 100, rate, available: true };
      } catch (error) {
        return unavailable({ amount, from, to, converted: null, rate: null }, error);
      }
    },
  };
}

// The same three functions with no network, for tests and demos. down: ["holiday", "forecast", "convert"].
export function createFakeExternal({ holidays = { "2027-12-25": "Christmas Day" }, rainChance = 20, rate = 56, down = [] } = {}) {
  const outage = (name, extra) => ({ ...extra, available: false, reason: `${name} unavailable: fake outage` });
  return {
    async holiday(date) {
      if (down.includes("holiday")) return outage("holiday service", { date, isHoliday: null, name: null });
      return { date, isHoliday: date in holidays, name: holidays[date] ?? null, available: true };
    },
    async forecast(date) {
      if (down.includes("forecast")) return outage("weather service", { date, rainChancePercent: null });
      return { date, rainChancePercent: rainChance, available: true };
    },
    async convert({ amount, from, to = "PHP" }) {
      if (down.includes("convert")) return outage("rate service", { amount, from, to, converted: null, rate: null });
      return { amount, from, to, converted: from === to ? amount : Math.round(amount * rate * 100) / 100, rate: from === to ? 1 : rate, available: true };
    },
  };
}
