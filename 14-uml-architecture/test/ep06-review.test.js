import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { collect } from "../review/strategy-facts.js";

describe("the AI review of the integration recommendation", () => {
  const f = collect();
  test("finding 1: the gateway with a queue ranks first, 5 points ahead of the gateway alone", () => {
    assert.deepEqual([f.winner, f.winnerTotal, f.margin, f.runnerUp], ["gateway-plus-queue", 99, 5, "hub-and-spoke"]);
  });
  test("finding 2: 6 systems need 15 point-to-point links against 6 for a hub", () => {
    assert.deepEqual([f.systems, f.linksP2P, f.linksHub, f.p2pMaintainability], [6, 15, 6, 1]);
  });
  test("finding 3: doubling any one weight never changes the winner; cost comes closest", () => {
    assert.deepEqual([f.changes, f.sensitivityCount, f.closest, f.closestMargin], [0, 9, "cost", 2]);
  });
  test("claim 4 is false: the ESB ranks fourth, and it is the most expensive to build", () => {
    assert.deepEqual([f.esbRank, f.esbTotal, f.esbCost], [4, 77, 1]);
  });
  test("claim 5 is false: dd/mm/yyyy is not ISO 8601, and year-month-day is", () => {
    assert.deepEqual([f.ddmmyyyy, f.iso], [false, true]);
  });
  test("claim 6 is true: the API file covers all 10 Must requirements with no problems", () => {
    assert.deepEqual([f.openApiProblems, f.mustCount, f.mustCovered], [0, 10, 10]);
  });
});
