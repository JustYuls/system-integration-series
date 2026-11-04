// Integration tests of the quality of the whole application: invalid input, plain language, standards, speed, load.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createFakeExternal } from "../src/gateway/fakes.js";
import { call, newRequest, startApp, TODAY, until } from "./ep15-support.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const plan = (app, requestNo) => call(app.url, `/api/requests/${requestNo}/assessment`, { method: "POST" });

describe("[NFR-04] invalid input and secrets", () => {
  let app;
  before(async () => (app = await startApp()));
  after(() => app.close());

  test("[NFR-04] a request with a bad number and a bad date is answered 400, and the problems are listed", async () => {
    const res = await call(app.url, "/api/requests", { method: "POST", body: newRequest({ attendees: -5, date: "tomorrow" }) });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_FAILED");
    assert.deepEqual(res.body.error.invalid.sort(), ["attendees", "date"]);
  });

  test("[NFR-04] a body that is not JSON is answered 400 BAD_JSON, an empty body lists every missing field", async () => {
    const bad = await call(app.url, "/api/requests", { method: "POST", raw: "{not json" });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, "BAD_JSON");
    const empty = await call(app.url, "/api/requests", { method: "POST", body: {} });
    assert.equal(empty.status, 400);
    assert.deepEqual(empty.body.error.missing.sort(), ["attendees", "budget", "contactEmail", "date", "organization", "title", "venue"]);
  });

  test("[NFR-04] each service refuses its own bad input with 400 (the gateway does not hide it)", async () => {
    const status = await call(app.url, "/api/student-affairs/requests/EVT-0001", { method: "PATCH", body: { status: "Maybe" } });
    assert.equal(status.status, 400);
    const date = await call(app.url, "/api/facilities/venues/gym/availability?date=03/04/2027");
    assert.equal(date.status, 400);
    const pay = await call(app.url, "/api/finance/deposits/EVT-0002/payments", { method: "POST", body: { amountPhp: -10 } });
    assert.equal(pay.status, 400);
    const reservation = await call(app.url, "/api/facilities/reservations", { method: "POST", body: { requestNo: "EVT-0100", venueId: "gym", date: "2027-03-04", hours: 99 } });
    assert.equal(reservation.status, 400);
  });

  test("[NFR-04] the source files hold no secrets or API keys", () => {
    const patterns = [/(api[_-]?key|secret|passw(or)?d|token)\s*[:=]\s*["'`][^"'`\s]{8,}/i, /\bsk-[A-Za-z0-9]{16,}/, /\bAKIA[0-9A-Z]{16}\b/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
    const folders = ["src", "web", "scripts", "."];
    const found = [];
    for (const folder of folders) {
      const dir = path.join(root, folder);
      for (const file of readdirSync(dir, { recursive: folder !== "." }).filter((f) => /\.(js|json|html)$/.test(f) && !f.includes("node_modules"))) {
        const full = path.join(dir, file);
        const text = readFileSync(full, "utf8");
        for (const p of patterns) if (p.test(text)) found.push(`${folder}/${file}`);
      }
    }
    assert.deepEqual(found, []);
  });
});

describe("[NFR-05] the reasons are plain language", () => {
  test("[NFR-05] the reasons of the seven seed requests are full sentences without codes", async () => {
    const app = await startApp({ external: createFakeExternal({ today: TODAY }) });
    try {
      const sentences = [];
      for (const requestNo of ["EVT-0001", "EVT-0002", "EVT-0003", "EVT-0004", "EVT-0005", "EVT-0007", "EVT-0008"]) {
        const res = await plan(app, requestNo);
        assert.equal(res.status, 200, requestNo);
        assert.ok(res.body.reasons.length > 0, requestNo);
        sentences.push(...res.body.reasons);
      }
      assert.ok(sentences.length >= 7);
      for (const s of sentences) {
        assert.match(s, /^[A-Z0-9]/, s);
        assert.match(s, /\.$/, s);
        assert.ok(s.split(" ").length >= 4, s);
        assert.doesNotMatch(s, /\b(BR|FR|NFR)-\d+/, s); // no rule codes
        assert.doesNotMatch(s, /[A-Z]{3,}_[A-Z_]+/, s); // no error codes such as ALREADY_RESERVED
        assert.doesNotMatch(s, /undefined|null|NaN|\[object/, s);
      }
    } finally {
      await app.close();
    }
  });
});

describe("[NFR-06] standards: JSON, ISO 8601 dates, ISO 4217 currency codes", () => {
  let app;
  before(async () => (app = await startApp()));
  after(() => app.close());

  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const dates = (value, found = []) => {
    if (Array.isArray(value)) value.forEach((v) => dates(v, found));
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) (k === "date" ? found.push(v) : dates(v, found));
    return found;
  };
  const currencies = (value, found = []) => {
    if (Array.isArray(value)) value.forEach((v) => currencies(v, found));
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) (k === "currency" ? found.push(v) : currencies(v, found));
    return found;
  };

  test("[NFR-06] every answer, success or error, is JSON", async () => {
    await plan(app, "EVT-0001");
    const paths = ["/api/requests", "/api/requests/EVT-0001", "/api/requests/EVT-0001/assessment", "/api/student-affairs/requests", "/api/finance/deposits/EVT-0001",
      "/api/facilities/venues", "/health", "/api/requests/EVT-9999", "/api/nothing-here", "/api/finance/deposits/EVT-9999"];
    for (const p of paths) {
      const res = await call(app.url, p);
      assert.match(res.headers.get("content-type"), /^application\/json/, p);
      if (res.status >= 400) assert.ok(res.body.error.code && res.body.error.message, `${p} has the error format`);
    }
  });

  test("[NFR-06] every date in the answers is ISO 8601 (2027-03-04), and every real date is valid", async () => {
    const answers = [await call(app.url, "/api/requests"), await call(app.url, "/api/requests/EVT-0001"), await call(app.url, "/api/student-affairs/requests"),
      await call(app.url, "/api/facilities/reservations"), await call(app.url, "/api/facilities/venues/gym/availability?date=2027-03-04"), await plan(app, "EVT-0008")];
    const all = answers.flatMap((a) => dates(a.body));
    assert.ok(all.length >= 15, `found ${all.length} dates`);
    for (const d of all) {
      assert.match(d, ISO_DATE, d);
      assert.equal(new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10), d);
    }
  });

  test("[NFR-06] every currency in the answers is a three-letter ISO 4217 code", async () => {
    const list = await call(app.url, "/api/requests");
    const found = currencies(list.body);
    assert.ok(found.length >= 7);
    for (const c of found) assert.match(c, /^[A-Z]{3}$/);
    assert.ok(found.includes("USD") && found.includes("PHP"));
  });
});

