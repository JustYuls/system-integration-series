// verify.js of the template: it must be green for the template itself, and red when a tag or a test is missing.
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { testsIn } from "../src/tags.js";
import { endpointKeys, verifyProject } from "../src/verify.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// Fixtures are built from pieces, so that this file itself does not contain a tagged test name.
const tag = (id) => `[${id}]`;
const aTest = (name) => `${"te"}st(${JSON.stringify(name)}, () => {});\n`;

describe("verify.js", () => {
  test("the template is verified: every example requirement and every endpoint has a test", () => {
    const result = verifyProject(root);
    assert.deepEqual(result.problems, []);
    assert.equal(result.rows.length, 4);
    assert.equal(result.endpoints.length, 3);
  });

  test("a requirement with no tagged test is reported", () => {
    const folder = mkdtempSync(path.join(os.tmpdir(), "tpl-"));
    try {
      cpSync(path.join(root, "docs"), path.join(folder, "docs"), { recursive: true });
      mkdirSync(path.join(folder, "test"));
      writeFileSync(path.join(folder, "test", "nothing.test.js"), aTest("nothing is tagged here"));
      const problems = verifyProject(folder).problems;
      assert.ok(problems.some((p) => p.startsWith("FR-01")));
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  test("the scanner reads the tags in the names of tests, and endpoints come from the OpenAPI file", () => {
    assert.deepEqual(testsIn(aTest(`${tag("FR-01")} ${tag("NFR-02")} a name`))[0].tags, ["FR-01", "NFR-02"]);
    assert.deepEqual(testsIn(aTest("no tag"))[0].tags, []);
    assert.deepEqual(endpointKeys({ paths: { "/a": { get: {}, post: {} } } }), ["GET /a", "POST /a"]);
  });
});
