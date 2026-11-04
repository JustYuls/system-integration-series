import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { collect } from "../review/uml-facts.js";

describe("the AI review of the UML answer", () => {
  const f = collect();
  test("the real diagrams have no problems", () => assert.equal(f.realProblems, 0));
  test("finding 1: the draft sequence diagram skips the queue (T07)", () => assert.ok(f.skipsQueue));
  test("finding 2: the draft component diagram has an arrow from the page to Open-Meteo", () => assert.ok(f.pageToApi));
  test("finding 3: the draft state diagram has a state nobody can leave", () => assert.ok(f.stuckState));
  test("claim 4 is false: a sequence diagram is a behavior view, not structure", () => {
    assert.equal(f.sequenceView, "behavior");
    assert.deepEqual(f.structureKinds, ["class", "component", "deployment"]);
  });
  test("claim 5 is false: a component diagram does not show the order of calls", () => {
    assert.equal(f.componentShowsOrder, false);
    assert.equal(f.componentHasMessages, false);
  });
  test("claim 6 is true: the state diagram shows the four statuses", () => {
    assert.ok(f.stateStatesMatch);
    assert.ok(f.stateViewBehavior);
  });
});
