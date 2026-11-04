import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, test } from "node:test";
import { ClientError, createClients, venueId } from "../src/gateway/clients.js";
import { newRequest, startServices } from "./ep13-fixtures.js";

let campus;
let clients;
before(async () => {
  campus = await startServices();
  clients = createClients(campus.services);
});
after(() => campus.close());

describe("the clients against the three real services", () => {
  test("venueId turns the name of a venue into its id", () => {
    assert.equal(venueId("Room 101"), "room-101");
    assert.equal(venueId(" Lab A "), "lab-a");
    assert.equal(venueId("Gym"), "gym");
  });
  test("getRequest reads a seed request", async () => {
    const request = await clients.getRequest("EVT-0001");
    assert.equal(request.title, "Orientation Day");
    assert.equal(request.venue, "Gym");
  });
  test("getRequest throws a ClientError with status 404 for an unknown request", async () => {
    await assert.rejects(clients.getRequest("EVT-9999"), (error) => error instanceof ClientError && error.status === 404 && error.code === "NOT_FOUND");
  });
  test("listRequests returns the seven seed requests", async () => {
    assert.equal((await clients.listRequests()).length, 7);
  });
  test("availability asks Facilities by venue id and returns its answer", async () => {
    const found = await clients.availability({ venue: "Room 101", date: "2027-11-22", attendees: 80 });
    assert.equal(found.venue, "Room 101");
    assert.equal(found.capacityOk, false);
    assert.equal(found.penaltyPhp, 50);
  });
  test("availability is null for a venue Facilities does not know", async () => {
    assert.equal(await clients.availability({ venue: "Moon", date: "2027-11-22", attendees: 5 }), null);
  });
  test("deposit returns the balance, and null when there is no record", async () => {
    assert.deepEqual(await clients.deposit("EVT-0004"), { requestNo: "EVT-0004", balancePhp: 320 });
    assert.equal(await clients.deposit("EVT-0005"), null);
  });
  test("createRequest returns the 201 answer, and passes a 400 with its problems through", async () => {
    const created = await clients.createRequest(newRequest());
    assert.equal(created.status, 201);
    assert.equal(created.body.status, "Pending");
    const bad = await clients.createRequest({ title: "Only a title" });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.error.missing.includes("venue"));
  });
  test("setStatus changes the status of a request", async () => {
    const changed = await clients.setStatus("EVT-0003", "Approved");
    assert.equal(changed.status, "Approved");
    assert.equal((await clients.getRequest("EVT-0003")).status, "Approved");
  });
  test("setStatus with a wrong status is an error of the service (400 is not expected)", async () => {
    await assert.rejects(clients.setStatus("EVT-0003", "Maybe"), (error) => error.code === "BAD_STATUS" && error.status === 502);
  });
});

describe("services that fail", () => {
  test("a service that is not running gives UNREACHABLE (502)", async () => {
    const lonely = createClients({ studentAffairs: "http://127.0.0.1:1" });
    await assert.rejects(lonely.getRequest("EVT-0001"), (error) => error.code === "UNREACHABLE" && error.status === 502 && error.service === "student-affairs");
  });
  test("a service that does not answer in time gives TIMEOUT (504)", async () => {
    const stuck = createServer(() => {}); // takes the request and never answers
    await new Promise((resolve) => stuck.listen(0, "127.0.0.1", resolve));
    const slow = createClients({ finance: `http://127.0.0.1:${stuck.address().port}` }, { timeoutMs: 80 });
    await assert.rejects(slow.deposit("EVT-0001"), (error) => error.code === "TIMEOUT" && error.status === 504);
    stuck.closeAllConnections();
    stuck.close();
  });
  test("a fake fetch can replace the network", async () => {
    const calls = [];
    const fetch = async (url, init) => (calls.push([init.method, url]), { ok: true, status: 200, json: async () => ({ requestNo: "EVT-0042" }) });
    const fake = createClients({ studentAffairs: "http://sa.test/" }, { fetch });
    assert.equal((await fake.getRequest("EVT-0042")).requestNo, "EVT-0042");
    assert.deepEqual(calls, [["GET", "http://sa.test/requests/EVT-0042"]]);
  });
});
