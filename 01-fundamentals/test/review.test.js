import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFacilities, readStudentAffairs } from "../src/adapters.js";
import { collect } from "../review/facts.js";
import { naiveJoinByTitle } from "../review/flawed.js";

describe("the AI review facts", () => {
  const f = collect();

  test("finding 1: joining on the title loses a request", () => {
    assert.deepEqual([f.requests, f.naiveRecords, f.integratedRecords], [6, 5, 6]);
  });
  test("finding 1: the merged record hides the penalty of the other event", () => {
    const merged = naiveJoinByTitle(readStudentAffairs(), readFacilities()).filter((r) => r.title === "General Assembly");
    assert.equal(merged.length, 1);
    assert.equal(f.penaltyOf0002, 50);
    assert.notEqual(f.mergedPenalty, 50);
  });
  test("finding 2: the date text has two meanings", () => assert.deepEqual(f.sameTextTwoDates, ["2027-03-04", "2027-04-03"]));
  test("finding 2: the wrong order breaks every date", () => assert.deepEqual([f.dmyErrors, f.dmyWrongDates, f.dmyOk], [4, 2, 0]));
  test("finding 3: normalizing ids makes the join work", () => assert.deepEqual([f.idsRawMatch, f.idsNormalizedMatch], [0, 5]));
  test("claim 4 is false: point-to-point is not linear", () => assert.equal(f.p2p6, 15));
  test("claim 5 is true: a hub needs n links", () => assert.equal(f.hub6, 6));
  test("claim 6 is false: an outage leaves nothing complete", () => assert.deepEqual([f.completeWhenFinanceUp, f.completeWhenFinanceDown], [5, 0]));
});
