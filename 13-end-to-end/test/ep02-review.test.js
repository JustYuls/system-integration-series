import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { collect } from "../review/bpmn-facts.js";

describe("the AI review of the BPMN draft", () => {
  const f = collect();
  test("the real process has no problems", () => assert.equal(f.realProblems, 0));
  test("finding 1: the weather check is a dead end in the draft", () => assert.ok(f.deadEnd));
  test("finding 2: the gateway with one exit is found", () => assert.ok(f.badGateway));
  test("finding 3: the task outside every lane is found", () => assert.ok(f.noLane));
  test("claim 4 is false: an exclusive gateway takes one path", () => assert.equal(f.exclusiveTookBoth, false));
  test("claim 5 is true: a parallel gateway starts every path", () => assert.equal(f.allChecksRan, true));
  test("claim 6 is false: the join waits for all four checks", () => assert.deepEqual([f.joinWaited, f.joinRanOnce], [true, true]));
});
