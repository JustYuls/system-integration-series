// Helpers for the tests (this file holds no tests; node --test just runs it).
// The whole application on free ports (listen(0)): three services, the gateway, the queue. Only the outside APIs are fake.
import { createFakeExternal } from "../src/external.js";
import { createNotifier, TOPIC } from "../src/notifier.js";
import { createQueue } from "../src/queue.js";
import { start } from "../src/serve.js";
import { createApp } from "../src/gateway/server.js";
import { createAccountsApp } from "../src/services/accounts.js";
import { createCustomersApp } from "../src/services/customers.js";
import { createItemsApp } from "../src/services/items.js";

export async function startApp({ external = createFakeExternal() } = {}) {
  const apps = { customers: await start(createCustomersApp()), items: await start(createItemsApp()), accounts: await start(createAccountsApp()) };
  const services = Object.fromEntries(Object.entries(apps).map(([name, app]) => [name, app.url]));
  const queue = createQueue({ sleep: async () => {} });
  const mails = [];
  queue.subscribe(TOPIC, createNotifier({ send: async (message) => void mails.push(message) }));
  const gateway = await start(createApp({ services, external, queue }));
  const stopped = new Set();
  return {
    url: gateway.url,
    services,
    queue,
    mails,
    stop: (name) => (stopped.add(name), apps[name].close()),
    close: () => Promise.all([gateway.close(), ...Object.entries(apps).filter(([n]) => !stopped.has(n)).map(([, a]) => a.close())]),
  };
}

// One call: { status, headers, body } (body is JSON when the answer is JSON).
export async function call(base, path, { method = "GET", body, raw } = {}) {
  const init = { method, headers: {} };
  if (body !== undefined || raw !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = raw ?? JSON.stringify(body);
  }
  const res = await fetch(base + path, init);
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: (res.headers.get("content-type") ?? "").includes("json") ? JSON.parse(text) : text };
}

// A request that the seed data approves: customer 1 (active, paid), item 1 (Projector, 5 in stock).
export const goodRequest = (extra = {}) => ({ customerId: "1", itemId: "1", quantity: 2, date: "2027-03-04", ...extra });

export const submit = (app, extra) => call(app.url, "/api/requests", { method: "POST", body: goodRequest(extra) });

export async function until(check, ms = 3000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out while waiting");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
