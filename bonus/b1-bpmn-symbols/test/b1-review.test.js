import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { collect } from "../review/symbols-facts.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("the AI review of BPMN symbols", () => {
  const f = collect();
  test("finding 1: every thick circle is an end event", () => assert.ok(f.thickAreEnds));
  test("finding 2: every double circle is an intermediate event", () => assert.ok(f.doubleAreIntermediate));
  test("finding 3: the broken order has a dead end, a gateway with no split and a task in no lane", () => {
    assert.ok(f.deadEnd && f.noSplit && f.noLane);
  });
  test("claim 4 is false: the exclusive gateway is drawn with an X", () => assert.equal(f.exclusiveMarker, "X"));
  test("claim 5 is true: a parallel gateway starts all its paths", () => assert.deepEqual([f.parallelRanAll, f.joinRanOnce], [true, true]));
  test("claim 6 is false: a message flow goes between pools", () => assert.equal(f.messageFlowScope, "between pools"));
  test("the review script prints 3 findings and 3 claims", () => {
    const out = execFileSync("node", ["review/symbols-review.js"], { cwd: root, encoding: "utf8" });
    assert.equal((out.match(/^FINDING/gm) ?? []).length, 3);
    assert.equal((out.match(/^CLAIM/gm) ?? []).length, 3);
    assert.equal((out.match(/\bconfirmed\b/g) ?? []).length, 3);
    assert.deepEqual(out.match(/\b(TRUE|FALSE)\b/g), ["FALSE", "TRUE", "FALSE"]);
  });
});
