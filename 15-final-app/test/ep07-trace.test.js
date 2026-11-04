import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadNotes } from "../src/document.js";
import { loadRequirements } from "../src/requirements.js";
import { loadNfr } from "../src/nfr.js";
import { loadOpenApi } from "../src/openapi-check.js";
import { VERIFICATIONS, buildMatrix, completeness, counts, impactOf, loadLinks, loadServiceIds, renderTraceability, taskIds } from "../src/trace.js";

const notes = loadNotes();
const requirements = loadRequirements();
const nfrs = loadNfr();
const openapi = loadOpenApi();
const links = loadLinks();
const serviceIds = loadServiceIds();
const input = { notes, requirements, nfrs, links, openapi, serviceIds };
// A copy of the links with one change, and the problems the check finds.
const problemsWith = (change) => {
  const copy = structuredClone(links);
  change(copy);
  return completeness({ ...input, links: copy }).map((p) => `${p.where} ${p.problem}`);
};

describe("the trace links", () => {
  test("every functional requirement and every NFR has a link, and nothing else does", () => {
    assert.deepEqual(Object.keys(links.functional), requirements.map((r) => r.id));
    assert.deepEqual(Object.keys(links.nonFunctional), nfrs.map((n) => n.id));
  });
  test("the real links are complete: no problems", () => assert.deepEqual(completeness(input), []));
  test("the tasks to cover are the 8 tasks and the decision G3", () => assert.deepEqual(taskIds(notes), ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "G3"]));
  test("only FR-11 is internal: the notice goes through the queue", () => {
    const internal = Object.entries(links.functional).filter(([, l]) => l.internal).map(([id]) => id);
    assert.deepEqual(internal, ["FR-11"]);
  });
  test("every NFR is verified in one of four ways, and each way is used", () => {
    const used = new Set(Object.values(links.nonFunctional).map((l) => l.verification));
    assert.deepEqual([...used].sort(), [...VERIFICATIONS].sort());
  });
  test("the service ids are checked against the catalog only when the catalog exists", () => {
    const withoutCatalog = completeness({ ...input, serviceIds: null });
    assert.deepEqual(withoutCatalog, []);
    const problems = problemsWith((l) => { l.functional["FR-02"].service = "holyday-service"; });
    if (serviceIds) assert.ok(problems.some((p) => p.startsWith("FR-02 names the service")));
    else assert.deepEqual(problems, []);
  });
});

describe("completeness finds what is missing", () => {
  test("a requirement with no link is reported", () => {
    assert.deepEqual(problemsWith((l) => { delete l.functional["FR-04"]; }), ["FR-04 has no entry in trace-links.json"]);
  });
  test("an endpoint that is not in the OpenAPI file is reported", () => {
    const p = problemsWith((l) => { l.functional["FR-09"].endpoint = "GET /api/requests"; });
    assert.equal(p.length, 1);
    assert.match(p[0], /^FR-09 names the endpoint "GET \/api\/requests"/);
  });
  test("an endpoint that does not list the requirement is reported", () => {
    const p = problemsWith((l) => { l.functional["FR-09"].endpoint = "POST /api/requests"; });
    assert.deepEqual(p, ["FR-09 is not listed in x-requirements of POST /api/requests"]);
  });
  test("an internal link that the OpenAPI file does not declare is reported", () => {
    const p = problemsWith((l) => { l.functional["FR-02"].internal = true; });
    assert.match(p[0], /^FR-02 is marked internal/);
  });
  test("a wrong or missing test tag is reported", () => {
    assert.deepEqual(problemsWith((l) => { l.functional["FR-03"].testTag = "FR-30"; }), ['FR-03 has the test tag "FR-30", which is not its own id']);
    assert.deepEqual(problemsWith((l) => { delete l.nonFunctional["NFR-02"].testTag; }), ["NFR-02 has no test tag"]);
  });
  test("an NFR with an unknown verification or no evidence is reported", () => {
    assert.match(problemsWith((l) => { l.nonFunctional["NFR-05"].verification = "hope"; })[0], /^NFR-05 has the verification "hope"/);
    assert.deepEqual(problemsWith((l) => { l.nonFunctional["NFR-05"].evidence = " "; }), ["NFR-05 says nothing about its evidence"]);
  });
  test("an orphan link is reported", () => {
    assert.deepEqual(problemsWith((l) => { l.functional["FR-13"] = { service: "gateway", endpoint: "POST /api/requests", testTag: "FR-13" }; }), ["FR-13 is in trace-links.json, but is not a functional requirement"]);
    assert.deepEqual(problemsWith((l) => { l.nonFunctional["NFR-09"] = { verification: "test", evidence: "x", testTag: "NFR-09" }; }), ["NFR-09 is in trace-links.json, but is not a non-functional requirement"]);
  });
  test("a task or a business rule that no requirement serves is reported", () => {
    const fewer = requirements.filter((r) => r.id !== "FR-10");
    const p = completeness({ ...input, requirements: fewer }).map((x) => `${x.where} ${x.problem}`);
    assert.ok(p.includes("T08 is a task or decision of the process that no requirement covers"));
    const noRule = requirements.map((r) => ({ ...r, rules: r.rules.filter((x) => x !== "BR-04") }));
    assert.ok(completeness({ ...input, requirements: noRule }).some((x) => x.where === "BR-04"));
  });
});

