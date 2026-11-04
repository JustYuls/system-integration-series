// Mermaid diagrams of the Campus Event Planner, written FROM the real project data, so they cannot drift:
//   services.json (the services)  ports.js (the ports)  process.bpmn (the tasks T01..T08)  student-affairs.js (the statuses)
import { isTask } from "./bpmn.js";
import { loadModel } from "./document.js";
import { PORTS } from "./ports.js";
import { STATUSES } from "./services/student-affairs.js";
import { loadCatalog } from "./soa.js";

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
export const nodeId = (serviceId) => serviceId.replace(/-/g, "_");
export const apiId = (apiName) => `api_${slug(apiName)}`;
export const stateId = (status) => status.replace(/\s+/g, "");

// Which services run on their own port, and where each one lives in the picture.
const PORT_OF = { "student-affairs-service": "studentAffairs", "finance-service": "finance", "facilities-service": "facilities" };
export const isAdapter = (s) => Boolean(s.externalApi) && !PORT_OF[s.id]; // wraps an outside API, runs inside the gateway
const isMessaging = (s) => s.id === "notification-service";
const outsideApis = (catalog) => [...new Set(catalog.services.map((s) => s.externalApi).filter(Boolean))];
const shortName = (s) => s.name.replace(/ service$/, "");

// ------------------------------------------------------------------ 1. component diagram
export function componentDiagram({ catalog = loadCatalog(), ports = PORTS } = {}) {
  const adapters = catalog.services.filter(isAdapter);
  const campus = catalog.services.filter((s) => PORT_OF[s.id]);
  const lines = ["flowchart LR"];
  const add = (...text) => lines.push(...text);

  add('  subgraph browser["Browser"]', '    page["Planner web page"]', "  end");
  add(`  subgraph gateway["Gateway :${ports.gateway}"]`, '    planner["API gateway + planEvent"]');
  for (const s of adapters) add(`    ${nodeId(s.id)}["${s.name}<br/>adapter"]`);
  add("  end");
  add('  subgraph campus["Campus services"]');
  for (const s of campus) add(`    ${nodeId(s.id)}["${s.name}<br/>:${ports[PORT_OF[s.id]]}"]`);
  add("  end");
  add('  subgraph messaging["Messaging"]', '    queue["Queue"]');
  for (const s of catalog.services.filter(isMessaging)) add(`    ${nodeId(s.id)}["Notifier<br/>${s.name}"]`);
  add("  end");
  add('  subgraph outside["Outside APIs"]');
  for (const api of outsideApis(catalog)) add(`    ${apiId(api)}["${api}"]`);
  add("  end");

  add('  page -->|"POST /api/requests (T01)"| planner');
  for (const s of [...campus, ...adapters]) add(`  planner -->|"${s.tasks.join(", ")}"| ${nodeId(s.id)}`);
  for (const s of adapters) add(`  ${nodeId(s.id)} --> ${apiId(s.externalApi)}`);
  const notifier = catalog.services.find(isMessaging);
  add(`  planner -->|"${notifier.tasks.join(", ")}: request.decided"| queue`);
  add(`  queue --> ${nodeId(notifier.id)}`);
  return lines.join("\n");
}

// ------------------------------------------------------------------ 2. sequence diagram
// The participants. A participant stands for a service of the catalog (serviceId), an outside API (api), or a part with no service.
export const PARTICIPANTS = [
  { id: "B", label: "Browser" },
  { id: "GW", label: "Gateway" },
  { id: "SA", label: "Student Affairs", serviceId: "student-affairs-service" },
  { id: "FAC", label: "Facilities", serviceId: "facilities-service" },
  { id: "FIN", label: "Finance", serviceId: "finance-service" },
  { id: "HOL", label: "Holiday API (Nager.Date)", api: "Nager.Date" },
  { id: "WEA", label: "Weather API (Open-Meteo)", api: "Open-Meteo" },
  { id: "CUR", label: "Currency API (Frankfurter)", api: "Frankfurter" },
  { id: "Q", label: "Queue" },
  { id: "N", label: "Notifier", serviceId: "notification-service" },
];

// What each BPMN task does as messages: [from, to, text, reply]. The task id is in every first message.
export const CALLS = {
  T01: [["B", "GW", "T01 POST /api/requests", null], ["GW", "SA", "T01 POST /requests (status Pending)", "201 and the request number"]],
  T02: [["GW", "HOL", "T02 GET /PublicHolidays/2027/PH", "the holidays of the year"]],
  T03: [["GW", "FAC", "T03 GET /venues/gym/availability", "free, capacity, penalty"]],
  T04: [["GW", "WEA", "T04 GET /v1/forecast", "rain chance"]],
  T05: [["GW", "FIN", "T05 GET /deposits/EVT-0001", "balance"], ["GW", "CUR", "T05 GET /v1/latest?base=USD", "rate"]],
  T06: [["GW", "SA", "T06 PATCH /requests/EVT-0001 Approved", null]],
  T08: [["GW", "SA", "T08 PATCH /requests/EVT-0001 Returned", null]],
  T07: [["GW", "Q", "T07 publish request.decided", null], ["Q", "N", "T07 deliver to the notifier", null]],
};

