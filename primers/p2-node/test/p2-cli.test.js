// The command-line tool is tested the way a person uses it: start node, read what it prints, check the exit code.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { parseArgs } from "../src/args.js";

const cli = path.join(import.meta.dirname, "..", "venues-cli.js");
const run = (args, env = {}) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", env: { ...process.env, ...env } });

describe("parseArgs", () => {
  test("reads the capacity and the outdoor flag", () => {
    assert.deepEqual(parseArgs(["--capacity", "100", "--outdoor"]), { capacity: 100, outdoor: true });
  });
  test("outdoor is false when the flag is absent", () => assert.equal(parseArgs(["--capacity", "5"]).outdoor, false));
  test("a missing capacity is an error", () => assert.throws(() => parseArgs([]), /missing --capacity/));
  test("a capacity that is not a number is an error", () => assert.throws(() => parseArgs(["--capacity", "abc"]), /not a valid capacity/));
  test("an unknown argument is an error", () => assert.throws(() => parseArgs(["--size", "3"]), /unknown argument "--size"/));
});

describe("venues-cli.js", () => {
  let dir;
  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2-cli-"));
    fs.writeFileSync(path.join(dir, "mini.csv"), "id,name,capacity,outdoor,penaltyPhp\nhall,Hall,30,false,5\n");
  });
  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  test("lists the venues and exits with 0", () => {
    const r = run(["--capacity", "100"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Gym/);
    assert.match(r.stdout, /Field/);
    assert.doesNotMatch(r.stdout, /Lab A/);
  });
  test("--outdoor lists only the Field", () => {
    const r = run(["--capacity", "100", "--outdoor"]);
    assert.match(r.stdout, /Field/);
    assert.doesNotMatch(r.stdout, /Gym/);
  });
  test("a missing argument prints a clear message and exits with 1", () => {
    const r = run([]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Error: missing --capacity/);
    assert.match(r.stderr, /Usage: node venues-cli.js/);
  });
  test("a bad capacity exits with 1", () => assert.equal(run(["--capacity", "-5"]).status, 1));
  test("VENUE_FILE replaces the default file", () => {
    const r = run(["--capacity", "20"], { VENUE_FILE: path.join(dir, "mini.csv") });
    assert.match(r.stdout, /Hall/);
    assert.doesNotMatch(r.stdout, /Gym/);
  });
  test("a VENUE_FILE that does not exist exits with 1", () => {
    const r = run(["--capacity", "20"], { VENUE_FILE: path.join(dir, "none.csv") });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /cannot read the venue file/);
  });
});
