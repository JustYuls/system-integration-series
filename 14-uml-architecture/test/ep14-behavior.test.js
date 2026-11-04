// The arrows of the state diagram are real: they match what the services and planEvent do.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createQueue } from "../src/queue.js";
import { send, start } from "../src/serve.js";
import { createStudentAffairsApp } from "../src/services/student-affairs.js";
import { createFakeClients, createFakeExternal } from "../src/gateway/fakes.js";
import { planEvent } from "../src/gateway/plan.js";
import { TRANSITIONS } from "../src/diagrams.js";

const TODAY = "2027-02-20";
const newRequest = { title: "Quiz Night", organization: "Math Club", date: "2027-05-20", venue: "Lab A", attendees: 35, budget: { amount: 1200, currency: "PHP" }, outdoor: false, contactEmail: "math@campus.example" };

async function withService(run) {
  const app = await start(createStudentAffairsApp());
  try {
    return await run(app.url);
  } finally {
    await app.close();
  }
}

const has = (from, to) => TRANSITIONS.some((t) => t.from === from && t.to === to);

describe("[FR-01] the life of a request in the Student Affairs service", () => {
  test("[*] to Pending: a new request starts as Pending", async () => {
    await withService(async (url) => {
      const created = await send(url, "/requests", { method: "POST", body: newRequest });
      assert.equal(created.status, 201);
      assert.equal(created.body.status, "Pending");
    });
    assert.ok(has("[*]", "Pending"));
  });
  test("Pending to On hold and on to Approved: an officer can PATCH the status", async () => {
    await withService(async (url) => {
      const { body } = await send(url, "/requests", { method: "POST", body: newRequest });
      const path = `/requests/${body.requestNo}`;
      assert.equal((await send(url, path, { method: "PATCH", body: { status: "On hold" } })).body.status, "On hold");
      assert.equal((await send(url, path, { method: "PATCH", body: { status: "Approved" } })).body.status, "Approved");
    });
    for (const [from, to] of [["Pending", "On hold"], ["On hold", "Approved"], ["On hold", "Returned"]]) assert.ok(has(from, to), `${from} to ${to}`);
  });
  test("Pending to [*]: a Pending request can be withdrawn, an Approved one cannot", async () => {
    await withService(async (url) => {
      const { body } = await send(url, "/requests", { method: "POST", body: newRequest });
      await send(url, `/requests/${body.requestNo}`, { method: "PATCH", body: { status: "Approved" } });
      assert.equal((await send(url, `/requests/${body.requestNo}`, { method: "DELETE" })).status, 409);
      const second = await send(url, "/requests", { method: "POST", body: newRequest });
      assert.equal((await send(url, `/requests/${second.body.requestNo}`, { method: "DELETE" })).status, 204);
    });
    assert.ok(has("Pending", "[*]"));
    assert.equal(has("Approved", "Pending"), false);
  });
});

describe("planEvent moves the status like the diagram says", () => {
  async function plan({ request, external = {} } = {}) {
    const clients = createFakeClients({ request });
    const queue = createQueue({ sleep: async () => {} });
    const result = await planEvent("EVT-0001", { clients, external: createFakeExternal({ today: TODAY, ...external }), queue, today: TODAY });
    return { result, calls: clients.statusCalls.map((c) => c.status) };
  }
  test("[FR-12] all checks passed: Pending to Approved (T06)", async () => {
    const { result, calls } = await plan();
    assert.equal(result.status, "Approved");
    assert.deepEqual(calls, ["Approved"]);
    assert.ok(has("Pending", "Approved"));
  });
  test("[FR-12] a check failed: Pending to Returned (T08)", async () => {
    const { result, calls } = await plan({ request: { date: "2027-12-25" } });
    assert.equal(result.status, "Returned");
    assert.deepEqual(calls, ["Returned"]);
    assert.ok(has("Pending", "Returned"));
  });
  test("[NFR-02] needs-review leaves the status Pending: only an officer moves it on", async () => {
    const { result, calls } = await plan({ external: { down: ["holiday"] } });
    assert.equal(result.decision, "needs-review");
    assert.equal(result.status, "Pending");
    assert.deepEqual(calls, []);
  });
  test("every decision publishes request.decided once (T07), as the sequence diagram shows", async () => {
    const queue = createQueue({ sleep: async () => {} });
    const seen = [];
    queue.subscribe("request.decided", async (m) => void seen.push(m.decision));
    await planEvent("EVT-0001", { clients: createFakeClients(), external: createFakeExternal({ today: TODAY }), queue, today: TODAY });
    await queue.drain();
    assert.deepEqual(seen, ["approved"]);
  });
});
