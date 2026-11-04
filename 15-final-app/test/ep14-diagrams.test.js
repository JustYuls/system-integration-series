import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadModel } from "../src/document.js";
import { PORTS } from "../src/ports.js";
import { STATUSES } from "../src/services/student-affairs.js";
import { loadCatalog } from "../src/soa.js";
import { buildDiagrams, componentDiagram, deploymentDiagram, processShape, sequenceDiagram, stateDiagram, TRANSITIONS } from "../src/diagrams.js";

const catalog = loadCatalog();
const model = loadModel();

describe("component diagram", () => {
  const text = componentDiagram();
  test("it is a Mermaid flowchart with subgraphs", () => {
    assert.ok(text.startsWith("flowchart LR"));
    assert.ok((text.match(/subgraph /g) ?? []).length >= 5);
  });
  test("every service of the catalog is a node", () => {
    for (const s of catalog.services) assert.ok(text.includes(`${s.id.replace(/-/g, "_")}[`), s.id);
  });
  test("the campus services show their real ports", () => {
    for (const port of [PORTS.studentAffairs, PORTS.finance, PORTS.facilities, PORTS.gateway]) assert.ok(text.includes(`:${port}`), String(port));
  });
  test("changing the data changes the diagram", () => {
    const changed = structuredClone(catalog);
    changed.services[0].name = "Renamed service";
    assert.ok(componentDiagram({ catalog: changed }).includes("Renamed service"));
  });
});

describe("sequence diagram", () => {
  const text = sequenceDiagram();
  test("it declares ten participants", () => assert.equal((text.match(/^\s*participant /gm) ?? []).length, 10));
  test("the four checks sit in one par block with three and lines", () => {
    assert.equal((text.match(/^\s*par /gm) ?? []).length, 1);
    assert.equal((text.match(/^\s*and /gm) ?? []).length, 3);
  });
  test("every BPMN task id is in the text", () => {
    for (const id of Object.keys(model.nodes).filter((k) => /^T\d+$/.test(k))) assert.ok(text.includes(id), id);
  });
  test("the task names come from the BPMN file", () => {
    assert.ok(text.includes(model.nodes.T02.name));
    assert.ok(text.includes(model.nodes.T08.name));
  });
  test("the queue is used after the decision", () => {
    assert.ok(text.indexOf("T07 publish") > text.indexOf("T06 PATCH"));
  });
});

describe("process shape (read from the BPMN graph)", () => {
  const shape = processShape(model);
  test("T01 first, then four parallel checks, then two branches, then T07", () => {
    assert.deepEqual(shape.before.map((t) => t.id), ["T01"]);
    assert.deepEqual(shape.parallel.map((t) => t.id), ["T02", "T03", "T04", "T05"]);
    assert.deepEqual(shape.branches.map((b) => `${b.label}:${b.task.id}`), ["Yes:T06", "No:T08"]);
    assert.deepEqual(shape.after.map((t) => t.id), ["T07"]);
  });
});

describe("state diagram", () => {
  const text = stateDiagram();
  test("every status of the Student Affairs service is a state", () => {
    for (const s of STATUSES) assert.ok(text.includes(s) || text.includes(s.replace(/\s+/g, "")), s);
  });
  test("a status with a space is declared with its readable name", () => assert.ok(text.includes('state "On hold" as Onhold')));
  test("the transitions use only known statuses", () => {
    for (const t of TRANSITIONS) for (const end of [t.from, t.to]) assert.ok(end === "[*]" || STATUSES.includes(end), end);
  });
});

describe("deployment diagram", () => {
  const text = deploymentDiagram();
  test("every port of ports.js is in it", () => {
    for (const port of Object.values(PORTS)) assert.ok(text.includes(`:${port}`), String(port));
  });
  test("the outside APIs are on the internet, called with HTTPS", () => {
    assert.ok(text.includes('subgraph internet["Internet"]'));
    assert.equal((text.match(/-->\|"HTTPS"\|/g) ?? []).length, 3);
  });
});

test("buildDiagrams returns the four diagrams", () => {
  assert.deepEqual(Object.keys(buildDiagrams()), ["component", "sequence", "state", "deployment"]);
});
