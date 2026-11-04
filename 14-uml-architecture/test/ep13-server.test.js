import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import express from "express";
import { createFakeExternal } from "../src/gateway/fakes.js";
import { createClients } from "../src/gateway/clients.js";
import { plannerRoutes } from "../src/gateway/routes.js";
import { call, newRequest, startPlanner, startServices, TODAY } from "./ep13-fixtures.js";

describe("the planner routes behind the real gateway", () => {
  let planner;
  before(async () => (planner = await startPlanner()));
  after(() => planner.close());

  test("[FR-01] a request without a venue is answered 400 with the missing fields, and nothing is created", async () => {
    const before = (await call(planner.url, "/api/requests")).body.length;
    const { venue, ...incomplete } = newRequest();
    const res = await call(planner.url, "/api/requests", { method: "POST", body: incomplete });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_FAILED");
    assert.deepEqual(res.body.error.missing, ["venue"]);
    assert.equal((await call(planner.url, "/api/requests")).body.length, before);
  });
  test("[FR-01] a complete request is answered 201 with a Location and the assessment", async () => {
    const res = await call(planner.url, "/api/requests", { method: "POST", body: newRequest() });
    assert.equal(res.status, 201);
    assert.match(res.body.requestNo, /^EVT-\d{4}$/);
    assert.equal(res.headers.get("location"), `/api/requests/${res.body.requestNo}/assessment`);
    assert.deepEqual(Object.keys(res.body.checks), ["holiday", "venue", "weather", "budget"]);
    assert.ok(["approved", "returned", "needs-review"].includes(res.body.decision));
  });
  test("a new request has no deposit record in Finance, so it is returned with that reason", async () => {
    const res = await call(planner.url, "/api/requests", { method: "POST", body: newRequest({ title: "Another quiz" }) });
    assert.equal(res.body.decision, "returned");
    assert.ok(res.body.reasons.includes("No deposit has been recorded for this request."));
  });
  test("[NFR-04] input that is not valid is answered 400, bad JSON as well", async () => {
    const bad = await call(planner.url, "/api/requests", { method: "POST", body: newRequest({ attendees: -5, date: "tomorrow" }) });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body.error.invalid.sort(), ["attendees", "date"]);
    const json = await call(planner.url, "/api/requests", { method: "POST", raw: "{not json" });
    assert.equal(json.status, 400);
    assert.equal(json.body.error.code, "BAD_JSON");
  });
  test("GET assessment: 404 before the request was planned, 200 after", async () => {
    const early = await call(planner.url, "/api/requests/EVT-0007/assessment");
    assert.equal(early.status, 404);
    assert.equal(early.body.error.code, "NOT_FOUND");
    await call(planner.url, "/api/requests/EVT-0007/assessment", { method: "POST" });
    const later = await call(planner.url, "/api/requests/EVT-0007/assessment");
    assert.equal(later.status, 200);
    assert.equal(later.body.requestNo, "EVT-0007");
  });
  test("[FR-09] planning EVT-0001 approves it, and Student Affairs shows the new status through the gateway", async () => {
    const res = await call(planner.url, "/api/requests/EVT-0001/assessment", { method: "POST" });
    assert.equal(res.status, 200);
    assert.equal(res.body.decision, "approved");
    const stored = await call(planner.url, "/api/student-affairs/requests/EVT-0001");
    assert.equal(stored.body.status, "Approved");
  });
  test("planning an unknown request is answered 404", async () => {
    const res = await call(planner.url, "/api/requests/EVT-9999/assessment", { method: "POST" });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });
  test("GET /api/requests lists the requests, each with the decision of its last assessment", async () => {
    const res = await call(planner.url, "/api/requests");
    assert.equal(res.status, 200);
    assert.equal(res.body.find((r) => r.requestNo === "EVT-0001").decision, "approved");
    assert.equal(res.body.find((r) => r.requestNo === "EVT-0002").decision, null);
  });
  test("[FR-11] after the assessment the queue delivers one e-mail to the organizer", async () => {
    await planner.queue.drain();
    const mail = planner.mails.find((m) => m.subject.includes("EVT-0001"));
    assert.equal(mail.to, "csoc@campus.example");
    assert.match(mail.subject, /approved/);
  });
  test("the gateway still adds the X-Request-Id header and answers /health", async () => {
    const res = await call(planner.url, "/health");
    assert.equal(res.status, 200);
    assert.ok(res.headers.get("x-request-id"));
    assert.equal(res.body.status, "ok");
  });
  test("[NFR-06] the answers are JSON, and the dates are written like 2027-03-04", async () => {
    const res = await call(planner.url, "/api/requests/EVT-0001/assessment");
    assert.match(res.headers.get("content-type"), /application\/json/);
    const list = await call(planner.url, "/api/requests");
    for (const r of list.body) assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/);
  });
  test("the web page is served at / and its files next to it", async () => {
    const page = await call(planner.url, "/");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.match(page.body, /<title>Campus Event Planner<\/title>/);
    for (const file of ["styles.css", "app.js", "render.js"]) assert.equal((await call(planner.url, `/${file}`)).status, 200, file);
  });
  test("a route that does not exist is still the gateway's 404", async () => {
    const res = await call(planner.url, "/api/nothing-here");
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });
});

