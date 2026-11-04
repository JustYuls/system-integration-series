// Helpers for the integration tests of episode 15 (this file holds no tests; node --test just runs it).
// The whole application on real ports: three services, the gateway with the planner, the queue with the notifier.
// Only the OUTSIDE world is fake: createFakeExternal, or createExternal with a fake fetch (createFakeWeb).
import { createExternal } from "../src/external.js";
import { createNotifier, TOPIC } from "../src/notifier.js";
import { createQueue } from "../src/queue.js";
import { seedData } from "../src/seed.js";
import { start } from "../src/serve.js";
import { createFakeExternal } from "../src/gateway/fakes.js";
import { createPlannerApp } from "../src/gateway/server.js";
import { createFacilitiesApp } from "../src/services/facilities.js";
import { createFinanceApp } from "../src/services/finance.js";
import { createStudentAffairsApp } from "../src/services/student-affairs.js";

export { call, newRequest } from "./ep13-fixtures.js";
export const TODAY = "2027-02-20";

// The seed of the campus, plus a paid deposit for the next 50 request numbers, so that new requests can be approved.
export function campusData() {
  const data = seedData();
  for (let n = 9; n < 60; n++) data.deposits.push({ requestNo: `EVT-${String(n).padStart(4, "0")}`, balancePhp: 0 });
  return data;
}

// The three services. stop("finance") switches one off: its port stays closed, so the gateway cannot reach it.
export async function startCampus(data = campusData()) {
  const apps = {
    studentAffairs: await start(createStudentAffairsApp(structuredClone(data))),
    finance: await start(createFinanceApp(structuredClone(data))),
    facilities: await start(createFacilitiesApp(structuredClone(data))),
  };
  const stopped = new Set();
  return {
    services: Object.fromEntries(Object.entries(apps).map(([name, app]) => [name, app.url])),
    stop: (name) => (stopped.add(name), apps[name].close()),
    close: () => Promise.all(Object.entries(apps).filter(([name]) => !stopped.has(name)).map(([, app]) => app.close())),
  };
}

// The whole application. `send` is the "mail server" (the default collects the mails in `mails`).
export async function startApp({ external = createFakeExternal({ today: TODAY }), today = TODAY, data, fetch, timeoutMs, send, sleep = async () => {} } = {}) {
  const campus = await startCampus(data);
  const queue = createQueue({ sleep });
  const mails = [];
  queue.subscribe(TOPIC, createNotifier({ send: send ?? (async (m) => void mails.push(m)) }));
  const services = campus.services;
  const planner = createPlannerApp({ services, external, queue, fetch, today, timeoutMs });
  const gateway = await start(planner);
  return { url: gateway.url, ...campus, queue, mails, external, close: () => Promise.all([gateway.close(), campus.close()]) };
}

// Wait until a condition is true (the queue delivers in the background, after the planner has answered).
export async function until(check, ms = 3000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out while waiting");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const day = (from, n) => new Date(Date.parse(`${from}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// A fake fetch that answers like Nager.Date, Open-Meteo and Frankfurter, and can fail, so that the REAL createExternal
// (cache, retry, circuit breaker) runs inside the test. down: names that always fail. failFirst: { nager: 2 } = the first 2 calls fail.
export function createFakeWeb({ today = TODAY, rain = 20, rate = 63.46, down = [], failFirst = {} } = {}) {
  const calls = { nager: 0, openMeteo: 0, frankfurter: 0 };
  const holidays = [{ date: "2027-12-25", localName: "Araw ng Pasko", name: "Christmas Day" }];

  async function fakeFetch(url) {
    const host = new URL(url).host;
    const name = host.includes("nager") ? "nager" : host.includes("open-meteo") ? "openMeteo" : "frankfurter";
    calls[name]++;
    if (down.includes(name) || calls[name] <= (failFirst[name] ?? 0)) return reply(503, {});
    if (name === "nager") return reply(200, holidays);
    if (name === "frankfurter") return reply(200, { amount: 1, base: "USD", date: "2027-02-19", rates: { PHP: rate } });
    const time = Array.from({ length: 16 }, (_, i) => day(today, i));
    return reply(200, { daily: { time, precipitation_probability_max: time.map(() => rain), temperature_2m_max: time.map(() => 31) } });
  }
  fakeFetch.calls = calls;
  return fakeFetch;
}

// The real createExternal on top of the fake web.
export const externalOver = (fakeFetch) => createExternal({ fetch: fakeFetch, sleep: async () => {} });
