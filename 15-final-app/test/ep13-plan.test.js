import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createQueue } from "../src/queue.js";
import { createFakeClients, createFakeExternal, createInFlight } from "../src/gateway/fakes.js";
import { ClientError } from "../src/gateway/clients.js";
import { collectReasons, decide, planEvent } from "../src/gateway/plan.js";

const TODAY = "2027-02-20";

// One planner run with fakes. `request` changes the request, the other options change what the services answer.
async function plan({ request, clients = {}, external = {}, queue = createQueue({ sleep: async () => {} }) } = {}) {
  const fakeClients = createFakeClients({ request, ...clients });
  const fakeExternal = createFakeExternal({ today: TODAY, ...external });
  const result = await planEvent("EVT-0001", { clients: fakeClients, external: fakeExternal, queue, today: TODAY });
  return { result, clients: fakeClients, external: fakeExternal, queue };
}

describe("T02 holiday check (BR-01)", () => {
  test("[FR-02] a public holiday returns the request and names the holiday", async () => {
    const { result } = await plan({ request: { date: "2027-12-25" } });
    assert.equal(result.checks.holiday.status, "failed");
    assert.equal(result.decision, "returned");
    assert.ok(result.reasons.includes("The date is a public holiday: Christmas Day."));
  });
  test("[FR-02] a date that is not a holiday passes the check", async () => {
    const { result } = await plan();
    assert.equal(result.checks.holiday.status, "passed");
  });
});

describe("T03 venue check (BR-03, BR-04)", () => {
  test("[FR-03] a venue that is already reserved fails the check", async () => {
    const { result } = await plan({ clients: { availability: async () => ({ available: false, capacityOk: true, penaltyPhp: 0 }) } });
    assert.equal(result.checks.venue.status, "failed");
    assert.match(result.checks.venue.reasons[0], /already reserved on 2027-03-04/);
  });
  test("[FR-03] a venue that is too small fails the check", async () => {
    const { result } = await plan({ request: { venue: "Room 101", attendees: 80 }, clients: { availability: async () => ({ available: true, capacityOk: false, penaltyPhp: 0 }) } });
    assert.equal(result.checks.venue.status, "failed");
    assert.equal(result.checks.venue.reasons[0], "Room 101 is too small for 80 people.");
  });
  test("[FR-04] an unpaid penalty fails the check", async () => {
    const { result } = await plan({ request: { venue: "Room 101" }, clients: { availability: async () => ({ available: true, capacityOk: true, penaltyPhp: 50 }) } });
    assert.equal(result.checks.venue.status, "failed");
    assert.match(result.checks.venue.reasons[0], /unpaid penalty of 50 pesos/);
  });
  test("[FR-04] a venue without a penalty passes", async () => {
    const { result } = await plan();
    assert.equal(result.checks.venue.status, "passed");
    assert.equal(result.checks.venue.penaltyPhp, 0);
  });
  test("[FR-03] a venue that Facilities does not know fails with a clear sentence", async () => {
    const { result } = await plan({ request: { venue: "Moon" }, clients: { availability: async () => null } });
    assert.equal(result.checks.venue.status, "failed");
    assert.equal(result.checks.venue.reasons[0], "We do not know a venue called Moon.");
  });
  test("[FR-10] a venue with two problems lists both reasons", async () => {
    const { result } = await plan({ clients: { availability: async () => ({ available: false, capacityOk: false, penaltyPhp: 0 }) } });
    assert.equal(result.checks.venue.reasons.length, 2);
  });
});

describe("T04 weather check (BR-02)", () => {
  const outdoor = { outdoor: true, date: "2027-02-25" };
  test("[FR-05] an outdoor event with a rain chance of 70 percent fails", async () => {
    const { result } = await plan({ request: outdoor, external: { rainChance: 70 } });
    assert.equal(result.checks.weather.status, "failed");
    assert.match(result.checks.weather.reasons[0], /70 percent/);
    assert.equal(result.decision, "returned");
  });
  test("[FR-05] the limit is 60 percent: 59 passes, 60 fails", async () => {
    assert.equal((await plan({ request: outdoor, external: { rainChance: 59 } })).result.checks.weather.status, "passed");
    assert.equal((await plan({ request: outdoor, external: { rainChance: 60 } })).result.checks.weather.status, "failed");
  });
  test("[FR-05] an indoor event skips the weather check and never asks for a forecast", async () => {
    const { result, external } = await plan();
    assert.equal(result.checks.weather.needed, false);
    assert.equal(result.checks.weather.status, "passed");
    assert.equal(external.calls.filter((c) => c.name === "forecast").length, 0);
  });
  test("a date too far ahead for a forecast makes the check unknown", async () => {
    const { result } = await plan({ request: { outdoor: true, date: "2027-12-25" }, external: { holidays: {} } });
    assert.equal(result.checks.weather.status, "unknown");
    assert.match(result.checks.weather.reasons[0], /no forecast for 2027-12-25 yet/);
  });
});

