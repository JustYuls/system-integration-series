// Traceability: link every task, rule, requirement, service, endpoint and test, and check that nothing is missing.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { operations } from "./openapi-check.js";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
export const loadLinks = (file = path.join(docs, "trace-links.json")) => JSON.parse(readFileSync(file, "utf8"));

// The service ids of docs/services.json (episode 8), or null when that file does not exist yet.
export function loadServiceIds(file = path.join(docs, "services.json")) {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")).services.map((s) => s.id);
}

export const VERIFICATIONS = ["test", "measurement", "review", "inspection"];
// The planner logic that joins the checks lives in the gateway, which is not one of the catalog services.
export const EXTRA_SERVICES = ["gateway"];

// Every task id of the process, and the decision gateways: each one needs a requirement.
export const taskIds = (notes) => [...Object.keys(notes.tasks), ...Object.keys(notes.decisions ?? {})];

// One row for each requirement and each rule it serves (a requirement without a rule gets one row with "none").
// A row: { task, rule, fr, priority, service, endpoint, internal, testTag }
export function buildMatrix({ requirements, links }) {
  const rows = [];
  for (const r of requirements) {
    const link = links.functional[r.id] ?? {};
    for (const rule of r.rules?.length ? r.rules : ["none"]) {
      rows.push({
        task: r.task, rule, fr: r.id, priority: r.priority,
        service: link.service ?? "(none)", endpoint: link.endpoint ?? "(none)", internal: link.internal === true, testTag: link.testTag ?? "(none)",
      });
    }
  }
  return rows;
}

// Every problem is { where, problem }. An empty list means the trace is complete.
export function completeness({ notes, requirements, nfrs, links, openapi, serviceIds = null }) {
  const found = [];
  const add = (where, problem) => found.push({ where, problem });
  const ops = new Map(operations(openapi).map((o) => [`${o.verb.toUpperCase()} ${o.path}`, o.op]));
  const internalIds = new Set((openapi["x-internal-requirements"] ?? []).map((x) => x.id));
  const known = serviceIds ? [...serviceIds, ...EXTRA_SERVICES] : null;

  for (const t of taskIds(notes)) {
    if (!requirements.some((r) => r.task === t)) add(t, "is a task or decision of the process that no requirement covers");
  }
  for (const rule of Object.keys(notes.rules)) {
    if (!requirements.some((r) => r.rules?.includes(rule))) add(rule, "is a business rule that no requirement serves");
  }
  for (const r of requirements) {
    const link = links.functional[r.id];
    if (!link) { add(r.id, "has no entry in trace-links.json"); continue; }
    if (!link.service) add(r.id, "names no service");
    else if (known && !known.includes(link.service)) add(r.id, `names the service "${link.service}", which is not in the service catalog`);
    if (!link.endpoint) add(r.id, "names no endpoint");
    else if (link.internal) {
      if (!internalIds.has(r.id)) add(r.id, "is marked internal, but the OpenAPI file does not list it under x-internal-requirements");
    } else if (!ops.has(link.endpoint)) add(r.id, `names the endpoint "${link.endpoint}", which is not in docs/openapi.json and not marked internal`);
    else if (!(ops.get(link.endpoint)["x-requirements"] ?? []).includes(r.id)) add(r.id, `is not listed in x-requirements of ${link.endpoint}`);
    if (!link.testTag) add(r.id, "has no test tag");
    else if (link.testTag !== r.id) add(r.id, `has the test tag "${link.testTag}", which is not its own id`);
  }
  for (const n of nfrs) {
    const link = links.nonFunctional[n.id];
    if (!link) { add(n.id, "has no entry in trace-links.json"); continue; }
    if (!VERIFICATIONS.includes(link.verification)) add(n.id, `has the verification "${link.verification}", which is not ${VERIFICATIONS.join(", ")}`);
    if (!link.evidence?.trim()) add(n.id, "says nothing about its evidence");
    if (!link.testTag) add(n.id, "has no test tag");
    else if (link.testTag !== n.id) add(n.id, `has the test tag "${link.testTag}", which is not its own id`);
  }
  // Orphans: a link for something that is not in the requirement lists.
  for (const id of Object.keys(links.functional)) if (!requirements.some((r) => r.id === id)) add(id, "is in trace-links.json, but is not a functional requirement");
  for (const id of Object.keys(links.nonFunctional)) if (!nfrs.some((n) => n.id === id)) add(id, "is in trace-links.json, but is not a non-functional requirement");
  return found;
}

// What fraction of the requirements has a complete trace? { total, linked }
export function counts({ requirements, nfrs, problems }) {
  const bad = new Set(problems.map((p) => p.where));
  const ids = [...requirements.map((r) => r.id), ...nfrs.map((n) => n.id)];
  return { total: ids.length, linked: ids.filter((id) => !bad.has(id)).length };
}

const where = (row) => (row.internal ? `internal: ${row.endpoint}` : row.endpoint);

// The matrix as a markdown table, and the table of the non-functional requirements below it.
export function renderTraceability({ matrix, nfrs, links }) {
  const lines = [
    "# Traceability matrix", "",
    "Every row follows one requirement from the business process to the proof: task, business rule, requirement, service, endpoint, test tag.", "",
    "## Functional requirements", "",
    "| Task | Rule | FR | Priority | Service | Endpoint | Test tag |", "|---|---|---|---|---|---|---|",
    ...matrix.map((r) => `| ${r.task} | ${r.rule} | ${r.fr} | ${r.priority} | ${r.service} | \`${where(r)}\` | ${r.testTag} |`),
    "", "## Non-functional requirements", "",
    "| NFR | Category | Verified by | Evidence | Test tag |", "|---|---|---|---|---|",
    ...nfrs.map((n) => {
      const l = links.nonFunctional[n.id] ?? {};
      return `| ${n.id} | ${n.category} | ${l.verification ?? "(none)"} | ${l.evidence ?? "(none)"} | ${l.testTag ?? "(none)"} |`;
    }),
  ];
  return lines.join("\n") + "\n";
}

// What changes when a requirement changes? Everything on its row.
export const impactOf = (matrix, frId) => matrix.filter((r) => r.fr === frId);
