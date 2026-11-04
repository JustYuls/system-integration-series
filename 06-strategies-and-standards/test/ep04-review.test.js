import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { collect } from "../review/fr-facts.js";

describe("the AI review of the requirement list", () => {
  const f = collect();
  test("the real list has no quality problems", () => assert.equal(f.realProblems, 0));
  test("finding 1: the vague words fast and easy are found", () => {
    assert.ok(f.vague);
    assert.match(f.vagueWords, /fast, easy/);
  });
  test("finding 2: the compound statement is found", () => assert.ok(f.compound));
  test("finding 3: the missing acceptance criteria are found", () => assert.ok(f.noAcceptance));
  test("the draft also has an orphan task that the AI did not mention", () => assert.ok(f.orphanTask));
  test("claim 4 is false: the draft leaves T07 and T08 without a requirement", () => assert.deepEqual(f.draftUncovered, ["T07", "T08"]));
  test("claim 5 is false: two of eight tasks have more than one requirement", () => assert.deepEqual([f.tasksWithManyRequirements, f.taskCount], [2, 8]));
  test("claim 6 is true: all eight business rules are used", () => assert.deepEqual([f.rulesUncovered.length, f.ruleCount], [0, 8]));
});