describe("[NFR-01] and [NFR-08]: planning time and a small load test", () => {
  let app;
  let results;
  const COUNT = 20;
  // Twenty requests at the same moment. Even numbers: Lab A, 35 people (approved). Odd numbers: Room 101 (penalty: returned).
  const body = (i) => newRequest(i % 2 === 0 ? { title: `Load ${i}` } : { title: `Load ${i}`, venue: "Room 101", attendees: 30 });

  before(async () => {
    // 20 ms of "network time" for each outside API makes the requests overlap, as in real life.
    app = await startApp({ external: createFakeExternal({ today: TODAY, delayMs: { holiday: 20, forecast: 20, convert: 20 } }) });
    await call(app.url, "/health"); // warm the code up first, as in a system that has been running
    await call(app.url, "/api/requests");
    const started = Date.now();
    const answers = await Promise.all(Array.from({ length: COUNT }, async (_, i) => {
      const t0 = Date.now();
      const res = await call(app.url, "/api/requests", { method: "POST", body: body(i) });
      return { i, res, ms: Date.now() - t0 };
    }));
    results = { answers, totalMs: Date.now() - started };
  });
  after(() => app.close());

  test("[NFR-08] 20 planning requests at the same moment all complete without an error, and each answer is correct", () => {
    assert.equal(results.answers.length, COUNT);
    for (const { i, res } of results.answers) {
      assert.equal(res.status, 201, `request ${i}`);
      assert.equal(res.body.decision, i % 2 === 0 ? "approved" : "returned", `request ${i}`);
      if (i % 2 === 1) assert.ok(res.body.reasons.some((r) => r.includes("unpaid penalty")), `request ${i}`);
    }
    assert.equal(new Set(results.answers.map((a) => a.res.body.requestNo)).size, COUNT, "every request has its own number");
  });

  test("[NFR-08] the batch fits in one minute, so the planner handles at least 20 requests per minute", () => {
    const perMinute = (COUNT / results.totalMs) * 60_000;
    assert.ok(results.totalMs < 60_000, `${results.totalMs} ms`);
    assert.ok(perMinute >= 20, `${perMinute} per minute`);
  });

  test("[NFR-01] the 95th percentile of the planning times is within 3000 ms", () => {
    const times = results.answers.map((a) => a.ms).sort((a, b) => a - b);
    const p95 = times[Math.ceil(0.95 * times.length) - 1];
    assert.ok(p95 <= 3000, `p95 = ${p95} ms`);
  });

  test("[NFR-08] the queue delivered one notice for each of the 20 requests", async () => {
    await until(() => app.mails.length === COUNT, 5000);
    assert.equal(new Set(app.mails.map((m) => m.subject)).size, COUNT);
    assert.equal(app.queue.stats().dead, 0);
  });
});