describe("T05 budget check (BR-05, BR-07)", () => {
  test("[FR-06] a deposit that is not fully paid fails the check", async () => {
    const { result } = await plan({ clients: { deposit: async (requestNo) => ({ requestNo, balancePhp: 320 }) } });
    assert.equal(result.checks.budget.status, "failed");
    assert.equal(result.checks.budget.reasons[0], "The deposit is not fully paid: 320 pesos are still due.");
  });
  test("[FR-06] a deposit with a balance of 0 does not fail the check", async () => {
    const { result } = await plan();
    assert.equal(result.checks.budget.status, "passed");
  });
  test("[FR-06] a request without a deposit record is not paid", async () => {
    const { result } = await plan({ clients: { deposit: async () => null } });
    assert.equal(result.checks.budget.status, "failed");
    assert.match(result.checks.budget.reasons[0], /No deposit has been recorded/);
  });
  test("[FR-07] 500 USD at the rate 63.46 is 31,730 pesos", async () => {
    const { result } = await plan({ request: { budget: { amount: 500, currency: "USD" } } });
    assert.equal(result.checks.budget.amountPhp, 31730);
    assert.match(result.checks.budget.reasons[0], /31,730 pesos \(500 USD at 63.46\)/);
  });
  test("[FR-07] a budget in pesos stays the same", async () => {
    const { result } = await plan({ request: { budget: { amount: 15000, currency: "PHP" } } });
    assert.equal(result.checks.budget.amountPhp, 15000);
  });
  test("when the rate service is down the budget check is unknown", async () => {
    const { result } = await plan({ request: { budget: { amount: 500, currency: "USD" } }, external: { down: ["convert"] } });
    assert.equal(result.checks.budget.status, "unknown");
    assert.equal(result.decision, "needs-review");
  });
});

describe("G3 decision (BR-08) and T06, T07, T08", () => {
  test("[FR-08] all four checks passed: approved", async () => {
    const { result } = await plan();
    assert.equal(result.decision, "approved");
    assert.deepEqual(result.reasons, ["All four checks passed."]);
  });
  test("[FR-08] one failed check and three passed checks: returned", async () => {
    const { result } = await plan({ clients: { availability: async () => ({ available: false, capacityOk: true, penaltyPhp: 0 }) } });
    assert.deepEqual(Object.values(result.checks).map((c) => c.status), ["passed", "failed", "passed", "passed"]);
    assert.equal(result.decision, "returned");
  });
  test("[FR-09] an approved request gets the status Approved in Student Affairs", async () => {
    const { result, clients } = await plan();
    assert.deepEqual(clients.statusCalls, [{ requestNo: "EVT-0001", status: "Approved" }]);
    assert.equal(result.status, "Approved");
  });
  test("[FR-10] a returned request gets the status Returned, with the reason of every failed check", async () => {
    const { result, clients } = await plan({
      request: { date: "2027-12-25", venue: "Room 101" },
      clients: { availability: async () => ({ available: true, capacityOk: true, penaltyPhp: 50 }) },
    });
    assert.deepEqual(clients.statusCalls, [{ requestNo: "EVT-0001", status: "Returned" }]);
    assert.equal(result.reasons.length, 2);
    assert.match(result.reasons.join(" "), /Christmas Day.*unpaid penalty/);
  });
  test("[FR-11] the decision is published on the queue with the reasons and the e-mail address", async () => {
    const queue = createQueue({ sleep: async () => {} });
    const got = [];
    queue.subscribe("request.decided", (payload) => void got.push(payload));
    await plan({ request: { date: "2027-12-25" }, queue });
    await queue.drain();
    assert.equal(got.length, 1);
    assert.equal(got[0].decision, "returned");
    assert.equal(got[0].contactEmail, "csoc@campus.example");
    assert.match(got[0].reasons[0], /Christmas Day/);
  });
  test("planEvent publishes and returns without waiting for the delivery", async () => {
    const queue = createQueue({ sleep: async () => {} });
    let delivered = 0;
    queue.subscribe("request.decided", () => void delivered++);
    await plan({ queue });
    assert.equal(delivered, 0);
  });
  test("decide: the rules of BR-08 and FR-12 as a table", () => {
    const s = (...statuses) => Object.fromEntries(statuses.map((status, i) => [`c${i}`, { status }]));
    assert.equal(decide(s("passed", "passed")), "approved");
    assert.equal(decide(s("passed", "failed")), "returned");
    assert.equal(decide(s("passed", "unknown")), "needs-review");
    assert.equal(decide(s("unknown", "failed")), "returned");
  });
  test("collectReasons: failed reasons first, then the unknown ones", () => {
    const checks = { a: { status: "unknown", reasons: ["u"] }, b: { status: "failed", reasons: ["f1", "f2"] }, c: { status: "passed", reasons: ["p"] } };
    assert.deepEqual(collectReasons(checks), ["f1", "f2", "u"]);
  });
});

