import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { check, names, simulate } from "../src/bpmn.js";
import { exampleFile, readExample } from "../src/examples.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const flowName = (m, id) => m.flows.find((f) => f.id === id).name;
const allowed = ["startEvent", "endEvent", "task", "userTask", "serviceTask", "sendTask", "exclusiveGateway", "parallelGateway"];

describe("library borrowing", () => {
  const m = readExample("library-borrowing");
  test("it is a valid process", () => assert.deepEqual(check(m), []));
  test("it has 9 elements, 8 flows and 3 lanes", () => assert.deepEqual([Object.keys(m.nodes).length, m.flows.length, m.lanes.length], [9, 8, 3]));
  test("it uses only start, user and service tasks, one exclusive gateway and ends", () => {
    const types = new Set(Object.values(m.nodes).map((n) => n.type));
    assert.deepEqual([...types].sort(), ["endEvent", "exclusiveGateway", "serviceTask", "startEvent", "userTask"]);
  });
  test("the choices are labelled Yes and No", () => assert.deepEqual(m.nodes.G1.outgoing.map((id) => flowName(m, id)), ["Yes", "No"]));
  test("the Yes path lends the book, the No path offers a reservation", () => {
    assert.deepEqual(names(m, simulate(m, { G1: "Yes" })).slice(-3), ["Hand over the book", "Record the loan", "Book borrowed"]);
    assert.deepEqual(names(m, simulate(m, { G1: "No" })).slice(-2), ["Offer a reservation", "Reservation made"]);
  });
  test("an exclusive gateway follows one path only", () => {
    const yes = simulate(m, { G1: "Yes" });
    assert.ok(yes.includes("T03") && !yes.includes("T05"));
  });
  test("the simulator asks for a decision", () => assert.throws(() => simulate(m), /no decision for G1/));
});

describe("online order", () => {
  const m = readExample("online-order");
  test("it is a valid process", () => assert.deepEqual(check(m), []));
  test("it uses only the element types of episode 2", () => {
    for (const n of Object.values(m.nodes)) assert.ok(allowed.includes(n.type), n.type);
  });
  test("a parallel gateway splits into payment and stock, and a second one joins", () => {
    assert.equal(m.nodes.G1.outgoing.length, 2);
    assert.equal(m.nodes.G2.incoming.length, 2);
    assert.equal(m.nodes.G1.type, "parallelGateway");
  });
  test("it has two send tasks and three lanes", () => {
    assert.equal(Object.values(m.nodes).filter((n) => n.type === "sendTask").length, 2);
    assert.deepEqual(m.lanes.map((l) => l.name), ["Customer", "Shop System", "Warehouse"]);
  });
  test("on Yes both checks run, the join waits and the order ships", () => {
    const path = simulate(m, { G3: "Yes" });
    assert.ok(path.indexOf("T02") < path.indexOf("G2") && path.indexOf("T03") < path.indexOf("G2"));
    assert.equal(path.filter((id) => id === "G2").length, 1);
    assert.equal(names(m, path).at(-1), "Order shipped");
  });
  test("on No the order is cancelled and nothing is packed", () => {
    const path = simulate(m, { G3: "No" });
    assert.equal(names(m, path).at(-1), "Order cancelled");
    assert.ok(!path.includes("T04"));
  });
});

describe("event request (copy of episode 2)", () => {
  const m = readExample("event-request");
  test("it is the course process: 14 elements, 17 flows, 3 lanes, no problems", () => {
    assert.deepEqual([Object.keys(m.nodes).length, m.flows.length, m.lanes.length], [14, 17, 3]);
    assert.deepEqual(check(m), []);
  });
  test("the four checks all run on Yes", () => {
    const path = simulate(m, { G3: "Yes" });
    for (const id of ["T02", "T03", "T04", "T05"]) assert.ok(path.includes(id));
  });
});

describe("broken order", () => {
  const problems = check(readExample("broken-order"));
  const has = (rule, id) => problems.some((p) => p.rule === rule && p.id === id);
  test("a gateway that does not split is found", () => assert.ok(has("gateway-shape", "G3")));
  test("a dead-end task is found", () => assert.ok(has("reaches-end", "T07") && has("task-connected", "T07")));
  test("an element outside every lane is found", () => assert.ok(has("lane", "T04")));
  test("exactly four problems are reported", () => assert.equal(problems.length, 4));
});

describe("diagrams and scripts", () => {
  test("every example has a picture that Draw.io or bpmn.io can open", () => {
    for (const name of ["library-borrowing", "online-order", "event-request", "broken-order"]) {
      const xml = readFileSync(exampleFile(name), "utf8");
      const m = readExample(name);
      const shapes = (xml.match(/<bpmndi:BPMNShape /g) ?? []).length;
      assert.equal(shapes, Object.keys(m.nodes).length + m.lanes.length, name);
    }
  });
  test("check-examples.js prints OK for the three examples", () => {
    const out = execFileSync("node", ["check-examples.js"], { cwd: root, encoding: "utf8" });
    assert.equal(out.split("\n").filter((l) => /\bOK\b/.test(l)).length, 3);
    assert.match(out, /uses: start event/);
  });
  test("check-examples.js --broken lists the problems and exits with 1", () => {
    const r = spawnSync("node", ["check-examples.js", "--broken"], { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /gateway-shape/);
    assert.match(r.stdout, /4 problems found/);
  });
  test("walk-through.js prints both paths of the online order", () => {
    const out = execFileSync("node", ["walk-through.js", "online-order"], { cwd: root, encoding: "utf8" });
    assert.match(out, /Order shipped/);
    assert.match(out, /Order cancelled/);
  });
});
