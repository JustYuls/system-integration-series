// The real Express services behind the real gateway.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createGateway } from "../src/gateway/gateway.js";
import { send, start } from "../src/serve.js";
import { createFacilitiesApp } from "../src/services/facilities.js";
import { createFinanceApp } from "../src/services/finance.js";
import { createStudentAffairsApp } from "../src/services/student-affairs.js";

async function setup() {
  const sa = await start(createStudentAffairsApp(undefined, { log: () => {} }));
  const fin = await start(createFinanceApp());
  const fac = await start(createFacilitiesApp());
  const gateway = await start(createGateway({ services: { studentAffairs: sa.url, finance: fin.url, facilities: fac.url } }));
  return { sa, gateway, close: async () => { for (const s of [gateway, sa, fin, fac]) await s.close(); } };
}

const complete = { title: "Quiz Night", organization: "Math Club", date: "2027-05-20", venue: "Lab A", attendees: 35, budget: { amount: 1200, currency: "PHP" }, contactEmail: "math@campus.test" };

describe("the gateway in front of the real services", () => {
  test("[FR-01] a complete request created through the gateway gets a request number and a Location", async () => {
    const t = await setup();
    const res = await send(t.gateway.url, "/api/student-affairs/requests", { method: "POST", body: complete });
    await t.close();
    assert.equal(res.status, 201);
    assert.match(res.body.requestNo, /^EVT-\d{4}$/);
    assert.equal(res.headers.get("location"), `/requests/${res.body.requestNo}`);
    assert.equal(res.body.status, "Pending");
  });

  test("[FR-01] a request without a venue is refused by the service, and the gateway passes the list of missing fields", async () => {
    const t = await setup();
    const { venue, ...withoutVenue } = complete;
    const res = await send(t.gateway.url, "/api/student-affairs/requests", { method: "POST", body: withoutVenue });
    const all = await send(t.gateway.url, "/api/student-affairs/requests");
    await t.close();
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.missing, ["venue"]);
    assert.equal(all.body.length, 7, "no request was created");
  });

  test("the gateway does not validate: the 400 comes from the service, a direct call says the same", async () => {
    const t = await setup();
    const through = await send(t.gateway.url, "/api/student-affairs/requests", { method: "POST", body: {} });
    const direct = await send(t.sa.url, "/requests", { method: "POST", body: {} });
    await t.close();
    assert.equal(through.status, 400);
    assert.deepEqual(through.body, direct.body);
  });

  test("a request that was created through the gateway can be read through the gateway", async () => {
    const t = await setup();
    const created = await send(t.gateway.url, "/api/student-affairs/requests", { method: "POST", body: complete });
    const read = await send(t.gateway.url, `/api/student-affairs/requests/${created.body.requestNo}`);
    await t.close();
    assert.equal(read.status, 200);
    assert.equal(read.body.title, "Quiz Night");
  });

  test("a query string reaches the service: requests filtered by status", async () => {
    const t = await setup();
    const res = await send(t.gateway.url, "/api/student-affairs/requests?status=On%20hold");
    await t.close();
    assert.deepEqual(res.body.map((r) => r.requestNo), ["EVT-0005"]);
  });

  test("an invalid bad JSON body is answered by the service with 400 BAD_JSON", async () => {
    const t = await setup();
    const res = await send(t.gateway.url, "/api/student-affairs/requests", { method: "POST", body: "{ nope" });
    await t.close();
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "BAD_JSON");
  });

  test("PATCH works through the gateway", async () => {
    const t = await setup();
    const res = await send(t.gateway.url, "/api/student-affairs/requests/EVT-0001", { method: "PATCH", body: { status: "Approved" } });
    await t.close();
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Approved");
  });

  test("DELETE and its 204 work through the gateway", async () => {
    const t = await setup();
    const created = await send(t.gateway.url, "/api/student-affairs/requests", { method: "POST", body: complete });
    const del = await send(t.gateway.url, `/api/student-affairs/requests/${created.body.requestNo}`, { method: "DELETE" });
    const again = await send(t.gateway.url, `/api/student-affairs/requests/${created.body.requestNo}`);
    await t.close();
    assert.deepEqual([del.status, again.status], [204, 404]);
  });

  test("Finance through the gateway: a deposit, and a 404 for a missing one", async () => {
    const t = await setup();
    const ok = await send(t.gateway.url, "/api/finance/deposits/EVT-0004");
    const missing = await send(t.gateway.url, "/api/finance/deposits/EVT-0005");
    await t.close();
    assert.equal(ok.body.balancePhp, 320);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, "NOT_FOUND");
  });

  test("Facilities through the gateway: the availability question", async () => {
    const t = await setup();
    const res = await send(t.gateway.url, "/api/facilities/venues/room-101/availability?date=2027-11-22&attendees=80");
    await t.close();
    assert.equal(res.status, 200);
    assert.equal(res.body.capacityOk, false);
  });

  test("the business rule of a double booking stays in the Facilities service: 409 through the gateway", async () => {
    const t = await setup();
    const slot = { requestNo: "EVT-0001", venueId: "gym", date: "2031-01-01", hours: 2 };
    const first = await send(t.gateway.url, "/api/facilities/reservations", { method: "POST", body: slot });
    const second = await send(t.gateway.url, "/api/facilities/reservations", { method: "POST", body: { ...slot, requestNo: "EVT-0002" } });
    await t.close();
    assert.deepEqual([first.status, second.status], [201, 409]);
  });

  test("every service still answers /health directly, with its own name", async () => {
    const t = await setup();
    const direct = await send(t.sa.url, "/health");
    await t.close();
    assert.deepEqual(direct.body, { status: "ok", service: "student-affairs" });
  });

  test("the gateway's /health with the three real services is ok", async () => {
    const t = await setup();
    const res = await send(t.gateway.url, "/health");
    await t.close();
    assert.equal(res.body.status, "ok");
  });
});
