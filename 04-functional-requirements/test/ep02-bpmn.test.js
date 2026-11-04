import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { check, isGateway, isTask, names, parseBpmn, readBpmn, simulate } from "../src/bpmn.js";
import { diagramXml, layout, withDiagram } from "../src/layout.js";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "process.bpmn");
const xml = readFileSync(file, "utf8");
const model = readBpmn(file);
const rules = (m) => check(m).map((p) => p.rule);

describe("reading the process", () => {
  test("it has 14 elements, 17 flows and 3 lanes", () => {
    assert.equal(Object.keys(model.nodes).length, 14);
    assert.equal(model.flows.length, 17);
    assert.equal(model.lanes.length, 3);
  });
  test("tasks, gateways and events are told apart", () => {
    assert.equal(Object.values(model.nodes).filter(isTask).length, 8);
    assert.equal(Object.values(model.nodes).filter(isGateway).length, 4);
    assert.equal(model.nodes.S1.type, "startEvent");
    assert.equal(model.nodes.E1.type, "endEvent");
  });
  test("incoming and outgoing flows are filled in", () => {
    assert.equal(model.nodes.G1.outgoing.length, 4);
    assert.equal(model.nodes.G2.incoming.length, 4);
    assert.equal(model.nodes.S1.incoming.length, 0);
  });
  test("the choices after the exclusive gateway are named", () => {
    assert.deepEqual(model.nodes.G3.outgoing.map((id) => model.flows.find((f) => f.id === id).name), ["Yes", "No"]);
  });
  test("each lane lists its elements", () => {
    assert.deepEqual(model.lanes.map((l) => l.name), ["Organizer", "Planner System", "Student Affairs Officer"]);
    assert.deepEqual(model.lanes[2].nodes, ["T06", "T08"]);
  });
});

describe("checking the process", () => {
  test("the event request process has no problems", () => assert.deepEqual(check(model), []));
  test("a missing start event is found", () => assert.ok(rules(parseBpmn(xml.replace(/<startEvent[^>]*\/>/, ""))).includes("has-start")));
  test("a missing end event is found", () => assert.ok(rules(parseBpmn(xml.replace(/<endEvent[^>]*\/>/, ""))).includes("has-end")));
  test("a flow to nowhere is found", () => assert.ok(rules(parseBpmn(xml.replace('targetRef="T07"', 'targetRef="X9"'))).includes("flow-ends")));
  test("a dead-end task is found", () => {
    const problems = check(parseBpmn(xml.replace(/<sequenceFlow id="F17"[^>]*\/>/, "")));
    assert.ok(problems.some((p) => p.rule === "task-connected" && p.id === "T07"));
  });
  test("a gateway that neither splits nor joins is found", () => {
    assert.ok(check(parseBpmn(xml.replace(/<sequenceFlow id="F13"[^>]*\/>/, ""))).some((p) => p.rule === "gateway-shape" && p.id === "G3"));
  });
  test("an unlabeled choice is found", () => assert.ok(rules(parseBpmn(xml.replace(' name="No"', ""))).includes("exclusive-labels")));
  test("an element outside every lane is found", () => {
    assert.ok(check(parseBpmn(xml.replace("<flowNodeRef>T05</flowNodeRef>", ""))).some((p) => p.rule === "lane" && p.id === "T05"));
  });
});

describe("running a token through the process", () => {
  test("with Yes, the request is approved and the organizer is told", () => {
    const path = simulate(model, { G3: "Yes" });
    assert.ok(path.includes("T06") && !path.includes("T08"));
    assert.equal(path.at(-1), "E1");
  });
  test("with No, the request is returned", () => {
    const path = simulate(model, { G3: "No" });
    assert.ok(path.includes("T08") && !path.includes("T06"));
  });
  test("the parallel gateway starts all four checks", () => {
    assert.deepEqual(simulate(model, { G3: "Yes" }).filter((id) => ["T02", "T03", "T04", "T05"].includes(id)).sort(), ["T02", "T03", "T04", "T05"]);
  });
  test("the join waits for all four checks and runs once", () => {
    const path = simulate(model, { G3: "Yes" });
    for (const id of ["T02", "T03", "T04", "T05"]) assert.ok(path.indexOf(id) < path.indexOf("G2"));
    assert.equal(path.filter((id) => id === "G2").length, 1);
  });
  test("an exclusive gateway needs a decision", () => assert.throws(() => simulate(model, {}), /no decision for G3/));
  test("names turns ids into task names", () => assert.deepEqual(names(model, ["T01", "T07"]), ["Submit event request", "Notify organizer"]));
});

describe("the diagram", () => {
  const { positions } = layout(model);
  test("every element gets a place", () => assert.equal(Object.keys(positions).length, 14));
  test("no two elements overlap", () => {
    const boxes = Object.values(positions);
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
      }
    }
  });
  test("the diagram has a shape for each element and an edge for each flow", () => {
    const d = diagramXml(model);
    assert.equal((d.match(/<bpmndi:BPMNShape/g) ?? []).length, 14 + 3);
    assert.equal((d.match(/<bpmndi:BPMNEdge/g) ?? []).length, 17);
  });
  test("adding the diagram twice changes nothing", () => {
    const once = withDiagram(xml, model);
    assert.equal(withDiagram(once, parseBpmn(once)), once);
  });
});
