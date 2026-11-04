// Integration tests with FAILING DEPENDENCIES: a service that is off, a service that is slow, a queue handler that
// fails, an outside API that fails on the first tries. The question is always the same: what does the planner do?
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { call, createFakeWeb, externalOver, newRequest, startApp, TODAY, until } from "./ep15-support.js";

const plan = (app, requestNo) => call(app.url, `/api/requests/${requestNo}/assessment`, { method: "POST" });
const using = async (app, run) => {
  try {
    return await run(app);
  } finally {
    await app.close();
  }
};

describe("a campus service fails", () => {
  test("[FR-12] [NFR-02] Finance is off: the budget check is unknown, the decision is needs-review", async () => {
    await using(await startApp(), async (app) => {
      await app.stop("finance");
      const res = await plan(app, "EVT-0001");
      assert.equal(res.status, 200);
      assert.equal(res.body.decision, "needs-review");
      assert.equal(res.body.checks.budget.status, "unknown");
      assert.ok(res.body.reasons.includes("We could not read the deposit, because the Finance system did not answer."));
      assert.equal(res.body.checks.holiday.status, "passed"); // the other checks still ran
    });
  });

  test("[NFR-06] Finance is off: the gateway answers 502 with the JSON error format, and /health says degraded", async () => {
    await using(await startApp(), async (app) => {
      await app.stop("finance");
      const direct = await call(app.url, "/api/finance/deposits/EVT-0001");
      assert.equal(direct.status, 502);
      assert.equal(direct.body.error.code, "BAD_GATEWAY");
      assert.ok(direct.headers.get("x-request-id"));
      const health = await call(app.url, "/health");
      assert.equal(health.body.status, "degraded");
      assert.deepEqual(health.body.services, { studentAffairs: "up", finance: "down", facilities: "up" });
    });
  });

  test("[NFR-02] Facilities is off: the venue check is unknown and the planner still answers", async () => {
    await using(await startApp(), async (app) => {
      await app.stop("facilities");
      const res = await plan(app, "EVT-0001");
      assert.equal(res.body.checks.venue.status, "unknown");
      assert.equal(res.body.decision, "needs-review");
    });
  });

  test("[NFR-06] Student Affairs is slow: the planner answers 504 within the time limit, in the JSON error format", async () => {
    let slow = null; // the base URL that "hangs" (set when the application is running)
    const hang = (url, init) => new Promise((resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)));
    const fetchWithSlowAffairs = (url, init) => (slow && String(url).startsWith(slow) ? hang(url, init) : fetch(url, init));

    await using(await startApp({ fetch: fetchWithSlowAffairs, timeoutMs: 150 }), async (app) => {
      slow = app.services.studentAffairs;
      const started = Date.now();
      const created = await call(app.url, "/api/requests", { method: "POST", body: newRequest() });
      assert.equal(created.status, 504);
      assert.equal(created.body.error.code, "GATEWAY_TIMEOUT");
      assert.ok(Date.now() - started < 2000, "the answer comes after the time limit, not never");
      const proxied = await call(app.url, "/api/student-affairs/requests");
      assert.equal(proxied.status, 504);
      assert.equal(proxied.body.error.code, "GATEWAY_TIMEOUT");
      slow = null; // the service recovers: the next call works
      assert.equal((await call(app.url, "/api/student-affairs/requests")).status, 200);
    });
  });
});

