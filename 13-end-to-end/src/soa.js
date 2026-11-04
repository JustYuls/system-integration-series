// SOA: find the services in the BPMN process and check their contracts against the SOA principles.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTask } from "./bpmn.js";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
export const loadCatalog = () => JSON.parse(readFileSync(path.join(docs, "services.json"), "utf8"));

// The principles, with a one-line definition each.
export const principles = [
  { id: "loose-coupling", name: "Loose coupling", definition: "Callers know the contract, not the internals: no database fields in the interface." },
  { id: "abstraction", name: "Abstraction", definition: "A service hides how it works and returns a normalized result, not the raw answer of another system." },
  { id: "reusability", name: "Reusability", definition: "An operation does one general job, so many processes can use it." },
  { id: "statelessness", name: "Statelessness", definition: "Each call carries everything the service needs; it keeps no session between calls." },
  { id: "discoverability", name: "Discoverability", definition: "The contract says what the service is: name, description, version, owner, and every operation in full." },
  { id: "composability", name: "Composability", definition: "Services speak one standard protocol, so they can be combined into bigger processes." },
  { id: "autonomy", name: "Autonomy", definition: "A service owns its own logic and data." },
];

// 1. Which services does the process need? One candidate for each system named in the notes.
// A task that uses an outside API on top of an internal system also needs a wrapper for that API.
export function deriveServices(model, notes) {
  const found = new Map();
  const add = (system, taskId, externalApi) => {
    const entry = found.get(system) ?? { system, taskIds: [], externalApi: externalApi ?? null };
    entry.taskIds.push(taskId);
    found.set(system, entry);
  };
  for (const [id, node] of Object.entries(model.nodes)) {
    const n = notes.tasks[id];
    if (!isTask(node) || !n) continue;
    if (/web page/i.test(n.system)) continue; // a screen is a client of services, not a service
    const wrapsItself = /service$/i.test(n.system); // "Weather service" is already the wrapper
    add(n.system, id, wrapsItself ? n.externalApi : null);
    if (n.externalApi && !wrapsItself) add(n.externalApi, id, n.externalApi);
  }
  for (const e of found.values()) e.taskIds.sort();
  return [...found.values()];
}

// The services of the catalog that carry out a task (a task may need more than one).
export const serviceForTask = (catalog, taskId) => catalog.services.filter((s) => s.tasks.includes(taskId));

// Does the catalog match what the process needs? Every problem is a sentence.
export function catalogProblems(model, notes, catalog) {
  const problems = [];
  for (const d of deriveServices(model, notes)) {
    const s = catalog.services.find((x) => x.system === d.system);
    if (!s) problems.push(`${d.system} (${d.taskIds.join(", ")}) has no service in the catalog`);
    else if (s.tasks.join() !== d.taskIds.join()) problems.push(`${s.id} lists the tasks ${s.tasks.join(", ")} but the process uses it in ${d.taskIds.join(", ")}`);
  }
  for (const s of catalog.services) for (const t of s.tasks) if (!model.nodes[t]) problems.push(`${s.id} serves ${t}, which is not in the process`);
  return problems;
}

// Services that share the same owner of the data break autonomy.
export function sharedData(catalog) {
  const by = {};
  for (const s of catalog.services) (by[s.dataOwner] ??= []).push(s.id);
  return Object.entries(by).filter(([, ids]) => ids.length > 1).map(([owner, ids]) => ({ owner, ids }));
}

// 2. The contract check. Every violation is { principle, operation, message }; an empty list means the contract is good.
const INTERNAL = /_|^(db|tbl|row|pk|fk)[A-Z]/; // snake_case or a table-style name = a database field
const UPSTREAM = /^(raw|rawResponse|response|payload|daily|rates|hourly)$/i; // names that belong to another system's answer
const SESSION = /^(session|sessionId|state|cookie|token|conversationId|cart)/i;
const PROCESS_WORDS = /(event|process|approve|task|step|workflow|^T\d\d)/i;

export function checkContract(service) {
  const found = [];
  const add = (principle, operation, message) => found.push({ principle, operation, message });
  for (const key of ["name", "description", "version", "owner"]) if (!service[key]) add("discoverability", null, `the service has no ${key}`);
  if (!service.dataOwner) add("autonomy", null, "the service names no owner of its data");
  if (service.protocol !== "REST/JSON") add("composability", null, `the protocol is "${service.protocol}", not the shared REST/JSON`);
  if (!service.operations?.length) add("discoverability", null, "the service has no operations");
  for (const op of service.operations ?? []) {
    for (const part of ["input", "output", "errors"]) if (!op[part]?.length) add("discoverability", op.name, `has no ${part} in the contract`);
    for (const field of op.output ?? []) {
      if (INTERNAL.test(field)) add("loose-coupling", op.name, `exposes the internal field "${field}"`);
      if (UPSTREAM.test(field)) add("abstraction", op.name, `returns "${field}", the raw answer of another system`);
    }
    for (const field of op.input ?? []) if (SESSION.test(field)) add("statelessness", op.name, `needs "${field}", which means the service keeps state between calls`);
    if (PROCESS_WORDS.test(op.name)) add("reusability", op.name, "the name ties the operation to one process");
  }
  return found;
}

export const checkCatalog = (catalog) => catalog.services.flatMap((s) => checkContract(s).map((v) => ({ service: s.id, ...v })));
