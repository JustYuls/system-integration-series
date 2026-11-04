import test from "node:test";
import assert from "node:assert/strict";
import { withApp, goodRequest } from "./helpers.js";

test("POST /api/requests creates a request: 201 and the created request", () =>
  withApp({}, async (call) => {
    const r = await call("POST", "/api/requests", goodRequest);
    assert.equal(r.status, 201);
    assert.equal(r.data.requestNo, "EVT-0001");
    assert.equal(r.data.status, "Pending");
    assert.equal(r.data.title, "Orientation Day");
  }));

test("the 201 response has a Location header", () =>
  withApp({}, async (call) => {
    const r = await call("POST", "/api/requests", goodRequest);
    assert.equal(r.headers.get("location"), "/api/requests/EVT-0001");
  }));

test("the Location header leads to the created request", () =>
  withApp({}, async (call) => {
    const created = await call("POST", "/api/requests", goodRequest);
    const r = await call("GET", created.headers.get("location"));
    assert.equal(r.status, 200);
    assert.equal(r.data.title, "Orientation Day");
  }));

test("request numbers count up", () =>
  withApp({}, async (call) => {
    await call("POST", "/api/requests", goodRequest);
    const second = await call("POST", "/api/requests", { ...goodRequest, title: "Job Fair" });
    assert.equal(second.data.requestNo, "EVT-0002");
    assert.equal((await call("GET", "/api/requests")).data.length, 2);
  }));

test("requests are kept in memory per app", async () => {
  await withApp({}, (call) => call("POST", "/api/requests", goodRequest));
  await withApp({}, async (call) => assert.equal((await call("GET", "/api/requests")).data.length, 0));
});

test("an empty title gives 400 and lists the problem", () =>
  withApp({}, async (call) => {
    const r = await call("POST", "/api/requests", { ...goodRequest, title: "  " });
    assert.equal(r.status, 400);
    assert.equal(r.data.error.code, "VALIDATION");
    assert.deepEqual(r.data.error.problems, ["title is required"]);
  }));

test("a bad request lists every problem at once", () =>
  withApp({}, async (call) => {
    const r = await call("POST", "/api/requests", { title: "", date: "2027-02-30", venue: "lab-a", attendees: 90 });
    assert.equal(r.status, 400);
    assert.equal(r.data.error.problems.length, 3);
  }));

test("an unknown venue gives 400", () =>
  withApp({}, async (call) => {
    const r = await call("POST", "/api/requests", { ...goodRequest, venue: "pool" });
    assert.equal(r.status, 400);
    assert.match(r.data.error.problems[0], /venue must be one of/);
  }));

test("more attendees than the capacity gives 400", () =>
  withApp({}, async (call) => {
    const r = await call("POST", "/api/requests", { ...goodRequest, venue: "lab-a", attendees: 90 });
    assert.equal(r.status, 400);
    assert.match(r.data.error.problems[0], /capacity of Lab A \(40\)/);
  }));

test("a bad request is not stored", () =>
  withApp({}, async (call) => {
    await call("POST", "/api/requests", { ...goodRequest, attendees: 0 });
    assert.equal((await call("GET", "/api/requests")).data.length, 0);
  }));

test("an empty body gives 400, not a crash", () =>
  withApp({}, async (call) => {
    const r = await call("POST", "/api/requests");
    assert.equal(r.status, 400);
    assert.equal(r.data.error.problems.length, 4);
  }));

test("a body that is not JSON gives 400 with BAD_JSON (error handler)", () =>
  withApp({}, async (call) => {
    const r = await call("POST", "/api/requests", undefined, "{ not json");
    assert.equal(r.status, 400);
    assert.equal(r.data.error.code, "BAD_JSON");
  }));

test("GET /api/requests/:requestNo returns 404 for an unknown number", () =>
  withApp({}, async (call) => {
    const r = await call("GET", "/api/requests/EVT-9999");
    assert.equal(r.status, 404);
    assert.equal(r.data.error.code, "NOT_FOUND");
  }));

test("GET does not change data", () =>
  withApp({}, async (call) => {
    await call("GET", "/api/venues");
    await call("GET", "/api/venues/gym");
    assert.equal((await call("GET", "/api/requests")).data.length, 0);
  }));
