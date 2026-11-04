// Integration tests of the WHOLE application: real services, real gateway, real queue and notifier, real planner,
// all on free ports (listen(0)). Only the outside APIs are fake. Every test carries the tag of the requirement it verifies.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createFakeExternal } from "../src/gateway/fakes.js";
import { call, newRequest, startApp, TODAY, until } from "./ep15-support.js";

const plan = (app, requestNo) => call(app.url, `/api/requests/${requestNo}/assessment`, { method: "POST" });
const submit = (app, extra) => call(app.url, "/api/requests", { method: "POST", body: newRequest(extra) });

describe("the whole application, healthy world", () => {
  let app;
  // 2027-03-02 is a rainy day (70 percent), every other day is dry (20 percent).
  const external = () => createFakeExternal({ today: TODAY, rainChance: (date) => (date === "2027-03-02" ? 70 : 20) });
  before(async () => (app = await startApp({ external: external() })));
  after(() => app.close());

  test("[FR-01] a request without a venue is answered 400, lists venue, and nothing is created", async () => {
    const before = (await call(app.url, "/api/requests")).body.length;
    const { venue, ...incomplete } = newRequest();
    const res = await call(app.url, "/api/requests", { method: "POST", body: incomplete });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.missing, ["venue"]);
    assert.equal((await call(app.url, "/api/requests")).body.length, before);
  });

  test("[FR-01] a complete request is accepted: 201, a request number and a Location header", async () => {
    const res = await submit(app);
    assert.equal(res.status, 201);
    assert.match(res.body.requestNo, /^EVT-\d{4}$/);
    assert.equal(res.headers.get("location"), `/api/requests/${res.body.requestNo}/assessment`);
  });

  test("[FR-02] the Christmas request fails the holiday check and names the holiday; a normal date passes", async () => {
    const christmas = await plan(app, "EVT-0008");
    assert.equal(christmas.body.checks.holiday.status, "failed");
    assert.ok(christmas.body.checks.holiday.reasons.includes("The date is a public holiday: Christmas Day."));
    const normal = await plan(app, "EVT-0001");
    assert.equal(normal.body.checks.holiday.status, "passed");
  });

  test("[FR-03] a venue that is too small, or reserved on the date, fails the venue check", async () => {
    const small = await submit(app, { venue: "Room 101", attendees: 80 });
    assert.equal(small.body.checks.venue.status, "failed");
    assert.ok(small.body.checks.venue.reasons.includes("Room 101 is too small for 80 people."));
    const taken = await submit(app, { venue: "Gym", date: "2027-03-05", attendees: 50 }); // the Gym is reserved by EVT-0006
    assert.ok(taken.body.checks.venue.reasons.includes("Gym is already reserved on 2027-03-05."));
    const free = await plan(app, "EVT-0001");
    assert.equal(free.body.checks.venue.status, "passed");
  });

  test("[FR-04] an unpaid facility penalty fails the venue check (EVT-0002, Room 101)", async () => {
    const res = await plan(app, "EVT-0002");
    assert.equal(res.body.checks.venue.status, "failed");
    assert.ok(res.body.checks.venue.reasons.includes("Room 101 has an unpaid penalty of 50 pesos, so it cannot be reserved."));
    assert.equal(res.body.checks.venue.penaltyPhp, 50);
  });

  test("[FR-05] an outdoor event with 70 percent rain fails the weather check; with 20 percent it passes; indoors it is skipped", async () => {
    const wet = await submit(app, { venue: "Field", attendees: 100, outdoor: true, date: "2027-03-02" });
    assert.equal(wet.body.checks.weather.status, "failed");
    assert.equal(wet.body.checks.weather.rainChancePercent, 70);
    const dry = await submit(app, { venue: "Field", attendees: 100, outdoor: true, date: "2027-03-03" });
    assert.equal(dry.body.checks.weather.status, "passed");
    const indoor = await plan(app, "EVT-0001");
    assert.equal(indoor.body.checks.weather.needed, false);
  });

  test("[FR-06] a deposit that is not fully paid fails the budget check with the amount still due (EVT-0002)", async () => {
    const res = await plan(app, "EVT-0002");
    assert.equal(res.body.checks.budget.status, "failed");
    assert.equal(res.body.checks.budget.balancePhp, 1500.5);
    assert.ok(res.body.checks.budget.reasons.includes("The deposit is not fully paid: 1,500.5 pesos are still due."));
    assert.equal((await plan(app, "EVT-0001")).body.checks.budget.status, "passed");
  });

  test("[FR-07] a budget in dollars is converted to pesos at the latest rate (500 USD at 63.46)", async () => {
    const res = await plan(app, "EVT-0004");
    assert.equal(res.body.checks.budget.amountPhp, 31730);
    assert.equal(res.body.checks.budget.rate, 63.46);
    const pesos = await plan(app, "EVT-0001");
    assert.equal(pesos.body.checks.budget.amountPhp, 15000);
    assert.equal(pesos.body.checks.budget.rate, 1);
  });

  test("[FR-08] a request is approved only when all four checks passed", async () => {
    const approved = await plan(app, "EVT-0001");
    assert.equal(approved.body.decision, "approved");
    for (const check of Object.values(approved.body.checks)) assert.equal(check.status, "passed");
    for (const requestNo of ["EVT-0002", "EVT-0004", "EVT-0008"]) {
      const res = await plan(app, requestNo);
      assert.equal(res.body.decision, "returned", requestNo);
      assert.ok(Object.values(res.body.checks).some((c) => c.status === "failed"), requestNo);
    }
  });

  test("[FR-09] after the decision the status of the request in Student Affairs is Approved, or Returned", async () => {
    await plan(app, "EVT-0001");
    await plan(app, "EVT-0002");
    assert.equal((await call(app.url, "/api/requests/EVT-0001")).body.status, "Approved");
    assert.equal((await call(app.url, "/api/requests/EVT-0002")).body.status, "Returned");
    assert.equal((await call(app.url, "/api/student-affairs/requests/EVT-0001")).body.status, "Approved");
  });

  test("[FR-10] a returned request carries the reason of EVERY failed check, and the answer is stored", async () => {
    const answer = await plan(app, "EVT-0002");
    assert.equal(answer.body.decision, "returned");
    assert.equal(answer.body.reasons.length, 2);
    assert.match(answer.body.reasons.join(" "), /unpaid penalty of 50 pesos/);
    assert.match(answer.body.reasons.join(" "), /1,500.5 pesos are still due/);
    const stored = await call(app.url, "/api/requests/EVT-0002/assessment");
    assert.deepEqual(stored.body.reasons, answer.body.reasons);
  });

  test("[FR-11] the queue delivers ONE notice to the organizer, with the decision and its reasons", async () => {
    const fresh = await startApp({ external: external() });
    try {
      await plan(fresh, "EVT-0002");
      await until(() => fresh.mails.length === 1);
      assert.equal(fresh.mails[0].to, "nursing@campus.example");
      assert.match(fresh.mails[0].subject, /EVT-0002 returned to you/);
      assert.match(fresh.mails[0].body, /unpaid penalty of 50 pesos/);
      await plan(fresh, "EVT-0002"); // the same decision again: the notifier does not mail twice
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(fresh.mails.length, 1);
    } finally {
      await fresh.close();
    }
  });
});

