import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadRequirements } from "../src/requirements.js";
import { checkOpenApi, coverageTable, loadOpenApi, operations } from "../src/openapi-check.js";
import { isErrorBody } from "../src/standards.js";

const doc = loadOpenApi();
const requirements = loadRequirements();
// the problems of a changed copy of the file
const broken = (mutate) => {
  const copy = structuredClone(doc);
  mutate(copy);
  return checkOpenApi(copy);
};
const has = (found, text) => found.some((f) => f.problem.includes(text));

describe("docs/openapi.json", () => {
  test("[NFR-07] the file is sound: no problems", () => assert.deepEqual(checkOpenApi(doc), []));
  test("it is OpenAPI 3.0.3 and has four operations", () => {
    assert.equal(doc.openapi, "3.0.3");
    assert.deepEqual(operations(doc).map((o) => `${o.verb.toUpperCase()} ${o.path}`),
      ["POST /api/requests", "GET /api/requests/{requestNo}", "GET /api/requests/{requestNo}/assessment", "GET /health"]);
  });
  test("a POST answers 201 and 400, a read by number answers 200 and 404", () => {
    const codes = (verb, path) => Object.keys(doc.paths[path][verb].responses);
    assert.deepEqual(codes("post", "/api/requests"), ["201", "400"]);
    assert.deepEqual(codes("get", "/api/requests/{requestNo}"), ["200", "404"]);
    assert.deepEqual(codes("get", "/api/requests/{requestNo}/assessment"), ["200", "404"]);
  });
  test("the decision is one of approved, returned, needs-review", () => {
    assert.deepEqual(doc.components.schemas.Assessment.properties.decision.enum, ["approved", "returned", "needs-review"]);
  });
  test("the Assessment has the four checks and the reasons", () => {
    const a = doc.components.schemas.Assessment;
    assert.deepEqual(Object.keys(a.properties.checks.properties), ["holiday", "venue", "weather", "budget"]);
    assert.ok(a.required.includes("reasons"));
  });
  test("[NFR-06] dates are format date and currencies are three capital letters", () => {
    assert.equal(doc.components.schemas.Request.properties.date.format, "date");
    assert.equal(doc.components.schemas.Money.properties.currency.pattern, "^[A-Z]{3}$");
  });
  test("[NFR-05] the Error schema is the one error format (error.code and error.message)", () => {
    const e = doc.components.schemas.Error;
    assert.deepEqual(e.properties.error.required, ["code", "message"]);
    assert.equal(isErrorBody({ error: { code: "NOT_FOUND", message: "No request EVT-0099" } }), true);
  });
  test("the example in the Error schema follows the error format", () => {
    const p = doc.components.schemas.Error.properties.error.properties;
    assert.ok(isErrorBody({ error: { code: p.code.example, message: p.message.example } }));
  });
});

describe("the link to the requirements", () => {
  test("every Must requirement is served by an operation or listed as internal", () => {
    const must = coverageTable(doc, requirements).filter((r) => r.priority === "Must");
    assert.equal(must.length, 10);
    assert.deepEqual(must.filter((r) => !r.served.length && !r.internal), []);
  });
  test("FR-11, the notice to the organizer, is internal: it goes through the queue", () => {
    assert.deepEqual(doc["x-internal-requirements"].map((x) => x.id), ["FR-11"]);
  });
  test("the assessment serves the four checks, FR-02 to FR-07, and the decision", () => {
    const fr = doc.paths["/api/requests/{requestNo}/assessment"].get["x-requirements"];
    for (const id of ["FR-02", "FR-03", "FR-04", "FR-05", "FR-06", "FR-07", "FR-08", "FR-10", "FR-12"]) assert.ok(fr.includes(id), id);
  });
  test("a requirement id that does not exist is reported", () => {
    const found = broken((d) => d.paths["/health"].get["x-requirements"] = ["FR-99"]);
    assert.ok(has(found, "FR-99 is not a requirement"));
  });
  test("a Must requirement that no operation serves is reported", () => {
    const found = broken((d) => d.paths["/api/requests"].post["x-requirements"] = ["FR-08"]);
    assert.ok(has(found, "FR-01 (Must) is in no operation"));
  });
  test("an operation with no requirement at all is reported", () => {
    const found = broken((d) => { d.paths["/health"].get["x-requirements"] = []; delete d.paths["/health"].get["x-nfr"]; });
    assert.ok(has(found, "satisfies no requirement"));
  });
  test("a requirement listed as internal and also used is reported", () => {
    const found = broken((d) => d["x-internal-requirements"].push({ id: "FR-01", reason: "x" }));
    assert.ok(has(found, "FR-01 is listed as internal but an operation uses it"));
  });
});

describe("the structure checks find mistakes", () => {
  test("a wrong version is reported", () => assert.ok(has(broken((d) => d.openapi = "2.0"), "must look like 3.0.3")));
  test("an operation with no summary is reported", () => assert.ok(has(broken((d) => delete d.paths["/health"].get.summary), "has no summary")));
  test("a POST that creates and answers 200 is reported", () => {
    const found = broken((d) => { const r = d.paths["/api/requests"].post.responses; r["200"] = r["201"]; delete r["201"]; });
    assert.ok(has(found, "a POST should answer 201"));
    assert.ok(has(found, "must answer 201, not 200"));
  });
  test("an error response that does not use the Error schema is reported", () => {
    const found = broken((d) => d.paths["/api/requests"].post.responses["400"].content["application/json"].schema = { type: "string" });
    assert.ok(has(found, "must use the Error schema"));
  });
  test("a response with no JSON schema is reported", () => {
    const found = broken((d) => delete d.paths["/health"].get.responses["200"].content);
    assert.ok(has(found, "has no JSON schema"));
  });
  test("a read by number with no 404 is reported", () => {
    const found = broken((d) => delete d.paths["/api/requests/{requestNo}"].get.responses["404"]);
    assert.ok(has(found, "needs a 404"));
  });
  test("a path parameter that is not declared is reported", () => {
    const found = broken((d) => d.paths["/api/requests/{requestNo}"].get.parameters = []);
    assert.ok(has(found, "{requestNo} is not declared"));
  });
  test("a reference to a missing schema is reported", () => {
    const found = broken((d) => d.paths["/health"].get.responses["200"].content["application/json"].schema.$ref = "#/components/schemas/Nope");
    assert.ok(has(found, "does not exist"));
  });
});
