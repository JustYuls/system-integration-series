// node:test in one file: describe groups tests, before/after prepare and clean up, test is one check.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { convert, parseCsv, readCsv } from "../src/csv.js";

describe("convert", () => {
  test("a number in text becomes a number", () => assert.equal(convert("400"), 400));
  test("true and false become booleans", () => {
    assert.equal(convert("true"), true);
    assert.equal(convert("false"), false);
  });
  test("other text stays text, without spaces around it", () => assert.equal(convert(" Room 101 "), "Room 101"));
  test("an empty cell stays an empty text, not 0", () => assert.equal(convert(""), ""));
});

describe("parseCsv", () => {
  test("the first line gives the names of the fields", () => {
    assert.deepEqual(parseCsv("id,capacity\ngym,400\n"), [{ id: "gym", capacity: 400 }]);
  });
  test("an empty text gives an empty array", () => assert.deepEqual(parseCsv(""), []));
  test("Windows line endings and blank lines are fine", () => {
    assert.equal(parseCsv("a,b\r\n1,2\r\n\r\n3,4\r\n").length, 2);
  });
  test("a row with a missing cell names the line", () => {
    assert.throws(() => parseCsv("a,b\n1,2\n3\n"), /line 3: expected 2 columns, found 1/);
  });
});

describe("readCsv (a temporary file)", () => {
  let dir;
  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2-csv-"));
    fs.writeFileSync(path.join(dir, "rooms.csv"), "id,seats,outdoor\nlab,40,false\nfield,900,true\n");
  });
  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  test("reads and converts the file", () => {
    const rows = readCsv(path.join(dir, "rooms.csv"));
    assert.deepEqual(rows[1], { id: "field", seats: 900, outdoor: true });
  });
  test("a missing file throws ENOENT", () => {
    assert.throws(() => readCsv(path.join(dir, "none.csv")), { code: "ENOENT" });
  });
});
