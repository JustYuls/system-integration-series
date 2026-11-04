// Checkers for the Mermaid diagrams: small parsers, then rules. Every problem is a sentence; an empty list means the diagram is good.
import { isTask } from "./bpmn.js";
import { loadModel } from "./document.js";
import { PORTS } from "./ports.js";
import { STATUSES } from "./services/student-affairs.js";
import { apiId, isAdapter, nodeId, processShape } from "./diagrams.js";
import { loadCatalog } from "./soa.js";

// ------------------------------------------------------------------ parsers
// A flowchart: nodes (id["label"]), the group (subgraph) of each node, and edges (a -->|"label"| b).
export function parseFlowchart(text) {
  const nodes = {};
  const edges = [];
  const open = [];
  for (const line of text.split("\n")) {
    const group = /^\s*subgraph\s+(\w+)\["([^"]*)"\]/.exec(line);
    if (group) open.push(group[1]);
    else if (/^\s*end\s*$/.test(line)) open.pop();
    const node = !group && /^\s*(\w+)\["([^"]*)"\]\s*$/.exec(line);
    if (node) nodes[node[1]] = { label: node[2], group: open.at(-1) ?? null };
    const edge = /^\s*(\w+)\s*-->(?:\|"?([^|"]*)"?\|)?\s*(\w+)\s*$/.exec(line);
    if (edge) edges.push({ from: edge[1], to: edge[3], label: edge[2] ?? "" });
  }
  return { nodes, edges };
}

const ARROW = String.raw`(?:-->>|->>|--\)|-\)|--x|-x|-->|->)`;
const MESSAGE = new RegExp(String.raw`^\s*(\w+)\s*${ARROW}\s*[+-]?(\w+)\s*:`);
const BLOCKS = ["par", "alt", "opt", "loop", "critical", "break", "rect"];

// A sequence diagram: the declared participants, the messages, the notes, and the block lines.
export function parseSequence(text) {
  const out = { participants: [], messages: [], notes: [], blocks: [] };
  for (const line of text.split("\n")) {
    const declared = /^\s*participant\s+(\w+)/.exec(line);
    if (declared) out.participants.push(declared[1]);
    const message = MESSAGE.exec(line);
    if (message) out.messages.push({ from: message[1], to: message[2], text: line.slice(line.indexOf(":") + 1).trim() });
    const note = /^\s*Note\s+(?:over|left of|right of)\s+([\w, ]+):\s*(.*)$/.exec(line);
    if (note) out.notes.push({ over: note[1].split(",").map((x) => x.trim()), text: note[2] });
    const block = /^\s*(par|alt|opt|loop|critical|break|rect|and|else|end)\b/.exec(line);
    if (block) out.blocks.push(block[1]);
  }
  return out;
}

// A state diagram: the labels of the states and the transitions ([*] is the start and the end).
export function parseState(text) {
  const labels = {};
  const transitions = [];
  for (const line of text.split("\n")) {
    const declared = /^\s*state\s+"([^"]*)"\s+as\s+(\w+)/.exec(line);
    if (declared) labels[declared[2]] = declared[1];
    const move = /^\s*(\[\*\]|\w+)\s*-->\s*(\[\*\]|\w+)(?:\s*:\s*(.*))?$/.exec(line);
    if (move) transitions.push({ from: move[1], to: move[2], label: move[3] ?? "" });
  }
  const ids = new Set(transitions.flatMap((t) => [t.from, t.to]).filter((x) => x !== "[*]"));
  for (const id of Object.keys(labels)) ids.add(id);
  return { states: [...ids].map((id) => ({ id, label: labels[id] ?? id })), transitions };
}

// ------------------------------------------------------------------ rules
export function checkComponent(text, { catalog = loadCatalog() } = {}) {
  const problems = [];
  const { nodes, edges } = parseFlowchart(text);
  const apis = [...new Set(catalog.services.map((s) => s.externalApi).filter(Boolean))];
  for (const s of catalog.services) if (!nodes[nodeId(s.id)]) problems.push(`the service ${s.id} is not in the component diagram`);
  for (const api of apis) if (!nodes[apiId(api)]) problems.push(`the outside API ${api} is not in the component diagram`);
  if (!nodes.page) problems.push("the browser page is not in the component diagram");
  for (const e of edges) for (const end of [e.from, e.to]) if (!nodes[end]) problems.push(`the arrow ${e.from} to ${e.to} uses ${end}, which is not declared`);
  for (const e of edges.filter((x) => x.from === "page" && x.to !== "planner")) problems.push(`the page must talk only to the gateway, but there is an arrow from the page to ${e.to}`);
  const adapters = new Set(catalog.services.filter(isAdapter).map((s) => nodeId(s.id)));
  for (const api of apis) {
    for (const e of edges.filter((x) => x.to === apiId(api) && !adapters.has(x.from))) problems.push(`${api} is called by ${e.from}, not by its adapter`);
  }
  for (const id of Object.keys(nodes)) if (!edges.some((e) => e.from === id || e.to === id)) problems.push(`${id} has no arrow: it is not connected to anything`);
  return problems;
}

