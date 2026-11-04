// Structure checks for docs/openapi.json, and the link from every operation to the requirements.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRequirements } from "./requirements.js";
import { loadNfr } from "./nfr.js";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
export const loadOpenApi = (file = path.join(docs, "openapi.json")) => JSON.parse(readFileSync(file, "utf8"));

export const VERBS = ["get", "post", "put", "patch", "delete"];

// Every operation as { verb, path, op }.
export function operations(doc) {
  const list = [];
  for (const [p, item] of Object.entries(doc.paths ?? {})) {
    for (const verb of VERBS) if (item[verb]) list.push({ verb, path: p, op: item[verb] });
  }
  return list;
}

// Follow a "#/components/..." reference. Returns undefined when it does not exist.
const resolve = (doc, ref) => ref.replace(/^#\//, "").split("/").reduce((o, k) => o?.[k], doc);

const jsonSchema = (response) => response?.content?.["application/json"]?.schema;
const isErrorSchema = (schema) => schema?.$ref === "#/components/schemas/Error";

// The status codes that make sense for a verb: a POST that creates answers 201, a GET answers 200.
const SUCCESS = { get: "200", post: "201", put: "200", patch: "200", delete: "204" };

// Problems are { where, problem }. An empty list means the file is sound.
export function checkOpenApi(doc, { requirements = loadRequirements(), nfrs = loadNfr() } = {}) {
  const found = [];
  const add = (where, problem) => found.push({ where, problem });
  if (!/^3\.0\.\d+$/.test(doc.openapi ?? "")) add("openapi", `the version "${doc.openapi}" must look like 3.0.3`);
  if (!doc.info?.title || !doc.info?.version) add("info", "needs a title and a version");
  if (!Object.keys(doc.paths ?? {}).length) add("paths", "there are no paths");

  const frIds = new Set(requirements.map((r) => r.id));
  const nfrIds = new Set(nfrs.map((n) => n.id));
  const referenced = new Set();

  for (const { verb, path: p, op } of operations(doc)) {
    const where = `${verb.toUpperCase()} ${p}`;
    if (!op.summary) add(where, "has no summary");
    for (const name of p.match(/\{(\w+)\}/g) ?? []) {
      const declared = (op.parameters ?? []).map((x) => (x.$ref ? resolve(doc, x.$ref) : x)).some((x) => x?.in === "path" && `{${x.name}}` === name);
      if (!declared) add(where, `the path parameter ${name} is not declared`);
    }
    const codes = Object.keys(op.responses ?? {});
    if (!codes.length) add(where, "has no responses");
    if (codes.length && !codes.includes(SUCCESS[verb])) add(where, `a ${verb.toUpperCase()} should answer ${SUCCESS[verb]}`);
    if (verb === "post" && codes.includes("200")) add(where, "a POST that creates must answer 201, not 200");
    for (const code of codes) {
      const response = op.responses[code];
      const schema = jsonSchema(response);
      if (!schema) add(`${where} ${code}`, "has no JSON schema");
      else if (schema.$ref && !resolve(doc, schema.$ref)) add(`${where} ${code}`, `the schema ${schema.$ref} does not exist`);
      if (/^[45]/.test(code) && !isErrorSchema(schema)) add(`${where} ${code}`, "an error must use the Error schema");
    }
    if (verb === "get" && p.includes("{") && !codes.includes("404")) add(where, "a read by number needs a 404");
    if (verb === "post" && !codes.includes("400")) add(where, "a POST needs a 400 for bad input");

    const fr = op["x-requirements"];
    if (!Array.isArray(fr)) add(where, "has no x-requirements list");
    for (const id of fr ?? []) {
      if (!frIds.has(id)) add(where, `${id} is not a requirement in docs/requirements.json`);
      referenced.add(id);
    }
    for (const id of op["x-nfr"] ?? []) if (!nfrIds.has(id)) add(where, `${id} is not in docs/nfr.json`);
    if (Array.isArray(fr) && !fr.length && !(op["x-nfr"] ?? []).length) add(where, "satisfies no requirement: list an FR or an NFR");
  }

  const internal = new Map((doc["x-internal-requirements"] ?? []).map((x) => [x.id, x.reason]));
  for (const [id, reason] of internal) {
    if (!frIds.has(id)) add("x-internal-requirements", `${id} is not a requirement in docs/requirements.json`);
    if (!reason) add("x-internal-requirements", `${id} needs a reason`);
    if (referenced.has(id)) add("x-internal-requirements", `${id} is listed as internal but an operation uses it`);
  }
  for (const r of requirements) {
    if (r.priority === "Must" && !referenced.has(r.id) && !internal.has(r.id)) add("coverage", `${r.id} (Must) is in no operation and not listed as internal`);
  }
  return found;
}

// For a table: which operation serves each requirement.
export function coverageTable(doc, requirements = loadRequirements()) {
  const internal = new Set((doc["x-internal-requirements"] ?? []).map((x) => x.id));
  return requirements.map((r) => ({
    id: r.id, priority: r.priority,
    served: operations(doc).filter((o) => (o.op["x-requirements"] ?? []).includes(r.id)).map((o) => `${o.verb.toUpperCase()} ${o.path}`),
    internal: internal.has(r.id),
  }));
}
