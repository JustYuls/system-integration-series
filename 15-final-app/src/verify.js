// Traceability, closed: does EVERY requirement have a test? Scans the tags in test/*.test.js, checks
// docs/trace-links.json with completeness() of episode 7, and looks for a test of every endpoint (NFR-07).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { operations } from "./openapi-check.js";
import { countTests, coverageRows, scanTests, unknownTags } from "./tags.js";
import { completeness, loadServiceIds } from "./trace.js";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

// The tests added in episode 15 run the whole application (behaviour). The tests of earlier episodes
// are mostly unit tests, and some check the quality of a document, not the behaviour of the system.
export const isBehaviourFile = (file) => file.startsWith("ep15-");

// Every operation of the two OpenAPI files as { doc, key: "GET /health" }.
export function endpointKeys(root) {
  const docs = [["openapi.json", "planner API"], ["openapi-services.json", "service APIs"]];
  return docs.flatMap(([file, doc]) => {
    const full = path.join(root, "docs", file);
    if (!existsSync(full)) return [];
    return operations(readJson(full)).map(({ verb, path: p }) => ({ doc, key: `${verb.toUpperCase()} ${p}` }));
  });
}

// An endpoint has a test when a test file names it: "GET /requests/{requestNo}" must not match "GET /requests".
const names = (source, key) => new RegExp(`${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w/{}-])`).test(source);

export function endpointCoverage(root, endpoints = endpointKeys(root)) {
  const dir = path.join(root, "test");
  const sources = readdirSync(dir).filter((f) => f.endsWith(".test.js")).map((f) => readFileSync(path.join(dir, f), "utf8"));
  return endpoints.map((e) => ({ ...e, tested: sources.some((s) => names(s, e.key)) }));
}

// The whole check of one folder. `problems` is empty when the project is verified.
export function verifyProject(root) {
  const docs = path.join(root, "docs");
  const requirements = readJson(path.join(docs, "requirements.json")).functional;
  const nfrs = readJson(path.join(docs, "nfr.json")).nonFunctional;
  const links = readJson(path.join(docs, "trace-links.json"));
  const notes = readJson(path.join(docs, "process-notes.json"));
  const openapi = readJson(path.join(docs, "openapi.json"));
  const ids = [...requirements.map((r) => r.id), ...nfrs.map((n) => n.id)];

  const tests = scanTests(path.join(root, "test"));
  const rows = coverageRows(ids, tests, isBehaviourFile);
  const endpoints = endpointCoverage(root);
  const trace = completeness({ notes, requirements, nfrs, links, openapi, serviceIds: loadServiceIds(path.join(docs, "services.json")) });
  const stray = unknownTags(tests, ids);

  const problems = [];
  for (const r of rows) {
    if (r.total === 0) problems.push(`${r.id} has no tagged test`);
    else if (r.newTests === 0) problems.push(`${r.id} has no behaviour test of episode 15 (only ${r.earlier} earlier tests)`);
  }
  // The tag promised in trace-links.json must be the tag the tests carry.
  for (const [id, link] of [...Object.entries(links.functional), ...Object.entries(links.nonFunctional)]) {
    const row = rows.find((r) => r.id === link.testTag);
    if (!row) problems.push(`${id}: the promised test tag "${link.testTag}" is not a requirement id`);
    else if (row.total === 0) problems.push(`${id}: the promised test tag "${link.testTag}" is carried by no test`);
  }
  for (const e of endpoints) if (!e.tested) problems.push(`${e.key} (${e.doc}) is named in no test`);
  for (const t of trace) problems.push(`trace: ${t.where} ${t.problem}`);
  for (const tag of stray) problems.push(`the tag [${tag}] names no requirement`);

  return { rows, endpoints, trace, stray, counts: countTests(tests), problems, ok: problems.length === 0 };
}

const pad = (v, n) => String(v).padEnd(n);

// The coverage table as lines of text (what verify.js prints).
export function renderCoverage(result) {
  const lines = [`${pad("Requirement", 13)}${pad("tests", 7)}${pad("episode 15", 12)}earlier episodes`];
  for (const r of result.rows) lines.push(`${pad(r.id, 13)}${pad(r.total, 7)}${pad(r.newTests, 12)}${r.earlier}${r.total === 0 ? "   MISSING" : r.newTests === 0 ? "   NO BEHAVIOUR TEST" : ""}`);
  const tested = result.endpoints.filter((e) => e.tested).length;
  const covered = result.rows.filter((r) => r.total > 0).length;
  lines.push("", `Requirements with a tagged test: ${covered} of ${result.rows.length}`);
  lines.push(`Endpoints named in a test: ${tested} of ${result.endpoints.length}`);
  lines.push(`Trace links (completeness): ${result.trace.length === 0 ? "complete" : `${result.trace.length} problems`}`);
  lines.push(`Tests found: ${result.counts.total}, with a requirement tag: ${result.counts.tagged}`);
  return lines;
}
