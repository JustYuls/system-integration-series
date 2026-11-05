import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NODE_SYMBOL, REQUIRED, byCategory, bySymbol, catalog, checkCatalog, symbolOf, symbolsUsed } from "../src/symbols.js";
import { EXAMPLES, readExample } from "../src/examples.js";

describe("the symbol catalog", () => {
  test("every entry is complete and no id is repeated", () => assert.deepEqual(checkCatalog(), []));
  test("it has the six families", () => {
    const groups = byCategory();
    assert.deepEqual(Object.keys(groups), ["events", "activities", "gateways", "flows", "swimlanes", "artifacts"]);
    for (const list of Object.values(groups)) assert.ok(list.length >= 2);
  });
  test("it covers the symbols the video teaches", () => {
    const wanted = ["start-none", "start-message", "start-timer", "intermediate-message", "intermediate-timer", "end-none", "end-message", "end-terminate",
      "task", "user-task", "service-task", "send-task", "receive-task", "subprocess", "exclusive-gateway", "parallel-gateway", "inclusive-gateway",
      "event-gateway", "sequence-flow", "message-flow", "association", "pool", "lane", "data-object", "annotation"];
    for (const id of wanted) assert.ok(bySymbol(id), `missing ${id}`);
  });
  test("bySymbol returns undefined for an unknown id", () => assert.equal(bySymbol("hexagon"), undefined));
  test("checkCatalog reports a missing field", () => {
    const bad = [{ ...catalog[0], meaning: "" }];
    assert.deepEqual(checkCatalog(bad), [`${catalog[0].id}: missing meaning`]);
  });
  test("checkCatalog reports a duplicate id and a bad category", () => {
    const problems = checkCatalog([catalog[0], { ...catalog[0], category: "shapes" }]);
    assert.ok(problems.some((p) => p.includes("duplicate id")));
    assert.ok(problems.some((p) => p.includes("unknown category")));
  });
  test("every entry has all the required fields as text", () => {
    for (const s of catalog) for (const field of REQUIRED) assert.equal(typeof s[field], "string");
  });
});

describe("the circle rule and the gateway marks", () => {
  test("starts are thin, in-betweens double, ends thick", () => {
    for (const s of catalog.filter((x) => x.id.startsWith("start-"))) assert.equal(s.shape, "thin circle");
    for (const s of catalog.filter((x) => x.id.startsWith("intermediate-"))) assert.equal(s.shape, "double circle");
    for (const s of catalog.filter((x) => x.id.startsWith("end-"))) assert.equal(s.shape, "thick circle");
  });
  test("each gateway is a diamond with its own mark", () => {
    const marks = ["exclusive", "parallel", "inclusive"].map((k) => bySymbol(`${k}-gateway`).marker);
    assert.deepEqual(marks, ["X", "plus", "circle"]);
    assert.equal(bySymbol("event-gateway").marker, "pentagon");
    for (const s of catalog.filter((x) => x.category === "gateways")) assert.equal(s.shape, "diamond");
  });
  test("the task kinds differ by their icon", () => {
    const icons = ["user-task", "service-task", "send-task", "receive-task"].map((id) => bySymbol(id).marker);
    assert.equal(new Set(icons).size, 4);
  });
  test("a message flow goes between pools, a sequence flow stays inside one", () => {
    assert.equal(bySymbol("message-flow").scope, "between pools");
    assert.equal(bySymbol("sequence-flow").scope, "inside one pool");
  });
});

describe("symbolOf", () => {
  test("every node type of the parser maps to a catalog entry", () => {
    for (const [type, id] of Object.entries(NODE_SYMBOL)) assert.equal(symbolOf({ type }).id, id);
  });
  test("a start event is the plain start", () => assert.equal(symbolOf({ type: "startEvent" }).shape, "thin circle"));
  test("an unknown type gives undefined", () => assert.equal(symbolOf({ type: "callActivity" }), undefined));
  test("symbolsUsed lists nodes, flows and lanes of a process", () => {
    const names = symbolsUsed(readExample("library-borrowing")).map((s) => s.id);
    assert.deepEqual(names, ["start-none", "user-task", "service-task", "exclusive-gateway", "end-none", "sequence-flow", "lane"]);
  });
  test("every symbol the examples use is in the catalog", () => {
    for (const name of EXAMPLES) for (const s of symbolsUsed(readExample(name))) assert.ok(s, name);
  });
});
