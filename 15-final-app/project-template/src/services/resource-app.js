// A tiny generic REST service: one resource, a list of typed fields, some seed records. Replace it when your
// service needs more than create, read and update; keep it while a placeholder is enough.
//
//   GET   /{resource}        the list          POST  /{resource}      create: 201 + Location, or 400 with the problems
//   GET   /{resource}/:id    one, or 404       PATCH /{resource}/:id  change fields: 200, 400, or 404
//   GET   /health            { status: "ok", service }
//
// fields: { name: "text", stock: "integer", active: "boolean" }.  Types: text, email, number, integer, boolean, date.
import { checkFields, createJsonApp, finishApp, hasProblems, sendError, sendValidation } from "../http.js";

const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
export const TYPES = {
  text: (v) => typeof v === "string" && v.trim().length > 0,
  email: (v) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  number: isNumber,
  integer: (v) => Number.isInteger(v) && v >= 0,
  boolean: (v) => typeof v === "boolean",
  date: (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)),
};

export function createResourceApp({ name, resource, fields, seed = [] }) {
  for (const [field, type] of Object.entries(fields)) if (!TYPES[type]) throw new Error(`${name}: the field ${field} has the unknown type "${type}"`);
  const rules = Object.fromEntries(Object.entries(fields).map(([field, type]) => [field, TYPES[type]]));
  const records = structuredClone(seed);
  const find = (id) => records.find((r) => String(r.id) === id);
  const nextId = () => String(Math.max(0, ...records.map((r) => Number(r.id) || 0)) + 1);
  const app = createJsonApp(name);

  app.get(`/${resource}`, (req, res) => res.json(records));

  app.get(`/${resource}/:id`, (req, res) => {
    const found = find(req.params.id);
    if (!found) return sendError(res, 404, "NOT_FOUND", `No ${resource} record ${req.params.id}`);
    res.json(found);
  });

  app.post(`/${resource}`, (req, res) => {
    const body = req.body ?? {};
    const problems = checkFields(body, rules); // { missing, invalid }
    if (hasProblems(problems)) return sendValidation(res, problems);
    const created = { id: nextId(), ...Object.fromEntries(Object.keys(fields).map((f) => [f, body[f]])) };
    records.push(created);
    res.status(201).location(`/${resource}/${created.id}`).json(created);
  });

  app.patch(`/${resource}/:id`, (req, res) => {
    const found = find(req.params.id);
    if (!found) return sendError(res, 404, "NOT_FOUND", `No ${resource} record ${req.params.id}`);
    const body = req.body ?? {};
    const unknown = Object.keys(body).filter((f) => !(f in fields));
    const invalid = Object.keys(body).filter((f) => f in fields && !rules[f](body[f]));
    if (unknown.length + invalid.length > 0) return sendValidation(res, { missing: [], invalid: [...unknown, ...invalid] });
    Object.assign(found, body);
    res.json(found);
  });

  return finishApp(app);
}