export function checkSequence(text, { model = loadModel() } = {}) {
  const problems = [];
  const { participants, messages, notes, blocks } = parseSequence(text);
  const known = new Set(participants);
  for (const m of messages) for (const end of [m.from, m.to]) if (!known.has(end)) problems.push(`the message "${m.text}" uses ${end}, which is not a declared participant`);
  for (const p of participants) {
    if (!messages.some((m) => m.from === p || m.to === p)) problems.push(`the participant ${p} never sends or receives a message`);
  }
  // every BPMN task is a message or a note, and they come in the order of the process
  const spoken = [...messages.map((m) => m.text), ...notes.map((n) => n.text), ...text.split("\n").filter((l) => /^\s*(par|and|alt|else)\b/.test(l))];
  const first = {};
  for (const task of Object.values(model.nodes).filter(isTask)) {
    const at = spoken.findIndex((line) => new RegExp(`\\b${task.id}\\b`).test(line));
    if (at < 0) problems.push(`the task ${task.id} "${task.name}" is not in the sequence diagram`);
    else first[task.id] = at;
  }
  const shape = processShape(model);
  const stages = [shape.before, shape.parallel, shape.branches.map((b) => b.task), shape.after];
  stages.forEach((stage, i) => {
    for (const later of stages.slice(i + 1)) {
      for (const a of stage) for (const b of later) if (first[a.id] > first[b.id]) problems.push(`${a.id} comes after ${b.id}, but the process runs it first`);
    }
  });
  // par ... and ... end must be balanced
  const stack = [];
  for (const b of blocks) {
    if (BLOCKS.includes(b)) stack.push({ kind: b, ands: 0 });
    else if (b === "and") {
      if (stack.at(-1)?.kind === "par") stack.at(-1).ands++;
      else problems.push("an `and` is outside a `par` block");
    } else if (b === "else") {
      if (stack.at(-1)?.kind !== "alt") problems.push("an `else` is outside an `alt` block");
    } else if (b === "end") {
      const closed = stack.pop();
      if (!closed) problems.push("an `end` closes nothing");
      else if (closed.kind === "par" && closed.ands === 0) problems.push("a `par` block has no `and`: nothing runs in parallel");
    }
  }
  for (const open of stack) problems.push(`a \`${open.kind}\` block is never closed with \`end\``);
  return problems;
}

export function checkState(text, { statuses = STATUSES } = {}) {
  const problems = [];
  const { states, transitions } = parseState(text);
  const labels = states.map((s) => s.label);
  for (const status of statuses) if (!labels.includes(status)) problems.push(`the status "${status}" is not in the state diagram`);
  for (const s of states) {
    if (!statuses.includes(s.label)) problems.push(`"${s.label}" is not a status of the Student Affairs service`);
    if (!transitions.some((t) => t.from === s.id)) problems.push(`nobody can leave the state "${s.label}": it has no arrow out and no way to the end`);
  }
  // every state can be reached from the start
  const reached = new Set(["[*]"]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of transitions) {
      if (reached.has(t.from) && !reached.has(t.to)) {
        reached.add(t.to);
        grew = true;
      }
    }
  }
  for (const s of states) if (!reached.has(s.id)) problems.push(`the state "${s.label}" cannot be reached from the start`);
  if (!transitions.some((t) => t.from === "[*]")) problems.push("the diagram has no start arrow from [*]");
  return problems;
}

export function checkDeployment(text, { catalog = loadCatalog(), ports = PORTS } = {}) {
  const problems = [];
  const { nodes, edges } = parseFlowchart(text);
  for (const [name, port] of Object.entries(ports)) if (!text.includes(`:${port}`)) problems.push(`the port ${port} of ${name} is not in the deployment diagram`);
  for (const api of new Set(catalog.services.map((s) => s.externalApi).filter(Boolean))) {
    if (!nodes[apiId(api)]) problems.push(`the outside API ${api} is not in the deployment diagram`);
    else if (nodes[apiId(api)].group !== "internet") problems.push(`${api} must be drawn on the internet, outside the campus server`);
  }
  for (const e of edges) for (const end of [e.from, e.to]) if (!nodes[end]) problems.push(`the arrow ${e.from} to ${e.to} uses ${end}, which is not declared`);
  return problems;
}

// All four at once: { component: [...], sequence: [...], state: [...], deployment: [...] }.
export function checkAll(diagrams, inputs = {}) {
  return {
    component: checkComponent(diagrams.component, inputs),
    sequence: checkSequence(diagrams.sequence, inputs),
    state: checkState(diagrams.state, inputs),
    deployment: checkDeployment(diagrams.deployment, inputs),
  };
}
