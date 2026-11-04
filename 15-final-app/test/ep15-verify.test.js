// verify.js and the tag scanner. Fixtures are built from pieces (tag(), aTest()), so that this file does not
// contain tagged test names that are not tests.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { coverageRows, countTests, scanTests, testsIn, unknownTags } from "../src/tags.js";
import { endpointCoverage, endpointKeys, isBehaviourFile, renderCoverage, verifyProject } from "../src/verify.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tag = (id) => `[${id}]`;
const aTest = (name, quote = '"') => `${"te"}st(${quote}${name}${quote}, () => {});\n`;

// A folder with the real docs and a fixture test folder. files: { "ep15-a.test.js": "source" }.
function fixtureFolder(files, { extraRequirement } = {}) {
  const folder = mkdtempSync(path.join(os.tmpdir(), "verify-"));
  cpSync(path.join(root, "docs"), path.join(folder, "docs"), { recursive: true });
  mkdirSync(path.join(folder, "test"));
  for (const [name, source] of Object.entries(files)) writeFileSync(path.join(folder, "test", name), source);
  if (extraRequirement) {
    const file = path.join(folder, "docs", "requirements.json");
    const data = JSON.parse(readFileSync(file, "utf8"));
    data.functional.push({ ...data.functional[0], id: extraRequirement });
    writeFileSync(file, JSON.stringify(data));
  }
  return { folder, remove: () => rmSync(folder, { recursive: true, force: true }) };
}

const allIds = () => verifyProject(root).rows.map((r) => r.id);

describe("the tag scanner", () => {
  test("[NFR-07] it reads the tags in test names written with double, single or backtick quotes", () => {
    const source = aTest(`${tag("FR-01")} double`) + aTest(`${tag("NFR-02")} single`, "'") + aTest(`${tag("FR-03")} ${tag("FR-04")} backtick`, "`");
    assert.deepEqual(testsIn(source).map((t) => t.tags), [["FR-01"], ["NFR-02"], ["FR-03", "FR-04"]]);
  });

  test("a test with no tag has an empty list, and text that is not a test name is ignored", () => {
    assert.deepEqual(testsIn(aTest("a plain test"))[0].tags, []);
    assert.deepEqual(testsIn(`const x = "${tag("FR-01")}"; // ${tag("FR-02")}\n`), []);
  });

  test("a tag written twice in one name counts once", () => {
    assert.deepEqual(testsIn(aTest(`${tag("FR-01")} and ${tag("FR-01")} again`))[0].tags, ["FR-01"]);
  });

  test("scanTests reads every .test.js file of a folder and gives the file name of each test", () => {
    const { folder, remove } = fixtureFolder({ "a.test.js": aTest(`${tag("FR-01")} one`), "b.test.js": aTest("two"), "helper.js": aTest(`${tag("FR-09")} not a test file`) });
    try {
      const tests = scanTests(path.join(folder, "test"));
      assert.deepEqual(tests.map((t) => [t.file, t.tags]), [["a.test.js", ["FR-01"]], ["b.test.js", []]]);
      assert.deepEqual(countTests(tests), { total: 2, tagged: 1 });
    } finally {
      remove();
    }
  });

  test("coverageRows counts the tests of each id, and the ones from the new files", () => {
    const tests = [{ file: "ep04-a.test.js", name: "x", tags: ["FR-01"] }, { file: "ep15-b.test.js", name: "y", tags: ["FR-01", "FR-02"] }];
    const rows = coverageRows(["FR-01", "FR-02", "FR-03"], tests, isBehaviourFile);
    assert.deepEqual(rows.map((r) => [r.id, r.total, r.newTests, r.earlier]), [["FR-01", 2, 1, 1], ["FR-02", 1, 1, 0], ["FR-03", 0, 0, 0]]);
  });

  test("a tag that names no requirement is found (a typo)", () => {
    const tests = [{ file: "x", name: "n", tags: ["FR-01", "FR-13", "NFR-09"] }];
    assert.deepEqual(unknownTags(tests, ["FR-01"]), ["FR-13", "NFR-09"]);
  });
});

