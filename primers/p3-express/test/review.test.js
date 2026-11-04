import test from "node:test";
import assert from "node:assert/strict";
import { collect } from "../review/express-facts.js";

const f = await collect();

test("finding 1: an unknown venue gives a 404 in the error shape", () => {
  assert.equal(f.missing.status, 404);
  assert.equal(f.missing.code, "NOT_FOUND");
});

test("finding 2: a good request gives 201 and a Location header", () => {
  assert.equal(f.created.status, 201);
  assert.equal(f.created.location, "/api/requests/EVT-0001");
});

test("finding 3: too many attendees gives a 400 with one problem", () => {
  assert.equal(f.tooMany.status, 400);
  assert.equal(f.tooMany.problems.length, 1);
});

test("claim 4 is TRUE: express.json() is what fills req.body", () => {
  assert.equal(f.jsonBodyWith, "object");
  assert.equal(f.jsonBodyWithout, "undefined");
});

test("claim 5 is FALSE: the order of middleware changes the answer", () => {
  assert.equal(f.routeFirstStatus, 200);
  assert.equal(f.catchAllFirstStatus, 404);
});

test("claim 6 is FALSE: innerHTML with user text builds a real tag, escaping does not", () => {
  assert.equal(f.unsafeHasRealTag, true);
  assert.equal(f.safeHasRealTag, false);
});

test("a GET does not change data", () => {
  assert.equal(f.getChangedData, false);
});
