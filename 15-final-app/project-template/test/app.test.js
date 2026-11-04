// The whole template application: real services, gateway and queue on free ports; fake outside APIs.
// The tests carry the tags of the requirements they verify: [FR-01], [FR-02], [NFR-01], [NFR-02].
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createFakeExternal } from "../src/external.js";
import { decide } from "../src/gateway/plan.js";
import { call, goodRequest, startApp, submit, until } from "./support.js";

describe("planning with healthy fake outside APIs", () => {
  let app;
  before(async () => (app = await startApp()));
  after(() => app.close());

  test("POST /api/requests approves a good request: 201, a Location header, four passed checks", async () => {
    const res = await submit(app);
    assert.equal(res.status, 201);
    assert.equal(res.body.decision, "approved");
    assert.equal(res.headers.get("location"), `/api/requests/${res.body.requestId}/assessment`);
    assert.deepEqual(Object.keys(res.body.checks), ["date", "customer", "stock", "payment"]);
  });

  test("[FR-01] POST /api/requests without a quantity is answered 400 and lists quantity", async () => {
    const { quantity, ...incomplete } = goodRequest();
    const res = await call(app.url, "/api/requests", { method: "POST", body: incomplete });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.missing, ["quantity"]);
  });

  test("[FR-02] the stock check fails when the stock is lower than the quantity (Laptop: 0 in stock)", async () => {
    const res = await submit(app, { itemId: "2", quantity: 1 });
    assert.equal(res.body.checks.stock.status, "failed");
    assert.equal(res.body.decision, "returned");
    assert.ok(res.body.reasons.includes("Only 0 of Laptop are in stock, and 1 were requested."));
  });

  test("[FR-02] the stock check passes when the stock is enough (Projector: 5 in stock, 2 asked)", async () => {
    assert.equal((await submit(app, { itemId: "1", quantity: 2 })).body.checks.stock.status, "passed");
  });

  test("the other rows of the table: a holiday, an owing customer, an inactive customer", async () => {
    assert.ok((await submit(app, { date: "2027-12-25" })).body.reasons.includes("The date is a public holiday: Christmas Day."));
    assert.ok((await submit(app, { customerId: "2" })).body.reasons.includes("The customer still owes 250.5 on the account."));
    assert.ok((await submit(app, { customerId: "3" })).body.reasons.includes("The customer Carla Diaz is not active."));
  });

  test("GET /api/requests/{requestId}/assessment returns the stored answer, or 404", async () => {
    const created = await submit(app);
    const stored = await call(app.url, `/api/requests/${created.body.requestId}/assessment`);
    assert.deepEqual(stored.body, created.body);
    assert.equal((await call(app.url, "/api/requests/R-9999/assessment")).status, 404);
  });

  test("GET /health asks the three services", async () => {
    const res = await call(app.url, "/health");
    assert.deepEqual(res.body, { status: "ok", services: { customers: "up", items: "up", accounts: "up" } });
  });

  test("the queue delivers a message to the customer, once for each decision", async () => {
    const fresh = await startApp();
    try {
      await submit(fresh);
      await until(() => fresh.mails.length === 1);
      assert.equal(fresh.mails[0].to, "ana@example.com");
      assert.match(fresh.mails[0].subject, /approved/);
    } finally {
      await fresh.close();
    }
  });

  test("[NFR-01] the 95th percentile of 20 planning times is within 3000 ms", async () => {
    await submit(app); // a first request warms the code up, as in a real system that has been running
    const times = [];
    await Promise.all(Array.from({ length: 20 }, async () => {
      const t0 = Date.now();
      assert.equal((await submit(app)).status, 201);
      times.push(Date.now() - t0);
    }));
    times.sort((a, b) => a - b);
    assert.ok(times[Math.ceil(0.95 * times.length) - 1] <= 3000);
  });
});

describe("planning when something is down", () => {
  test("[NFR-02] the holiday API is down: the planner still answers, and the decision is needs-review", async () => {
    const app = await startApp({ external: createFakeExternal({ down: ["holiday"] }) });
    try {
      const res = await submit(app);
      assert.equal(res.status, 201);
      assert.equal(res.body.decision, "needs-review");
      assert.equal(res.body.checks.date.status, "unknown");
      assert.equal(res.body.checks.customer.status, "passed"); // the other checks still ran
    } finally {
      await app.close();
    }
  });

  test("[NFR-02] a campus service is down (accounts): needs-review, and the gateway answers 502 for that service", async () => {
    const app = await startApp();
    try {
      await app.stop("accounts");
      const res = await submit(app);
      assert.equal(res.body.decision, "needs-review");
      assert.equal(res.body.checks.payment.status, "unknown");
      const direct = await call(app.url, "/api/accounts/accounts");
      assert.equal(direct.status, 502);
      assert.equal(direct.body.error.code, "BAD_GATEWAY");
    } finally {
      await app.close();
    }
  });

  test("[NFR-02] when one check failed and another is unknown, the decision is returned", async () => {
    const app = await startApp({ external: createFakeExternal({ down: ["holiday"] }) });
    try {
      assert.equal((await submit(app, { itemId: "2", quantity: 1 })).body.decision, "returned");
    } finally {
      await app.close();
    }
  });
});

describe("decide(): the decision gateway", () => {
  const checks = (...statuses) => Object.fromEntries(statuses.map((status, i) => [`c${i}`, { status }]));
  test("failed wins over unknown, unknown wins over passed", () => {
    assert.equal(decide(checks("passed", "passed")), "approved");
    assert.equal(decide(checks("passed", "unknown")), "needs-review");
    assert.equal(decide(checks("unknown", "failed")), "returned");
  });
});