describe("verify.js: the project is verified", () => {
  const result = verifyProject(root);

  test("[NFR-07] verify finds no problem in this folder: 20 requirements, every one with a tagged test", () => {
    assert.deepEqual(result.problems, []);
    assert.equal(result.rows.length, 20);
    assert.ok(result.rows.every((r) => r.total > 0));
  });

  test("every requirement has a BEHAVIOUR test of episode 15, not only quality tests of earlier episodes", () => {
    for (const r of result.rows) assert.ok(r.newTests >= 1, `${r.id} has no test in an ep15 file`);
  });

  test("[NFR-07] every operation of docs/openapi.json and docs/openapi-services.json is named in a test", () => {
    assert.equal(result.endpoints.length, endpointKeys(root).length);
    assert.ok(result.endpoints.length >= 20);
    assert.deepEqual(result.endpoints.filter((e) => !e.tested), []);
  });

  test("the trace links are complete (completeness of episode 7) and the promised tags are carried by tests", () => {
    assert.deepEqual(result.trace, []);
  });

  test("the endpoint check does not mix up GET /requests with GET /requests/{requestNo}", () => {
    const only = { "ep15-x.test.js": aTest("calls GET /requests/{requestNo} only") };
    const { folder, remove } = fixtureFolder(only);
    try {
      const found = endpointCoverage(folder, [{ doc: "d", key: "GET /requests" }, { doc: "d", key: "GET /requests/{requestNo}" }]);
      assert.deepEqual(found.map((e) => e.tested), [false, true]);
    } finally {
      remove();
    }
  });

  test("the coverage table has one row for each requirement and a summary", () => {
    const lines = renderCoverage(result);
    assert.match(lines[0], /^Requirement\s+tests\s+episode 15\s+earlier episodes/);
    assert.equal(lines.filter((l) => /^N?FR-\d\d/.test(l)).length, 20);
    assert.ok(lines.includes("Requirements with a tagged test: 20 of 20"));
  });
});

describe("verify.js: it fails when something is missing", () => {
  const everyTagExcept = (skip) => allIds().filter((id) => id !== skip).map((id) => aTest(`${tag(id)} a test`)).join("");

  test("a requirement with no tagged test is reported, with exit code 1", () => {
    const { folder, remove } = fixtureFolder({ "ep15-a.test.js": everyTagExcept("FR-05") });
    try {
      assert.ok(verifyProject(folder).problems.includes("FR-05 has no tagged test"));
      let status = 0;
      let out = "";
      try {
        execFileSync("node", ["verify.js", folder], { cwd: root, encoding: "utf8", stdio: "pipe" });
      } catch (error) {
        status = error.status;
        out = error.stdout;
      }
      assert.equal(status, 1);
      assert.match(out, /FR-05\s+0\s+0\s+0\s+MISSING/);
      assert.match(out, /NOT VERIFIED/);
    } finally {
      remove();
    }
  });

  test("a requirement with only earlier tests has no behaviour test: reported", () => {
    const { folder, remove } = fixtureFolder({ "ep15-a.test.js": everyTagExcept("FR-05"), "ep04-old.test.js": aTest(`${tag("FR-05")} a quality test`) });
    try {
      const problems = verifyProject(folder).problems;
      assert.ok(problems.some((p) => p.startsWith("FR-05 has no behaviour test")));
      assert.ok(!problems.includes("FR-05 has no tagged test"));
    } finally {
      remove();
    }
  });

  test("a new requirement in docs/requirements.json that nobody tests is reported", () => {
    const all = allIds().map((id) => aTest(`${tag(id)} a test`)).join("");
    const { folder, remove } = fixtureFolder({ "ep15-a.test.js": all }, { extraRequirement: "FR-13" });
    try {
      const problems = verifyProject(folder).problems;
      assert.ok(problems.includes("FR-13 has no tagged test"));
      assert.ok(problems.some((p) => p.startsWith("trace: FR-13")), "the trace links do not know FR-13 either");
    } finally {
      remove();
    }
  });

  test("a test tag that names no requirement is reported", () => {
    const all = allIds().map((id) => aTest(`${tag(id)} a test`)).join("") + aTest(`${tag("FR-77")} typo`);
    const { folder, remove } = fixtureFolder({ "ep15-a.test.js": all });
    try {
      assert.ok(verifyProject(folder).problems.includes("the tag [FR-77] names no requirement"));
    } finally {
      remove();
    }
  });

  test("[NFR-07] an operation that no test names is reported", () => {
    const all = allIds().map((id) => aTest(`${tag(id)} a test`)).join("");
    const { folder, remove } = fixtureFolder({ "ep15-a.test.js": all });
    try {
      const problems = verifyProject(folder).problems;
      assert.ok(problems.some((p) => p.startsWith("GET /health (planner API) is named in no test")));
    } finally {
      remove();
    }
  });
});

describe("the real command", () => {
  test("node verify.js ends with OK and exit code 0 in this folder", () => {
    const out = execFileSync("node", ["verify.js"], { cwd: root, encoding: "utf8" });
    assert.match(out, /Requirements with a tagged test: 20 of 20/);
    assert.match(out, /OK: every requirement has a tagged behaviour test/);
  });
});
