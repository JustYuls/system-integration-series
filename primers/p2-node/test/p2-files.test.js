import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { readReport, writeReport } from "../src/files.js";

describe("writeReport", () => {
  let dir;
  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2-files-"));
  });
  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  test("creates the folder and the file, and returns the path", async () => {
    const file = await writeReport(path.join(dir, "deep", "out"), "report", { people: 100 });
    assert.equal(file, path.join(dir, "deep", "out", "report.json"));
    assert.ok(fs.existsSync(file));
  });
  test("what is written can be read back", async () => {
    const data = { people: 100, venues: ["gym", "atrium"] };
    const file = await writeReport(dir, "again.json", data);
    assert.deepEqual(await readReport(file), data);
  });
  test("the JSON is indented and ends with a new line", async () => {
    const text = fs.readFileSync(await writeReport(dir, "pretty", { a: 1 }), "utf8");
    assert.equal(text, '{\n  "a": 1\n}\n');
  });
});
