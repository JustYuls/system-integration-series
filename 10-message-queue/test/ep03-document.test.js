import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { gaps, loadModel, loadNotes, loadStakeholders, questionProblems, renderProcessDoc, taskOrder } from "../src/document.js";

const model = loadModel();
const notes = loadNotes();
const problem = (mutate) => {
  const copy = structuredClone(notes);
  mutate(copy);
  return gaps(model, copy).map((g) => `${g.task} ${g.gap}`);
};

describe("the process notes", () => {
  test("every task of the process is documented", () => assert.deepEqual(gaps(model, notes), []));
  test("the tasks come in the order of the flow, with the other path last", () => {
    assert.deepEqual(taskOrder(model), ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08"]);
  });
  test("there are eight business rules, and each one is used", () => {
    assert.equal(Object.keys(notes.rules).length, 8);
    const used = new Set(Object.values(notes.tasks).flatMap((t) => t.rules));
    assert.deepEqual([...used].sort(), Object.keys(notes.rules).sort());
  });
  test("each outside API is named on its service task", () => {
    assert.deepEqual(Object.entries(notes.tasks).filter(([, t]) => t.externalApi).map(([id, t]) => [id, t.externalApi]), [["T02", "Nager.Date"], ["T04", "Open-Meteo"], ["T05", "Frankfurter"]]);
  });
});

describe("finding gaps", () => {
  test("a task without notes is found", () => assert.ok(problem((n) => delete n.tasks.T03).includes("T03 has no notes at all")));
  test("an actor that does not match the lane is found", () => {
    assert.ok(problem((n) => (n.tasks.T04.actor = "Organizer"))[0].includes('sits in the lane "Planner System"'));
  });
  test("a task with no inputs or outputs is found", () => {
    const found = problem((n) => ((n.tasks.T02.inputs = []), (n.tasks.T02.outputs = [])));
    assert.deepEqual(found, ["T02 has no inputs", "T02 has no outputs"]);
  });
  test("a service task needs a system and an exception", () => {
    assert.deepEqual(problem((n) => ((n.tasks.T04.system = ""), (n.tasks.T04.exceptions = []))), ["T04 is a service task but names no system", "T04 is a service task with no exception: what if the service is down?"]);
  });
  test("an unknown rule is found", () => assert.deepEqual(problem((n) => (n.tasks.T01.rules = ["BR-99"])), ["T01 uses BR-99, which is not a business rule", "BR-06 is a business rule that no task uses"]));
  test("a rule that no task uses is found", () => assert.deepEqual(problem((n) => (n.tasks.T05.rules = ["BR-05"])), ["BR-07 is a business rule that no task uses"]));
  test("notes for a task that is not in the process are found", () => assert.deepEqual(problem((n) => (n.tasks.T99 = { actor: "X" })), ["T99 is described in the notes but is not in the process"]));
});

describe("the process document", () => {
  const doc = renderProcessDoc(model, notes);
  test("it starts with the process name and the purpose", () => {
    assert.ok(doc.startsWith("# Event request process"));
    assert.ok(doc.includes("**Purpose.**"));
  });
  test("it lists the steps in order", () => assert.ok(doc.includes("1. Submit event request (T01)\n2. Check date for holidays (T02)")));
  test("it has a section for each task", () => assert.equal((doc.match(/^### T\d\d /gm) ?? []).length, 8));
  test("it shows who is responsible for each rule", () => assert.ok(doc.includes("| BR-02 | An outdoor event needs a rain chance below 60 percent on its date. | T04 |")));
  test("it names the decision", () => assert.ok(doc.includes("**G3 All checks passed?**")));
});

describe("questions for the stakeholders", () => {
  const stakeholders = loadStakeholders();
  test("every stakeholder has three open questions", () => assert.deepEqual(questionProblems(stakeholders, model), []));
  test("a yes or no question is rejected", () => {
    const bad = [{ id: "SHX", name: "X", lane: "Organizer", questions: ["Is the form slow?", "How long does it take?", "What do you change?"] }, ...stakeholders.slice(1)];
    assert.ok(questionProblems(bad, model).some((p) => p.includes("yes or no")));
  });
  test("a lane nobody is asked about is found", () => assert.deepEqual(questionProblems(stakeholders.filter((s) => s.lane !== "Organizer"), model), ['nobody is asked about the lane "Organizer"']));
  test("a question must end with a question mark", () => {
    const bad = structuredClone(stakeholders);
    bad[0].questions[0] = "Tell me about the form.";
    assert.ok(questionProblems(bad, model).some((p) => p.includes("is not a question")));
  });
});
