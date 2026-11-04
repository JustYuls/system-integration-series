// The documents of the template, checked with the quality checkers of episodes 2 to 5.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { check } from "../src/bpmn.js";
import { gaps, loadModel, loadNotes } from "../src/document.js";
import { checkAll, checkRequirement, coverage, loadRequirements } from "../src/requirements.js";
import { checkAll as checkNfrs, loadNfr } from "../src/nfr.js";
import { RULES } from "../src/gateway/plan.js";

const model = loadModel();
const notes = loadNotes();

describe("the BPMN skeleton and its notes", () => {
  test("the skeleton process passes every BPMN check", () => assert.deepEqual(check(model), []));
  test("every task of the skeleton is documented", () => assert.deepEqual(gaps(model, notes), []));
  test("every row of the rules table in plan.js is a service task of the process", () => {
    for (const rule of RULES) assert.equal(model.nodes[rule.task]?.type, "serviceTask", `${rule.id} points to ${rule.task}`);
  });
});

describe("the example requirements", () => {
  test("[FR-01] [FR-02] the two functional examples meet the quality rules", () => {
    assert.deepEqual(checkAll(loadRequirements(), model, notes), []);
  });
  test("[NFR-01] [NFR-02] the two non-functional examples meet the quality rules", () => {
    assert.deepEqual(checkNfrs(loadNfr()), []);
  });
  test("the checker catches a vague requirement (so you see what it does when you write your own)", () => {
    const vague = { id: "FR-03", task: "T02", actor: "Planner System", priority: "Must", rules: ["BR-01"], statement: "The system shall check the date quickly.", acceptance: [] };
    const problems = checkRequirement(vague, model, notes);
    assert.ok(problems.some((p) => p.includes("vague words: quickly")));
    assert.ok(problems.includes("has no acceptance criteria"));
  });
  test("the coverage check lists the tasks that still need a requirement (your list of work)", () => {
    const open = coverage(model, loadRequirements()).uncovered;
    assert.ok(open.length > 0 && open.every((id) => model.nodes[id]));
  });
});
