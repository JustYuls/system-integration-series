import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadModel, loadNotes } from "../src/document.js";
import { checkAll, checkRequirement, coverage, loadRequirements, renderRequirements, uncoveredRules, vagueWordsIn } from "../src/requirements.js";

const model = loadModel();
const notes = loadNotes();
const reqs = loadRequirements();
const FR01 = reqs[0];
// A copy of FR-01 with one change, and the problems found in it.
const problems = (change) => checkRequirement({ ...structuredClone(FR01), ...change }, model, notes);

describe("the list of functional requirements", () => {
  test("there are twelve requirements, FR-01 to FR-12 in order", () => {
    assert.deepEqual(reqs.map((r) => r.id), Array.from({ length: 12 }, (_, i) => `FR-${String(i + 1).padStart(2, "0")}`));
  });
  test("the whole list meets the quality rules", () => assert.deepEqual(checkAll(reqs, model, notes), []));
  test("the list covers every task of the process", () => {
    const c = coverage(model, reqs);
    assert.deepEqual(c.uncovered, []);
    assert.equal(Object.keys(c.byTask).length, 8);
  });
  test("every business rule is used by a requirement", () => assert.deepEqual(uncoveredRules(notes, reqs), []));
  test("the decision gateway G3 has two requirements", () => {
    assert.deepEqual(reqs.filter((r) => r.task === "G3").map((r) => r.id), ["FR-08", "FR-12"]);
  });
  test("the priorities are Must and Should, and most are Must", () => {
    const count = (p) => reqs.filter((r) => r.priority === p).length;
    assert.deepEqual([count("Must"), count("Should")], [10, 2]);
  });
});

// One tagged test per requirement: episode 15 follows these tags from the requirement to the proof.
describe("each requirement is testable", () => {
  for (const r of reqs) {
    test(`[${r.id}] meets the quality rules and has at least two acceptance criteria`, () => {
      assert.deepEqual(checkRequirement(r, model, notes), []);
      assert.ok(r.acceptance.length >= 2);
    });
  }
});

describe("the quality rules", () => {
  test("a statement must start with The system shall", () => {
    assert.ok(problems({ statement: "The planner should check the date." }).some((p) => p.includes("does not start")));
  });
  test("two shall in one statement is a compound requirement", () => {
    assert.ok(problems({ statement: "The system shall check the date and the system shall check the venue." }).some((p) => p.includes('2 "shall"')));
  });
  test("vague words are found", () => {
    assert.deepEqual(vagueWordsIn("The system shall be fast and easy to use, etc."), ["fast", "easy", "etc."]);
    assert.deepEqual(vagueWordsIn("The system shall check the fastest road"), []);
  });
  test("and/or is rejected", () => assert.ok(problems({ statement: "The system shall send a notice and/or a message." }).some((p) => p.includes("and/or"))));
  test("a requirement needs an acceptance criterion", () => assert.ok(problems({ acceptance: [] }).includes("has no acceptance criteria")));
  test("an acceptance criterion must be Given, when, then", () => {
    assert.ok(problems({ acceptance: ["It works."] }).some((p) => p.includes("not Given, when, then")));
  });
  test("the task must exist in the BPMN", () => assert.ok(problems({ task: "T09" }).some((p) => p.includes("T09 is not in the process"))));
  test("the actor must be the lane of the task", () => assert.ok(problems({ actor: "Finance" }).some((p) => p.includes("not the lane of T01"))));
  test("the rules must exist in the process notes", () => assert.ok(problems({ rules: ["BR-99"] }).includes("BR-99 is not a business rule")));
  test("the id has the form FR-NN and the priority is valid", () => {
    assert.ok(problems({ id: "R1" }).some((p) => p.includes("FR-NN")));
    assert.ok(problems({ priority: "Urgent" }).some((p) => p.includes("priority")));
  });
  test("a repeated id is found in the list", () => {
    const list = [...reqs, { ...reqs[0] }];
    assert.ok(checkAll(list, model, notes).some((p) => p.problem === "the id is used twice"));
  });
});

describe("coverage and the document", () => {
  test("a task without a requirement is listed", () => {
    assert.deepEqual(coverage(model, reqs.filter((r) => r.task !== "T04")).uncovered, ["T04"]);
  });
  test("a business rule that no requirement uses is listed", () => {
    assert.deepEqual(uncoveredRules(notes, reqs.filter((r) => r.id !== "FR-07")), ["BR-07"]);
  });
  test("the document groups the requirements under their tasks, with acceptance criteria", () => {
    const md = renderRequirements(model, reqs);
    assert.match(md, /## T03 Check venue availability/);
    assert.match(md, /## G3 All checks passed\?/);
    assert.match(md, /### FR-04 \(Must\)/);
    assert.ok(md.indexOf("## T02") < md.indexOf("## T06") && md.indexOf("## T06") < md.indexOf("## T08"));
    assert.equal((md.match(/^- Given /gm) ?? []).length, reqs.flatMap((r) => r.acceptance).length);
  });
});
