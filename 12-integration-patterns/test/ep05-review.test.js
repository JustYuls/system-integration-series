import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { collect } from "../review/nfr-facts.js";

describe("the AI review of the non-functional requirements", () => {
  const f = collect();
  test("the real list has no problems", () => assert.equal(f.realProblems, 0));
  test("finding 1: three of the five items in the draft are vague", () => assert.deepEqual([f.vagueCount, f.draftCount], [3, 5]));
  test("finding 2: the draft misses reliability, interoperability, maintainability and capacity", () => {
    assert.deepEqual(f.draftMissing, ["reliability", "interoperability", "maintainability", "capacity"]);
  });
  test("finding 3: 500 ms cannot be met, because the outside call and our own work already need more", () => assert.ok(f.needMs > f.draft500));
  test("claim 4 is false: one after another the calls need more than 3000 ms", () => assert.equal(f.oneAfterAnother.ok, false));
  test("claim 5 is false: three tries of the slowest call need more than 3000 ms", () => assert.equal(f.threeTries.ok, false));
  test("claim 6 is true: the real list covers all eight categories", () => assert.deepEqual([f.realCovered, f.realMissing], [8, []]));
  test("the real plan, in parallel, does fit", () => assert.equal(f.parallel.ok, true));
});
