import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { collect } from "../review/docs-facts.js";

describe("the AI review of the process documentation", () => {
  const f = collect();
  test("the real notes have no gaps", () => assert.equal(f.realGaps, 0));
  test("finding 1: the wrong actor is found", () => assert.ok(f.actorMismatch));
  test("finding 2: the missing exception is found", () => assert.ok(f.noExceptions));
  test("finding 3: the unused rule is found", () => assert.ok(f.unusedRule));
  test("claim 4 is false: four checks run in parallel", () => assert.equal(f.parallelChecks, 4));
  test("claim 5 is false: the rain rule is for outdoor events only", () => assert.ok(f.br02IsOutdoorOnly));
  test("claim 6 is false: three of four service tasks call an outside API", () => assert.deepEqual([f.servicesWithOutsideApi, f.serviceTasks], [3, 4]));
});
