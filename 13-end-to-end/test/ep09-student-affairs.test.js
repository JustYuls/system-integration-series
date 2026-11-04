import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { send, start } from "../src/serve.js";
import { createStudentAffairsApp } from "../src/services/student-affairs.js";

const complete = { title: "Quiz Night", organization: "Math Club", date: "2027-05-20", venue: "Lab A", attendees: 35, budget: { amount: 1200, currency: "PHP" }, contactEmail: "math@campus.example" };
const post = (body) => send(api.url, "/requests", { method: "POST", body });
const patch = (no, body) => send(api.url, `/requests/${no}`, { method: "PATCH", body });
let api;

before(async () => {
  api = await start(createStudentAffairsApp());
});
after(() => api.close());

describe("GET: reading requests", () => {
  test("the collection lists the seven seed requests", async () => {
    const res = await send(api.url, "/requests");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 7);
    assert.ok(res.headers.get("content-type").startsWith("application/json"));
  });

  test("?status= filters the collection", async () => {
    const res = await send(api.url, "/requests?status=On%20hold");
    assert.deepEqual(res.body.map((r) => r.requestNo), ["EVT-0005"]);
  });

  test("an unknown status is a 400, not an empty list", async () => {
    const res = await send(api.url, "/requests?status=Maybe");
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_STATUS");
  });

  test("one request is found by its number, with money as amount and currency", async () => {
    const res = await send(api.url, "/requests/EVT-0004");
    assert.equal(res.status, 200);
    assert.equal(res.body.title, "Job Fair");
    assert.deepEqual(res.body.budget, { amount: 500, currency: "USD" });
  });

  test("an unknown request is a 404 with the error format", async () => {
    const res = await send(api.url, "/requests/EVT-9999");
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: { code: "NOT_FOUND", message: "No request EVT-9999" } });
  });
});

describe("POST: creating a request", () => {
  test("[FR-01] a complete request is accepted with 201 and a Location", async () => {
    const res = await post(complete);
    assert.equal(res.status, 201);
    assert.equal(res.body.requestNo, "EVT-0009");
    assert.equal(res.headers.get("location"), "/requests/EVT-0009");
  });

  test("[FR-01] the new request starts as Pending and can be read at its Location", async () => {
    const created = await post(complete);
    assert.equal(created.body.status, "Pending");
    const again = await send(api.url, created.headers.get("location"));
    assert.deepEqual(again.body, created.body);
  });

  test("[FR-01] a request without a venue is refused and the venue is listed as missing", async () => {
    const { venue, ...withoutVenue } = complete;
    const count = (await send(api.url, "/requests")).body.length;
    const res = await post(withoutVenue);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_FAILED");
    assert.deepEqual(res.body.error.missing, ["venue"]);
    assert.equal((await send(api.url, "/requests")).body.length, count);
  });

  test("[FR-01] an empty body lists every required field as missing", async () => {
    const res = await post({});
    assert.deepEqual(res.body.error.missing, ["title", "organization", "date", "venue", "attendees", "budget", "contactEmail"]);
  });

  test("[FR-01] a request with no body at all is also a 400", async () => {
    const res = await send(api.url, "/requests", { method: "POST" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.missing.length, 7);
  });

  test("invalid values are listed as invalid, not as missing", async () => {
    const res = await post({ ...complete, date: "03/04/2027", attendees: "many", contactEmail: "nobody", outdoor: "yes" });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.missing, []);
    assert.deepEqual(res.body.error.invalid, ["date", "attendees", "contactEmail", "outdoor"]);
  });

  test("a date that does not exist is invalid", async () => {
    const res = await post({ ...complete, date: "2027-02-30" });
    assert.deepEqual(res.body.error.invalid, ["date"]);
  });

  test("a budget needs an amount and a three-letter currency", async () => {
    const res = await post({ ...complete, budget: { amount: 100 } });
    assert.deepEqual(res.body.error.invalid, ["budget"]);
  });

  test("fields that are not part of the contract are not stored", async () => {
    const res = await post({ ...complete, status: "Approved", admin: true });
    assert.equal(res.body.status, "Pending");
    assert.equal(res.body.admin, undefined);
  });

  test("a body that is not JSON is a 400 BAD_JSON, in the error format", async () => {
    const res = await send(api.url, "/requests", { method: "POST", body: "{ title: " });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "BAD_JSON");
  });
});

describe("PATCH and DELETE: changing and withdrawing", () => {
  test("[FR-09] PATCH changes the status and returns the request", async () => {
    const res = await patch("EVT-0001", { status: "Approved" });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Approved");
    assert.equal((await send(api.url, "/requests/EVT-0001")).body.status, "Approved");
  });

  test("[FR-10] a request can be returned to the organizer", async () => {
    const res = await patch("EVT-0002", { status: "Returned" });
    assert.equal(res.body.status, "Returned");
  });

  test("PATCH changes only what was sent: the title is untouched", async () => {
    const res = await patch("EVT-0003", { status: "On hold" });
    assert.equal(res.body.title, "Coding Contest");
  });

  test("PATCH with a status that does not exist is a 400", async () => {
    const res = await patch("EVT-0003", { status: "Done" });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.invalid, ["status"]);
  });

  test("PATCH without a status says that status is missing", async () => {
    const res = await patch("EVT-0003", {});
    assert.deepEqual(res.body.error.missing, ["status"]);
  });

  test("PATCH cannot change other fields", async () => {
    const res = await patch("EVT-0003", { status: "Approved", attendees: 999 });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "UNKNOWN_FIELDS");
    assert.equal((await send(api.url, "/requests/EVT-0003")).body.attendees, 40);
  });

  test("PATCH on an unknown request is a 404", async () => {
    assert.equal((await patch("EVT-9999", { status: "Approved" })).status, 404);
  });

  test("DELETE withdraws a Pending request: 204 and no body, then 404", async () => {
    const created = await post(complete);
    const res = await send(api.url, created.headers.get("location"), { method: "DELETE" });
    assert.equal(res.status, 204);
    assert.equal(res.body, null);
    assert.equal((await send(api.url, created.headers.get("location"))).status, 404);
  });

  test("DELETE of a request that is not Pending is a 409", async () => {
    const res = await send(api.url, "/requests/EVT-0005", { method: "DELETE" });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "NOT_PENDING");
  });
});

describe("each app has its own data", () => {
  test("a request created in one app does not appear in another", async () => {
    const one = await start(createStudentAffairsApp());
    const two = await start(createStudentAffairsApp());
    try {
      await send(one.url, "/requests", { method: "POST", body: complete });
      assert.equal((await send(one.url, "/requests")).body.length, 8);
      assert.equal((await send(two.url, "/requests")).body.length, 7);
    } finally {
      await one.close();
      await two.close();
    }
  });
});