describe("the matrix", () => {
  const matrix = buildMatrix({ requirements, links });
  test("there is one row per requirement and rule, in the order of the requirements", () => {
    assert.equal(matrix.length, 12);
    assert.deepEqual(matrix.map((r) => r.fr), requirements.map((r) => r.id));
  });
  test("a row follows the chain from the task to the test tag", () => {
    assert.deepEqual(matrix[3], {
      task: "T03", rule: "BR-04", fr: "FR-04", priority: "Must", service: "facilities-service",
      endpoint: "GET /api/requests/{requestNo}/assessment", internal: false, testTag: "FR-04",
    });
  });
  test("a requirement without a rule gets the rule none", () => assert.equal(matrix.find((r) => r.fr === "FR-11").rule, "none"));
  test("the impact of a change: FR-04 touches the facilities service and the assessment endpoint", () => {
    const rows = impactOf(matrix, "FR-04");
    assert.deepEqual(rows.map((r) => [r.service, r.endpoint]), [["facilities-service", "GET /api/requests/{requestNo}/assessment"]]);
  });
  test("a missing link shows as (none) in the row", () => {
    const rows = buildMatrix({ requirements, links: { functional: {}, nonFunctional: {} } });
    assert.equal(rows[0].service, "(none)");
  });
  test("counts: 20 of 20 are fully linked, and a problem lowers the number", () => {
    assert.deepEqual(counts({ requirements, nfrs, problems: [] }), { total: 20, linked: 20 });
    assert.deepEqual(counts({ requirements, nfrs, problems: [{ where: "FR-04", problem: "x" }] }), { total: 20, linked: 19 });
  });
  test("the markdown table has a header, 12 functional rows and 8 NFR rows", () => {
    const text = renderTraceability({ matrix, nfrs, links });
    assert.match(text, /^# Traceability matrix/);
    assert.equal(text.split("\n").filter((l) => /^\| (T0\d|G3) /.test(l)).length, 12);
    assert.equal(text.split("\n").filter((l) => /^\| NFR-0\d /.test(l)).length, 8);
    assert.match(text, /\| T07 \| none \| FR-11 \| Must \| notification-service \| `internal: sendNotice` \| FR-11 \|/);
  });
});

describe("the gap demo", () => {
  test("it breaks three links and the check reports three problems", () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const out = execFileSync("node", ["gap-demo.js"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/);
    assert.equal(out[0], "3 problems found:");
    assert.equal(out.length, 4);
  });
});