describe("outside services that do not answer", () => {
  test("[FR-12] the holiday service is down and the other checks passed: needs-review", async () => {
    const { result, clients } = await plan({ external: { down: ["holiday"] } });
    assert.equal(result.decision, "needs-review");
    assert.match(result.reasons[0], /holiday service did not answer/);
    assert.deepEqual(clients.statusCalls, []);
    assert.equal(result.status, "Pending");
  });
  test("[FR-12] the weather service is down and the venue check failed: returned", async () => {
    const { result } = await plan({
      request: { outdoor: true, date: "2027-02-25" },
      clients: { availability: async () => ({ available: false, capacityOk: true, penaltyPhp: 0 }) },
      external: { down: ["forecast"] },
    });
    assert.equal(result.decision, "returned");
    assert.equal(result.checks.weather.status, "unknown");
    assert.equal(result.reasons.length, 2);
  });
  test("[NFR-02] each outside service down in turn: the planner still answers needs-review", async () => {
    const outdoor = { outdoor: true, date: "2027-02-25", budget: { amount: 500, currency: "USD" } };
    for (const name of ["holiday", "forecast", "convert"]) {
      const { result } = await plan({ request: outdoor, external: { down: [name] } });
      assert.equal(result.decision, "needs-review", name);
    }
  });
  test("[NFR-02] an outside service that throws instead of answering is also caught", async () => {
    const boom = async () => {
      throw new Error("socket hang up");
    };
    const external = { ...createFakeExternal({ today: TODAY }), holiday: boom };
    const result = await planEvent("EVT-0001", { clients: createFakeClients(), external, queue: createQueue(), today: TODAY });
    assert.equal(result.decision, "needs-review");
    assert.equal(result.checks.holiday.detail, "socket hang up");
  });
  test("an internal service that does not answer (Finance) gives needs-review too", async () => {
    const { result } = await plan({
      clients: {
        deposit: async () => {
          throw new ClientError("finance", "UNREACHABLE", "finance did not answer");
        },
      },
    });
    assert.equal(result.checks.budget.status, "unknown");
    assert.equal(result.decision, "needs-review");
  });
});

describe("the process around the checks", () => {
  test("an unknown request number throws a ClientError and nothing is published", async () => {
    const queue = createQueue();
    const clients = createFakeClients({
      getRequest: async () => {
        throw new ClientError("student-affairs", "NOT_FOUND", "student-affairs answered 404", { status: 404 });
      },
    });
    await assert.rejects(planEvent("EVT-9999", { clients, external: createFakeExternal(), queue, today: TODAY }), { status: 404 });
    assert.equal(queue.stats().delivered + queue.stats().dead, 0);
  });
  test("when Student Affairs cannot set the status, nothing is published", async () => {
    const queue = createQueue();
    const clients = createFakeClients({
      setStatus: async () => {
        throw new ClientError("student-affairs", "UNREACHABLE", "down");
      },
    });
    let published = 0;
    queue.publish = () => void published++;
    await assert.rejects(planEvent("EVT-0001", { clients, external: createFakeExternal(), queue, today: TODAY }));
    assert.equal(published, 0);
  });
  test("the four checks run at the same time", async () => {
    const tracker = createInFlight();
    const ext = createFakeExternal({ today: TODAY });
    const base = createFakeClients({ request: { outdoor: true, date: "2027-02-25" } });
    const external = { holiday: tracker.wrap(ext.holiday), forecast: tracker.wrap(ext.forecast), convert: tracker.wrap(ext.convert) };
    const clients = { ...base, availability: tracker.wrap(base.availability), deposit: tracker.wrap(base.deposit) };
    await planEvent("EVT-0001", { clients, external, queue: createQueue(), today: TODAY });
    assert.ok(tracker.max >= 4, `only ${tracker.max} calls ran at once`);
  });
  test("[NFR-01] planning with fast fakes finishes within 3000 ms", async () => {
    const t0 = performance.now();
    await plan({ request: { outdoor: true, date: "2027-02-25" } });
    assert.ok(performance.now() - t0 < 3000);
  });
  test("[NFR-01] with parallel checks, the time is the slowest call, not the sum of all", async () => {
    const delayMs = { holiday: 60, forecast: 100, convert: 120 };
    const t0 = performance.now();
    await plan({ request: { outdoor: true, date: "2027-02-25" }, external: { delayMs } });
    const took = performance.now() - t0;
    assert.ok(took < 280, `took ${Math.round(took)} ms, the sum of the delays is 280 ms`);
  });
  test("[NFR-05] every reason is a full sentence without codes", async () => {
    const cases = [{ date: "2027-12-25" }, { outdoor: true, date: "2027-12-25" }, { venue: "Moon" }];
    for (const request of cases) {
      const { result } = await plan({ request, clients: request.venue ? { availability: async () => null } : {} });
      for (const reason of result.reasons) {
        assert.match(reason, /^[A-Z].*\.$/, reason);
        assert.doesNotMatch(reason, /\b(BR|FR|NFR|T)-?\d+\b|undefined|null|NaN/, reason);
      }
    }
  });
});
