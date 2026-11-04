import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DRAFT, collect } from "../review/trace-facts.js";

describe("the AI review of the recommendation draft", () => {
  const f = collect();
  test("finding 1: the draft recommends hub-and-spoke, which ranks second with 94 points against 99", () => {
    assert.equal(DRAFT.recommends, "hub-and-spoke");
    assert.deepEqual([f.recommendedRank, f.recommendedTotal, f.bestId, f.bestTotal], [2, 94, "gateway-plus-queue", 99]);
  });
  test("finding 2: the draft cites NFR-09, but the list ends at NFR-08", () => {
    assert.deepEqual([f.unknownNfrs, f.nfrCount], [["NFR-09"], 8]);
  });
  test("finding 3: the draft's trace leaves out FR-04 and FR-10, both Must", () => {
    assert.deepEqual([f.missingFrs, f.missingMust], [["FR-04", "FR-10"], ["FR-04", "FR-10"]]);
  });
  test("claim 4 is false: the queue does not change performance (4 and 4), it lifts availability (5 against 3)", () => {
    assert.deepEqual([f.perfWithQueue, f.perfGatewayOnly, f.availWithQueue, f.availGatewayOnly], [4, 4, 5, 3]);
  });
  test("claim 5 is false: 4 of 8 NFRs are verified by a test, the others by measurement, review or inspection", () => {
    assert.deepEqual(f.byVerification, { test: 4, measurement: 2, review: 1, inspection: 1 });
  });
  test("claim 6 is true: the trace has no problems for 9 tasks and decisions, 12 FR and 8 NFR", () => {
    assert.deepEqual([f.traceProblems, f.taskCount], [0, 9]);
  });
});
