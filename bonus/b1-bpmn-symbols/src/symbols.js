// The catalog of BPMN symbols this bonus video teaches (docs/symbols.json), and a few helpers to use it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "symbols.json");

export const CATEGORIES = ["events", "activities", "gateways", "flows", "swimlanes", "artifacts"];
export const REQUIRED = ["id", "name", "category", "shape", "marker", "meaning", "useWhen", "example", "commonMistake"];

export const loadCatalog = () => JSON.parse(readFileSync(file, "utf8"));
export const catalog = loadCatalog();

export const bySymbol = (id, list = catalog) => list.find((s) => s.id === id);

// { events: [...], activities: [...], ... } in the order of CATEGORIES
export function byCategory(list = catalog) {
  return Object.fromEntries(CATEGORIES.map((c) => [c, list.filter((s) => s.category === c)]));
}

// A list of problems (empty = the catalog is complete): a missing field, a bad category, a repeated id.
export function checkCatalog(list = catalog) {
  const problems = [];
  const seen = new Set();
  for (const [i, s] of list.entries()) {
    const label = s.id ?? `entry ${i}`;
    for (const field of REQUIRED) {
      if (typeof s[field] !== "string" || s[field].trim() === "") problems.push(`${label}: missing ${field}`);
    }
    if (s.category && !CATEGORIES.includes(s.category)) problems.push(`${label}: unknown category ${s.category}`);
    if (seen.has(s.id)) problems.push(`${label}: duplicate id`);
    seen.add(s.id);
  }
  return problems;
}

// The parser of episode 2 knows these node types. Each one is the plain form of a symbol.
export const NODE_SYMBOL = {
  startEvent: "start-none",
  endEvent: "end-none",
  task: "task",
  userTask: "user-task",
  serviceTask: "service-task",
  sendTask: "send-task",
  exclusiveGateway: "exclusive-gateway",
  parallelGateway: "parallel-gateway",
};

// A parsed BPMN node ({ type, ... }) -> its entry in the catalog (undefined if the type is not taught).
export const symbolOf = (node) => bySymbol(NODE_SYMBOL[node.type]);

// The symbols a parsed process uses: its nodes, plus sequence flows and lanes when it has them.
export function symbolsUsed(model) {
  const ids = new Set(Object.values(model.nodes).map((n) => NODE_SYMBOL[n.type]));
  if (model.flows.length) ids.add("sequence-flow");
  if (model.lanes.length) ids.add("lane");
  return [...ids].map((id) => bySymbol(id));
}
