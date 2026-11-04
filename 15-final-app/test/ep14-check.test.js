import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkAll, checkComponent, checkDeployment, checkSequence, checkState, parseFlowchart, parseSequence, parseState } from "../src/diagram-check.js";
import { buildDiagrams } from "../src/diagrams.js";

const real = buildDiagrams();
const without = (text, pattern) => text.split("\n").filter((l) => !pattern.test(l)).join("\n");
const some = (problems, part) => problems.some((p) => p.includes(part));

describe("the real diagrams pass every checker", () => {
  const all = checkAll(real);
  for (const kind of Object.keys(all)) test(`${kind} diagram has no problems`, () => assert.deepEqual(all[kind], []));
});

describe("parsers", () => {
  test("parseFlowchart finds nodes, groups and labelled arrows", () => {
    const g = parseFlowchart('flowchart LR\n  subgraph a["A"]\n    x["X"]\n  end\n  x -->|"hello"| y\n  y["Y"]');
    assert.deepEqual(g.nodes.x, { label: "X", group: "a" });
    assert.deepEqual(g.edges, [{ from: "x", to: "y", label: "hello" }]);
  });
  test("parseSequence reads participants, messages, notes and blocks", () => {
    const s = parseSequence("sequenceDiagram\n  participant A as Alpha\n  A->>B: T01 hi\n  Note over A: T02 note\n  par x\n  and y\n  end");
    assert.deepEqual(s.participants, ["A"]);
    assert.deepEqual(s.messages, [{ from: "A", to: "B", text: "T01 hi" }]);
    assert.equal(s.notes[0].text, "T02 note");
    assert.deepEqual(s.blocks, ["par", "and", "end"]);
  });
  test("parseState reads readable names and transitions", () => {
    const s = parseState('stateDiagram-v2\n  state "On hold" as Onhold\n  [*] --> Pending : start\n  Pending --> Onhold');
    assert.deepEqual(s.states.map((x) => x.label).sort(), ["On hold", "Pending"]);
    assert.equal(s.transitions.length, 2);
  });
});

describe("component checker", () => {
  test("a missing service is reported", () => assert.ok(some(checkComponent(without(real.component, /finance_service/)), "finance-service")));
  test("a missing outside API is reported", () => assert.ok(some(checkComponent(without(real.component, /Frankfurter/)), "Frankfurter")));
  test("an arrow from the page to an API is reported", () => assert.ok(some(checkComponent(`${real.component}\n  page --> api_open_meteo`), "from the page to api_open_meteo")));
  test("an API called by something other than its adapter is reported", () => assert.ok(some(checkComponent(`${real.component}\n  planner --> api_nager_date`), "not by its adapter")));
  test("an undeclared node in an arrow is reported", () => assert.ok(some(checkComponent(`${real.component}\n  planner --> ghost`), "ghost")));
});

describe("sequence checker", () => {
  test("a missing task is reported", () => assert.ok(some(checkSequence(without(real.sequence, /T06/)), "T06")));
  test("an unknown participant is reported", () => assert.ok(some(checkSequence(`${real.sequence}\n  GW->>ZZ: T01 again`), "ZZ")));
  test("an unused participant is reported", () => assert.ok(some(checkSequence(real.sequence.replace("participant N as Notifier", "participant N as Notifier\n  participant X as Nobody")), "X never")));
  test("a par block that is not closed is reported", () => {
    const open = real.sequence.replace("  end\n  Note over GW: G3", "  Note over GW: G3");
    assert.ok(some(checkSequence(open), "never closed"));
  });
  test("an extra end is reported", () => assert.ok(some(checkSequence(`${real.sequence}\n  end`), "closes nothing")));
  test("tasks in the wrong order are reported", () => {
    const swapped = real.sequence.replace("T07 publish", "T01 publish").replace("T07 deliver", "T01 deliver");
    assert.ok(some(checkSequence(swapped), "T07"));
  });
});

describe("state checker", () => {
  test("a state nobody can leave is reported", () => assert.ok(some(checkState(without(real.state, /^\s*Onhold -->/)), 'nobody can leave the state "On hold"')));
  test("a missing status is reported", () => assert.ok(some(checkState(without(real.state, /Returned/)), "Returned")));
  test("a state that is not a status is reported", () => assert.ok(some(checkState(`${real.state}\n  Pending --> Archived`), "Archived")));
  test("a state that cannot be reached is reported", () => assert.ok(some(checkState(without(real.state, /Pending --> Onhold/)), "cannot be reached")));
});

describe("deployment checker", () => {
  test("a missing port is reported", () => assert.ok(some(checkDeployment(real.deployment.replaceAll(":4002", "")), "4002")));
  test("an API outside the internet group is reported", () => {
    const wrong = real.deployment.replace('subgraph internet["Internet"]', 'subgraph internet2["Internet"]');
    assert.ok(some(checkDeployment(wrong), "must be drawn on the internet"));
  });
});