describe("the planner with one outside API down", () => {
  // A paid-up outdoor event, so that the only trouble is the outage. EVT-0009 gets a deposit in campusData().
  const outdoor = { venue: "Lab A", attendees: 30, outdoor: true, date: "2027-03-03" };

  for (const [api, down] of [["Nager.Date", "holiday"], ["Open-Meteo", "forecast"], ["Frankfurter", "convert"]]) {
    test(`[FR-12] [NFR-02] ${api} down: the planner still answers, and the decision is needs-review`, async () => {
      const app = await startApp({ external: createFakeExternal({ today: TODAY, down: [down] }) });
      try {
        const res = await submit(app, { ...outdoor, budget: { amount: 100, currency: down === "convert" ? "USD" : "PHP" } });
        assert.equal(res.status, 201);
        assert.equal(res.body.decision, "needs-review");
        assert.equal(Object.values(res.body.checks).filter((c) => c.status === "unknown").length, 1);
        assert.match(res.body.reasons[0], /^We could not (check|convert|read)/);
        // needs-review leaves the status alone: an officer decides.
        assert.equal((await call(app.url, `/api/requests/${res.body.requestNo}`)).body.status, "Pending");
      } finally {
        await app.close();
      }
    });
  }

  test("[FR-12] when another check already failed, an outage does not hide it: the decision is returned", async () => {
    const app = await startApp({ external: createFakeExternal({ today: TODAY, down: ["holiday"] }) });
    try {
      const res = await plan(app, "EVT-0002"); // the unpaid penalty fails the venue check
      assert.equal(res.body.checks.holiday.status, "unknown");
      assert.equal(res.body.decision, "returned");
    } finally {
      await app.close();
    }
  });

  test("[NFR-02] all three outside APIs down at once: still an answer in plain language, never a crash", async () => {
    const app = await startApp({ external: createFakeExternal({ today: TODAY, down: ["holiday", "forecast", "convert"] }) });
    try {
      const res = await submit(app, { ...outdoor, budget: { amount: 100, currency: "USD" } });
      assert.equal(res.status, 201);
      assert.equal(res.body.decision, "needs-review");
      assert.equal(res.body.reasons.length, 3);
    } finally {
      await app.close();
    }
  });
});
