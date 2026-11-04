import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { collect } from "../review/rest-facts.js";

describe("the AI review of the Express route", async () => {
  const f = await collect();

  test("finding 1: the draft answers 200 to a create, the real service 201 with a Location", () => {
    assert.equal(f.draftCreateStatus, 200);
    assert.equal(f.draftLocation, null);
    assert.equal(f.realCreateStatus, 201);
    assert.match(f.realLocation, /^\/requests\/EVT-\d{4}$/);
  });

  test("finding 2: the draft stores an empty body, the real service lists the missing fields", () => {
    assert.equal(f.draftEmptyStored, true);
    assert.equal(f.realEmptyStatus, 400);
    assert.equal(f.realMissing.length, 7);
  });

  test("finding 3: a GET to the draft approves the request, the real service has no such route", () => {
    assert.equal(f.draftStatusAfterGet, "Approved");
    assert.equal(f.realGetApproveStatus, 404);
    assert.equal(f.realStatusAfterGet, "Pending");
  });

  test("claim 4 is false: the 500 of the draft carries the stack", () => {
    assert.equal(f.draftBrokenStatus, 500);
    assert.equal(f.draftLeaksStack, true);
  });

  test("claim 5 is false: DELETE changes the data", () => {
    assert.deepEqual([f.deleteBefore, f.deleteStatus, f.deleteAfter], [200, 204, 404]);
  });

  test("claim 6 is true: POST twice creates two requests", () => {
    assert.deepEqual(f.postedTwice, [201, 201]);
    assert.equal(f.twoNumbers, true);
  });
});
