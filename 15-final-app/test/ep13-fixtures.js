// Shared helpers for the tests of episode 13 (this file holds no tests; node --test just runs it).
import { createNotifier, TOPIC } from "../src/notifier.js";
import { createQueue } from "../src/queue.js";
import { start } from "../src/serve.js";
import { createFakeExternal } from "../src/gateway/fakes.js";
import { createPlannerApp } from "../src/gateway/server.js";
import { createFacilitiesApp } from "../src/services/facilities.js";
import { createFinanceApp } from "../src/services/finance.js";
import { createStudentAffairsApp } from "../src/services/student-affairs.js";

export const TODAY = "2027-02-20";

// The three real services on free ports.
export async function startServices() {
  const apps = { studentAffairs: await start(createStudentAffairsApp()), finance: await start(createFinanceApp()), facilities: await start(createFacilitiesApp()) };
  return {
    services: Object.fromEntries(Object.entries(apps).map(([name, app]) => [name, app.url])),
    close: () => Promise.all(Object.values(apps).map((a) => a.close())),
  };
}

// The whole planner: real services, real gateway, real queue and notifier (the e-mails are collected in `mails`), fake outside services.
export async function startPlanner({ external = createFakeExternal({ today: TODAY }), createGateway, services: given } = {}) {
  const campus = await startServices();
  const queue = createQueue({ sleep: async () => {} });
  const mails = [];
  queue.subscribe(TOPIC, createNotifier({ send: async (m) => void mails.push(m) }));
  const services = given ?? campus.services;
  const app = createPlannerApp({ services, external, queue, today: TODAY, ...(createGateway ? { createGateway } : {}) });
  const gateway = await start(app);
  return { url: gateway.url, services, queue, mails, external, app, close: () => Promise.all([gateway.close(), campus.close()]) };
}

// A call that returns { status, headers, body }, where body is JSON or, for other types, text.
export async function call(base, path, { method = "GET", body, raw } = {}) {
  const init = { method, headers: {} };
  if (body !== undefined || raw !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = raw ?? JSON.stringify(body);
  }
  const res = await fetch(base + path, init);
  const text = await res.text();
  const isJson = (res.headers.get("content-type") ?? "").includes("json");
  return { status: res.status, headers: res.headers, body: isJson ? JSON.parse(text) : text };
}

export const newRequest = (extra = {}) => ({
  title: "Quiz Night",
  organization: "Math Club",
  date: "2027-05-20",
  venue: "Lab A",
  attendees: 35,
  budget: { amount: 1200, currency: "PHP" },
  contactEmail: "math@campus.example",
  ...extra,
});