describe("the queue handler fails", () => {
  test("[FR-11] [NFR-03] the mail server fails twice and then works: the notice is delivered ONCE after three attempts", async () => {
    const sent = [];
    let attempts = 0;
    const flakySend = async (message) => {
      attempts++;
      if (attempts <= 2) throw new Error("mail server busy");
      sent.push(message);
    };
    const pauses = [];
    await using(await startApp({ send: flakySend, sleep: async (ms) => void pauses.push(ms) }), async (app) => {
      const res = await plan(app, "EVT-0001");
      assert.equal(res.status, 200); // the planner did not wait for the mail
      await until(() => app.queue.stats().delivered === 1);
      assert.equal(attempts, 3);
      assert.equal(sent.length, 1);
      assert.deepEqual(app.queue.stats(), { delivered: 1, retried: 2, dead: 0 });
      assert.deepEqual(pauses, [100, 400]); // the backoff grows
      assert.equal(app.queue.deadLetters.length, 0);
    });
  });

  test("[FR-11] the mail server never works: the message becomes a dead letter, and the planner answer is not affected", async () => {
    const broken = async () => {
      throw new Error("mail server down");
    };
    await using(await startApp({ send: broken }), async (app) => {
      const res = await plan(app, "EVT-0001");
      assert.equal(res.body.decision, "approved");
      await until(() => app.queue.stats().dead === 1);
      assert.equal(app.queue.deadLetters[0].payload.requestNo, "EVT-0001");
      assert.equal(app.queue.deadLetters[0].attempts, 3);
      assert.equal((await call(app.url, "/api/requests/EVT-0001")).body.status, "Approved");
    });
  });
});

describe("the real outside-API protection (cache, retry, circuit breaker) with a fake fetch", () => {
  test("[NFR-03] Nager.Date fails twice, then answers: the third attempt succeeds and the check passes", async () => {
    const web = createFakeWeb({ failFirst: { nager: 2 } });
    await using(await startApp({ external: externalOver(web) }), async (app) => {
      const res = await plan(app, "EVT-0003");
      assert.equal(web.calls.nager, 3);
      assert.equal(res.body.checks.holiday.status, "passed");
      assert.equal(res.body.decision, "approved");
    });
  });

  test("[NFR-03] Nager.Date never answers: exactly 3 attempts, then needs-review (not more, not a crash)", async () => {
    const web = createFakeWeb({ down: ["nager"] });
    await using(await startApp({ external: externalOver(web) }), async (app) => {
      const res = await plan(app, "EVT-0003");
      assert.equal(web.calls.nager, 3);
      assert.equal(res.body.decision, "needs-review");
      assert.equal(res.body.checks.holiday.status, "unknown");
    });
  });

  test("[NFR-03] Frankfurter fails twice, then answers: the dollars are converted after the third attempt", async () => {
    const web = createFakeWeb({ failFirst: { frankfurter: 2 } });
    await using(await startApp({ external: externalOver(web) }), async (app) => {
      const res = await plan(app, "EVT-0004");
      assert.equal(web.calls.frankfurter, 3);
      assert.equal(res.body.checks.budget.amountPhp, 31730);
    });
  });

  test("[FR-02] [NFR-01] the real adapter finds Christmas, and the cache answers the second request without a call", async () => {
    const web = createFakeWeb();
    await using(await startApp({ external: externalOver(web) }), async (app) => {
      const first = await plan(app, "EVT-0008");
      assert.ok(first.body.checks.holiday.reasons.includes("The date is a public holiday: Christmas Day."));
      assert.equal(web.calls.nager, 1);
      await plan(app, "EVT-0008");
      assert.equal(web.calls.nager, 1, "the holidays of the year come from the cache");
    });
  });

  test("[FR-05] the real weather service reads the forecast of Open-Meteo for an outdoor event", async () => {
    const web = createFakeWeb({ rain: 75 });
    await using(await startApp({ external: externalOver(web) }), async (app) => {
      const res = await call(app.url, "/api/requests", { method: "POST", body: newRequest({ venue: "Field", attendees: 90, outdoor: true, date: "2027-03-03" }) });
      assert.equal(res.body.checks.weather.status, "failed");
      assert.equal(res.body.checks.weather.rainChancePercent, 75);
      assert.equal(web.calls.openMeteo, 1);
    });
  });

  test("[NFR-02] after repeated failures the circuit breaker opens: no more calls to the broken API", async () => {
    const web = createFakeWeb({ down: ["nager"], today: TODAY });
    await using(await startApp({ external: externalOver(web) }), async (app) => {
      for (let i = 0; i < 3; i++) await plan(app, "EVT-0003"); // three failed rounds of three attempts
      assert.equal(web.calls.nager, 9);
      const fourth = await plan(app, "EVT-0003");
      assert.equal(web.calls.nager, 9, "the breaker is open, so there was no call");
      assert.equal(fourth.body.decision, "needs-review");
      assert.match(fourth.body.checks.holiday.detail, /circuit open/);
    });
  });
});
