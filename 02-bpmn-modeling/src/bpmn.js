// A small BPMN 2.0 reader, checker and token simulator. It understands the elements this course uses.
import { readFileSync } from "node:fs";

const NODE_TYPES = ["startEvent", "endEvent", "task", "userTask", "serviceTask", "sendTask", "exclusiveGateway", "parallelGateway"];
export const isTask = (n) => n.type.endsWith("Task") || n.type === "task";
export const isGateway = (n) => n.type.endsWith("Gateway");

function attributes(text) {
  return Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

export function parseBpmn(xml) {
  const nodes = {};
  for (const m of xml.matchAll(new RegExp(`<(${NODE_TYPES.join("|")})\\b([^>]*?)/?>`, "g"))) {
    const a = attributes(m[2]);
    nodes[a.id] = { id: a.id, type: m[1], name: a.name ?? a.id, incoming: [], outgoing: [] };
  }
  const flows = [...xml.matchAll(/<sequenceFlow\b([^>]*?)\/?>/g)].map((m) => {
    const a = attributes(m[1]);
    return { id: a.id, name: a.name ?? "", source: a.sourceRef, target: a.targetRef };
  });
  for (const f of flows) {
    nodes[f.source]?.outgoing.push(f.id);
    nodes[f.target]?.incoming.push(f.id);
  }
  const lanes = [...xml.matchAll(/<lane\b([^>]*)>(.*?)<\/lane>/gs)].map((m) => ({
    id: attributes(m[1]).id,
    name: attributes(m[1]).name,
    nodes: [...m[2].matchAll(/<flowNodeRef>([^<]+)<\/flowNodeRef>/g)].map((x) => x[1]),
  }));
  const process = attributes(/<process\b([^>]*)>/.exec(xml)?.[1] ?? "");
  return { id: process.id, name: process.name, nodes, flows, lanes };
}

export const readBpmn = (file) => parseBpmn(readFileSync(file, "utf8"));

// Checking: every problem is { rule, id, message }.
export function check(model) {
  const problems = [];
  const add = (rule, id, message) => problems.push({ rule, id, message });
  const nodes = Object.values(model.nodes);
  const flowById = Object.fromEntries(model.flows.map((f) => [f.id, f]));

  if (!nodes.some((n) => n.type === "startEvent")) add("has-start", "", "the process has no start event");
  if (!nodes.some((n) => n.type === "endEvent")) add("has-end", "", "the process has no end event");
  for (const f of model.flows) {
    if (!model.nodes[f.source]) add("flow-ends", f.id, `flow ${f.id} starts at ${f.source}, which does not exist`);
    if (!model.nodes[f.target]) add("flow-ends", f.id, `flow ${f.id} ends at ${f.target}, which does not exist`);
  }
  for (const n of nodes) {
    if (n.type === "startEvent" && n.incoming.length) add("start-no-incoming", n.id, `${n.id} is a start event but has an incoming flow`);
    if (n.type === "endEvent" && n.outgoing.length) add("end-no-outgoing", n.id, `${n.id} is an end event but has an outgoing flow`);
    if (isTask(n) && (n.incoming.length < 1 || n.outgoing.length < 1)) add("task-connected", n.id, `${n.id} "${n.name}" needs an incoming and an outgoing flow`);
    if (isGateway(n)) {
      const split = n.incoming.length === 1 && n.outgoing.length >= 2;
      const join = n.incoming.length >= 2 && n.outgoing.length === 1;
      if (!split && !join) add("gateway-shape", n.id, `${n.id} "${n.name}" must split (1 in, 2 or more out) or join (2 or more in, 1 out)`);
      if (n.type === "exclusiveGateway" && split && n.outgoing.some((id) => !flowById[id].name)) add("exclusive-labels", n.id, `${n.id}: every choice leaving an exclusive gateway needs a label`);
    }
  }
  const start = nodes.find((n) => n.type === "startEvent");
  if (start) {
    const reach = (from, next) => {
      const seen = new Set([from]);
      const stack = [from];
      while (stack.length) {
        for (const id of next(stack.pop())) {
          if (model.nodes[id] && !seen.has(id)) {
            seen.add(id);
            stack.push(id);
          }
        }
      }
      return seen;
    };
    const forward = reach(start.id, (id) => model.nodes[id].outgoing.map((f) => flowById[f].target));
    const ends = nodes.filter((n) => n.type === "endEvent").map((n) => n.id);
    const backward = new Set(ends.flatMap((e) => [...reach(e, (id) => model.nodes[id].incoming.map((f) => flowById[f].source))]));
    for (const n of nodes) {
      if (!forward.has(n.id)) add("reachable", n.id, `${n.id} "${n.name}" cannot be reached from the start`);
      if (!backward.has(n.id)) add("reaches-end", n.id, `${n.id} "${n.name}" is a dead end: it never reaches an end event`);
    }
  }
  const inLane = new Set(model.lanes.flatMap((l) => l.nodes));
  if (model.lanes.length) for (const n of nodes) if (!inLane.has(n.id)) add("lane", n.id, `${n.id} "${n.name}" is not in any lane`);
  return problems;
}

// Simulation: move tokens through the process. decisions = { gatewayId: "label of the flow to take" }.
export function simulate(model, decisions = {}) {
  const flowById = Object.fromEntries(model.flows.map((f) => [f.id, f]));
  const start = Object.values(model.nodes).find((n) => n.type === "startEvent");
  const executed = [];
  const arrived = {};
  const queue = [start.id];
  while (queue.length) {
    const node = model.nodes[queue.shift()];
    if (node.type === "parallelGateway" && node.incoming.length > 1) {
      arrived[node.id] = (arrived[node.id] ?? 0) + 1;
      if (arrived[node.id] < node.incoming.length) continue; // the join waits for every incoming path
    }
    executed.push(node.id);
    if (node.type === "exclusiveGateway" && node.outgoing.length > 1) {
      const choice = node.outgoing.map((f) => flowById[f]).find((f) => f.name === decisions[node.id]);
      if (!choice) throw new Error(`no decision for ${node.id}: choose one of ${node.outgoing.map((f) => flowById[f].name).join(", ")}`);
      queue.push(choice.target);
    } else {
      for (const f of node.outgoing) queue.push(flowById[f].target);
    }
  }
  return executed;
}

export const names = (model, ids) => ids.map((id) => model.nodes[id].name);
