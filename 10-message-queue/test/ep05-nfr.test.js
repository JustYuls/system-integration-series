import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { CATEGORIES, categoriesCovered, checkAll, checkNfr, evaluate, loadNfr, meets, renderNfrDoc, requestsPerMinute } from "../src/nfr.js";

const nfrs = loadNfr();
const byId = (id) => nfrs.find((n) => n.id === id);
const problem = (mutate) => {
  const copy = structuredClone(byId("NFR-01"));
  mutate(copy);
  return checkNfr(copy);
};
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("the list of non-functional requirements", () => {
  test("there are eight, numbered NFR-01 to NFR-08", () => assert.deepEqual(nfrs.map((n) => n.id), ["NFR-01", "NFR-02", "NFR-03", "NFR-04", "NFR-05", "NFR-06", "NFR-07", "NFR-08"]));
  test("every requirement passes the quality rules", () => assert.deepEqual(checkAll(nfrs), []));
  test("each of the eight categories is covered exactly once", () => {
    assert.deepEqual(categoriesCovered(nfrs), { covered: CATEGORIES, missing: [] });
    assert.deepEqual(nfrs.map((n) => n.category), CATEGORIES);
  });
  test("[NFR-01] 95 percent of planning decisions come within 3000 ms", () => {
    const n = byId("NFR-01");
    assert.deepEqual(n.target, { value: 3000, unit: "ms", comparison: "<=" });
    assert.ok(n.statement.includes("95 percent"));
  });
  test("[NFR-02] an outside API that is down gives needs-review, not an error", () => {
    assert.ok(byId("NFR-02").statement.includes("needs-review"));
    assert.equal(byId("NFR-02").target.value, 100);
  });
  test("[NFR-03] an outside call is retried up to 3 times", () => assert.equal(byId("NFR-03").target.value, 3));
  test("[NFR-04] the source files hold no secrets or API keys", () => {
    const secret = /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/i;
    const files = ["src", "review", "."].flatMap((dir) => readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(root, dir, f)));
    assert.ok(files.length >= 6);
    for (const f of files) assert.ok(!secret.test(readFileSync(f, "utf8")), f);
    assert.equal(byId("NFR-04").target.value, 0);
  });
  test("[NFR-05] the reasons are for the organizer, in plain language", () => assert.ok(byId("NFR-05").statement.includes("plain language")));
  test("[NFR-06] the three conventions are named in the requirement", () => {
    for (const word of ["JSON", "HTTP", "ISO 8601", "ISO 4217"]) assert.ok(byId("NFR-06").statement.includes(word), word);
  });
  test("[NFR-07] every endpoint has a test: the goal is 100 percent", () => assert.deepEqual(byId("NFR-07").target, { value: 100, unit: "percent", comparison: ">=" }));
  test("[NFR-08] the planner handles 20 requests per minute", () => assert.equal(byId("NFR-08").target.value, 20));
  test("[NFR-08] the Foundation Day crowd: 2000 students, 1 percent ask, in one minute, is 20", () => {
    assert.equal(requestsPerMinute(2000, 0.01, 1), byId("NFR-08").target.value);
    assert.equal(requestsPerMinute(2000, 0.01, 2), 10);
  });
});

describe("the quality rules", () => {
  test("a vague word with no number is found", () => assert.deepEqual(problem((n) => (n.statement = "The planner shall be fast.")), ['uses the vague word "fast" with no number']));
  test("user-friendly, robust, scalable and secure are vague too", () => {
    for (const w of ["user-friendly", "robust", "scalable", "secure"]) assert.ok(problem((n) => (n.statement = `The planner shall be ${w}.`))[0].includes(w), w);
  });
  test("a vague word next to a number is allowed", () => assert.deepEqual(problem((n) => (n.statement = "The planner shall be fast: 95 percent of answers within 3000 ms.")), []));
  test("a category outside the list is found", () => assert.deepEqual(problem((n) => (n.category = "speed")), ['the category "speed" is not in the list']));
  test("a target needs a number, a unit and a comparison", () => {
    assert.deepEqual(problem((n) => (n.target = {})), ["the target needs a number", "the target needs a unit", 'the target needs a comparison: "<=", ">=" or "="']);
  });
  test("a missing metric or measure is found", () => assert.deepEqual(problem((n) => ((n.metric = ""), delete n.measure)), ["has no metric: what do we count?", "has no measure: how do we verify it?"]));
  test("the statement must say shall, and the id must have the right form", () => {
    assert.deepEqual(problem((n) => ((n.statement = "The planner answers in time: 3000 ms."), (n.id = "N1"))), ["the id must look like NFR-01", 'the statement must say "shall"']);
  });
  test("a repeated id is found", () => assert.deepEqual(checkAll([byId("NFR-01"), byId("NFR-01")]), [{ id: "NFR-01", problem: "the id is used twice" }]));
});

describe("comparing targets with measured values", () => {
  test("each comparison is understood", () => {
    assert.ok(meets({ value: 3000, comparison: "<=" }, 3000));
    assert.ok(!meets({ value: 3000, comparison: "<=" }, 3001));
    assert.ok(meets({ value: 20, comparison: ">=" }, 25));
    assert.ok(!meets({ value: 0, comparison: "=" }, 1));
  });
  test("[NFR-01] [NFR-08] a requirement with no measured value is not a pass", () => {
    const result = evaluate(nfrs, { "NFR-01": 1760, "NFR-08": 12 });
    assert.deepEqual(result.slice(0, 1).concat(result.slice(7)).map((r) => [r.id, r.status]), [["NFR-01", "pass"], ["NFR-08", "fail"]]);
    assert.equal(result.filter((r) => r.status === "not measured").length, 6);
  });
});

describe("the document", () => {
  const doc = renderNfrDoc(nfrs);
  test("it has a table row and a section for each requirement", () => {
    assert.equal((doc.match(/^\| NFR-\d\d /gm) ?? []).length, 8);
    assert.equal((doc.match(/^## NFR-\d\d /gm) ?? []).length, 8);
  });
  test("it shows the target with its unit", () => assert.ok(doc.includes("| NFR-01 | performance | <= 3000 ms |")));
});