describe("the seven seed requests", () => {
  let planner;
  before(async () => (planner = await startPlanner()));
  after(() => planner.close());

  // With fake outside services (today 2027-02-20) the seven requests of episode 9 give these decisions.
  const EXPECTED = { "EVT-0001": "approved", "EVT-0002": "returned", "EVT-0003": "approved", "EVT-0004": "returned", "EVT-0005": "returned", "EVT-0007": "returned", "EVT-0008": "returned" };
  for (const [requestNo, decision] of Object.entries(EXPECTED)) {
    test(`${requestNo} is ${decision}`, async () => {
      const res = await call(planner.url, `/api/requests/${requestNo}/assessment`, { method: "POST" });
      assert.equal(res.body.decision, decision);
    });
  }
  test("[NFR-05] the reasons of the seven requests are full sentences and show no codes", async () => {
    for (const requestNo of Object.keys(EXPECTED)) {
      const { body } = await call(planner.url, `/api/requests/${requestNo}/assessment`);
      assert.ok(body.reasons.length > 0, requestNo);
      for (const reason of body.reasons) {
        assert.match(reason, /^[A-Z].*\.$/, reason);
        assert.doesNotMatch(reason, /\b(BR|FR|NFR)-\d+/, reason);
      }
    }
  });
  test("[FR-02] EVT-0008 on Christmas Day is returned with the name of the holiday", async () => {
    const { body } = await call(planner.url, "/api/requests/EVT-0008/assessment");
    assert.ok(body.reasons.includes("The date is a public holiday: Christmas Day."));
  });
  test("[FR-04] EVT-0007 in Room 101 is returned because of the unpaid penalty", async () => {
    const { body } = await call(planner.url, "/api/requests/EVT-0007/assessment");
    assert.equal(body.checks.venue.status, "failed");
    assert.match(body.reasons[0], /unpaid penalty of 50 pesos/);
  });
  test("[FR-06] EVT-0004 is returned because 320 pesos are still due", async () => {
    const { body } = await call(planner.url, "/api/requests/EVT-0004/assessment");
    assert.equal(body.checks.budget.balancePhp, 320);
    assert.equal(body.checks.budget.amountPhp, 31730);
  });
  test("[NFR-08] 20 planning requests in a row are handled without an error", async () => {
    const results = [];
    for (let i = 0; i < 20; i++) results.push(await call(planner.url, "/api/requests/EVT-0001/assessment", { method: "POST" }));
    assert.ok(results.every((r) => r.status === 200));
  });
});

describe("outside services and internal services that fail", () => {
  test("[NFR-02] the holiday service is down: the answer is 201 with needs-review", async () => {
    const planner = await startPlanner({ external: createFakeExternal({ today: TODAY, down: ["holiday"] }) });
    const res = await call(planner.url, "/api/requests/EVT-0003/assessment", { method: "POST" });
    assert.equal(res.status, 200);
    assert.equal(res.body.decision, "needs-review");
    assert.equal(res.body.status, "Pending");
    await planner.close();
  });
  test("Student Affairs is not running: the gateway answers 502 and says which service", async () => {
    const planner = await startPlanner({ services: { studentAffairs: "http://127.0.0.1:1", finance: "http://127.0.0.1:1", facilities: "http://127.0.0.1:1" } });
    const res = await call(planner.url, "/api/requests/EVT-0001/assessment", { method: "POST" });
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, "BAD_GATEWAY");
    assert.match(res.body.error.message, /student-affairs/);
    await planner.close();
  });
});

describe("plannerRoutes with a minimal gateway of our own (no episode 11 needed)", () => {
  // A gateway reduced to what the routes need: the extend hook and a 404.
  const miniGateway = ({ extend }) => {
    const app = express();
    extend(app);
    app.use((req, res) => res.status(404).json({ error: { code: "NOT_FOUND" } }));
    return app;
  };
  let campus;
  let server;
  before(async () => {
    campus = await startServices();
    const clients = createClients(campus.services);
    const queue = { publish() {}, drain: async () => {} };
    const routes = plannerRoutes({ clients, external: createFakeExternal({ today: TODAY }), queue, today: TODAY });
    server = miniGateway({ extend: routes.extend }).listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
  });
  after(async () => {
    server.closeAllConnections();
    server.close();
    await campus.close();
  });

  test("POST /api/requests plans the new request", async () => {
    const res = await call(`http://127.0.0.1:${server.address().port}`, "/api/requests", { method: "POST", body: newRequest() });
    assert.equal(res.status, 201);
    assert.equal(res.body.checks.venue.status, "passed");
  });
  test("the web folder is served as static files", async () => {
    const res = await call(`http://127.0.0.1:${server.address().port}`, "/render.js");
    assert.equal(res.status, 200);
    assert.match(res.body, /export const escapeHtml/);
  });
});
