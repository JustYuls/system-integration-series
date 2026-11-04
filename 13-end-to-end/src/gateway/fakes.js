// Fake outside services for tests and demos: same shapes as createExternal, no network, optional delays.
// down: the names of services that "do not answer": "holiday", "forecast", "convert".
const wait = (ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());
const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

export function createFakeExternal({ holidays = { "2027-12-25": "Christmas Day" }, rainChance = 20, rates = { USD: 63.46 }, today = "2027-02-20", down = [], delayMs = {} } = {}) {
  const calls = [];
  const seen = (name, args) => calls.push({ name, args });

  return {
    calls,

    async holiday(date) {
      seen("holiday", date);
      await wait(delayMs.holiday);
      if (down.includes("holiday")) return { date, isHoliday: null, name: null, available: false, reason: "holiday service unavailable: fake outage" };
      return { date, isHoliday: date in holidays, name: holidays[date] ?? null, available: true };
    },

    // Like the real weather service: the forecast reaches 16 days ahead, not further.
    async forecast({ date, today: now = today }) {
      seen("forecast", date);
      await wait(delayMs.forecast);
      if (down.includes("forecast")) return { available: false, date, reason: "weather service unavailable: fake outage" };
      const ahead = daysBetween(now, date);
      if (ahead < 0 || ahead >= 16) return { available: false, date, reason: "beyond the 16 day forecast window" };
      const chance = typeof rainChance === "function" ? rainChance(date) : rainChance;
      return { available: true, date, rainChancePercent: chance, maxTempC: 32, source: "fake" };
    },

    async convert({ amount, currency }) {
      seen("convert", `${amount} ${currency}`);
      await wait(delayMs.convert);
      if (down.includes("convert")) return { amountPhp: null, rate: null, asOf: null, available: false, reason: "rate service unavailable: fake outage" };
      if (currency === "PHP") return { amountPhp: amount, rate: 1, asOf: null, available: true };
      return { amountPhp: Math.round(amount * rates[currency] * 100) / 100, rate: rates[currency], asOf: "2027-02-19", available: true };
    },
  };
}

// Counts how many fake calls are running at the same moment: 1 = one after another, 4 = at the same time.
export function createInFlight() {
  let now = 0;
  const tracker = { max: 0, calls: 0 };
  tracker.wrap = (fn, ms = 5) => async (...args) => {
    tracker.calls++;
    tracker.max = Math.max(tracker.max, ++now);
    try {
      await wait(ms);
      return await fn(...args);
    } finally {
      now--;
    }
  };
  return tracker;
}

// A fake of the clients with the answers of a healthy campus. Override any function.
export function createFakeClients(overrides = {}) {
  const statusCalls = [];
  const request = { requestNo: "EVT-0001", title: "Orientation Day", organization: "Computer Society", date: "2027-03-04", status: "Pending", venue: "Gym", attendees: 120, budget: { amount: 15000, currency: "PHP" }, outdoor: false, contactEmail: "csoc@campus.example" };
  return {
    statusCalls,
    getRequest: async () => ({ ...request, ...overrides.request }),
    availability: async ({ venue, date }) => ({ venue, date, available: true, capacityOk: true, penaltyPhp: 0, reasons: [] }),
    deposit: async (requestNo) => ({ requestNo, balancePhp: 0 }),
    setStatus: async (requestNo, status) => {
      statusCalls.push({ requestNo, status });
      return { ...request, ...overrides.request, status };
    },
    ...Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== "request")),
  };
}
