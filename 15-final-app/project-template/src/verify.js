// Does every requirement of YOUR project have a test? Reads docs/requirements.json, docs/nfr.json and docs/trace-links.json,
// scans the names of the tests in test/*.test.js for tags like [FR-01], and looks for a test of every endpoint of docs/openapi.json.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { countTests, coverageRows, scanTests, unknownTags } from "./tags.js";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "GET /health" and "POST /api/requests": the operations of the OpenAPI file.
export function endpointKeys(openapi) {
  return Object.entries(openapi.paths).flatMap(([p, item]) => Object.keys(item).filter((v) => ["get", "post", "put", "patch", "delete"].includes(v)).map((v) => `${v.toUpperCase()} ${p}`));
}

export function verifyProject(root) {
  const docs = path.join(root, "docs");
  const ids = [...readJson(path.join(docs, "requirements.json")).functional, ...readJson(path.join(docs, "nfr.json")).nonFunctional].map((r) => r.id);
  const links = readJson(path.join(docs, "trace-links.json"));
  const tests = scanTests(path.join(root, "test"));
  const rows = coverageRows(ids, tests);

  const testDir = path.join(root, "test");
  const sources = readdirSync(testDir).filter((f) => f.endsWith(".test.js")).map((f) => readFileSync(path.join(testDir, f), "utf8"));
  const endpoints = endpointKeys(readJson(path.join(docs, "openapi.json"))).map((key) => ({ key, tested: sources.some((s) => new RegExp(`${escape(key)}(?![\\w/{}-])`).test(s)) }));

  const problems = [];
  for (const r of rows) if (r.total === 0) problems.push(`${r.id} has no tagged test`);
  for (const id of ids) {
    const link = links.functional[id] ?? links.nonFunctional[id];
    if (!link) problems.push(`${id} has no entry in docs/trace-links.json`);
    else if (link.testTag !== id) problems.push(`${id} has the test tag "${link.testTag}", which is not its own id`);
  }
  for (const e of endpoints) if (!e.tested) problems.push(`${e.key} is named in no test`);
  for (const tag of unknownTags(tests, ids)) problems.push(`the tag [${tag}] names no requirement`);
  return { rows, endpoints, counts: countTests(tests), problems, ok: problems.length === 0 };
}