// The shape of the process, read from the BPMN graph: tasks, the parallel checks, the decision, the tasks after it.
export function processShape(model = loadModel()) {
  const target = (flow) => model.nodes[model.flows.find((f) => f.id === flow).target];
  const next = (node) => node.outgoing.map(target);
  const shape = { before: [], split: null, parallel: [], decision: null, branches: [], after: [] };
  let node = next(Object.values(model.nodes).find((n) => n.type === "startEvent"))[0];
  while (isTask(node)) {
    shape.before.push(node);
    node = next(node)[0];
  }
  shape.split = node; // the parallel gateway "Run the checks"
  shape.parallel = next(node);
  node = next(next(shape.parallel[0])[0])[0]; // past the join
  shape.decision = node; // the exclusive gateway "All checks passed?"
  shape.branches = node.outgoing.map((id) => ({ label: model.flows.find((f) => f.id === id).name, task: target(id) }));
  node = next(next(shape.branches[0].task)[0])[0]; // past the merge
  while (isTask(node)) {
    shape.after.push(node);
    node = next(node)[0];
  }
  return shape;
}

export function sequenceDiagram({ model = loadModel() } = {}) {
  const shape = processShape(model);
  const lines = ["sequenceDiagram", "  autonumber"];
  for (const p of PARTICIPANTS) lines.push(`  participant ${p.id} as ${p.label}`);

  const messages = (task, indent) => {
    for (const [from, to, text, reply] of CALLS[task.id]) {
      lines.push(`${indent}${from}->>${to}: ${text}`);
      if (reply) lines.push(`${indent}${to}-->>${from}: ${reply}`);
    }
  };
  for (const t of shape.before) messages(t, "  ");
  lines.push(`  Note over GW: ${shape.split.id} ${shape.split.name}: the four checks run together`);
  shape.parallel.forEach((t, i) => {
    lines.push(`  ${i === 0 ? "par" : "and"} ${t.id} ${t.name}`);
    messages(t, "    ");
  });
  lines.push("  end");
  lines.push(`  Note over GW: ${shape.decision.id} ${shape.decision.name}`);
  shape.branches.forEach((b, i) => {
    lines.push(`  ${i === 0 ? "alt" : "else"} ${b.label}: ${b.task.id} ${b.task.name}`);
    messages(b.task, "    ");
  });
  lines.push("  end");
  for (const t of shape.after) messages(t, "  ");
  lines.push("  GW-->>B: 201 and the assessment");
  return lines.join("\n");
}

// ------------------------------------------------------------------ 3. state diagram
// The life of a request. [*] is the start and the end. Every arrow is a real call:
// POST /requests creates it Pending; planEvent sets Approved (T06) or Returned (T08) with PATCH;
// an officer may PATCH any status (for example On hold); DELETE withdraws a Pending request.
export const TRANSITIONS = [
  { from: "[*]", to: "Pending", label: "T01 request created" },
  { from: "Pending", to: "Approved", label: "all checks passed (T06)" },
  { from: "Pending", to: "Returned", label: "a check failed (T08)" },
  { from: "Pending", to: "On hold", label: "an officer waits for more facts" },
  { from: "Pending", to: "[*]", label: "withdrawn (DELETE)" },
  { from: "On hold", to: "Approved", label: "officer approves (T06)" },
  { from: "On hold", to: "Returned", label: "officer returns (T08)" },
  { from: "Approved", to: "[*]", label: "" },
  { from: "Returned", to: "[*]", label: "" },
];

export function stateDiagram({ statuses = STATUSES, transitions = TRANSITIONS } = {}) {
  const id = (s) => (s === "[*]" ? s : stateId(s));
  const lines = ["stateDiagram-v2"];
  for (const s of statuses) if (id(s) !== s) lines.push(`  state "${s}" as ${id(s)}`);
  for (const t of transitions) lines.push(`  ${id(t.from)} --> ${id(t.to)}${t.label ? ` : ${t.label}` : ""}`);
  return lines.join("\n");
}

// ------------------------------------------------------------------ 4. deployment diagram
const FILE_OF = { studentAffairs: "student-affairs.js", finance: "finance.js", facilities: "facilities.js" };

export function deploymentDiagram({ catalog = loadCatalog(), ports = PORTS } = {}) {
  const lines = ["flowchart TB"];
  const add = (...text) => lines.push(...text);
  add('  subgraph student["Student computer"]', `    browser["Browser<br/>http://localhost:${ports.gateway}"]`, "  end");
  add('  subgraph server["Campus server: Node.js, node start-all.js"]');
  add(`    subgraph p${ports.gateway}["Process: gateway :${ports.gateway}"]`, '      gw["Gateway, planEvent, web page"]', '      queue["In-memory queue + notifier"]', "    end");
  for (const [name, file] of Object.entries(FILE_OF)) {
    add(`    subgraph p${ports[name]}["Process: ${file} :${ports[name]}"]`, `      ${slug(name)}["${file}"]`, "    end");
  }
  add("  end");
  add('  subgraph internet["Internet"]');
  for (const api of outsideApis(catalog)) add(`    ${apiId(api)}["${api}"]`);
  add("  end");
  add(`  browser -->|"HTTP :${ports.gateway}"| gw`);
  add("  gw --> queue");
  for (const name of Object.keys(FILE_OF)) add(`  gw -->|"HTTP :${ports[name]}"| ${slug(name)}`);
  for (const api of outsideApis(catalog)) add(`  gw -->|"HTTPS"| ${apiId(api)}`);
  return lines.join("\n");
}

export const buildDiagrams = (inputs = {}) => ({
  component: componentDiagram(inputs),
  sequence: sequenceDiagram(inputs),
  state: stateDiagram(inputs),
  deployment: deploymentDiagram(inputs),
});
