import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { collect } from "../review/node-facts.js";

describe("the AI review of the Node.js answer", () => {
  let f;
  before(async () => {
    f = await collect();
  });

  test("finding 1: CSV text compares letter by letter, so numbers must be converted", () => {
    assert.equal(f.textCompare, true);
    assert.equal(f.capacityIsNumber, true);
  });
  test("finding 2: an import without the file extension fails", () => assert.equal(f.noExtensionFails, true));
  test("finding 3: the text false is truthy, so outdoor must be converted", () => {
    assert.equal(f.falseTextIsTruthy, true);
    assert.equal(f.outdoorIsBoolean, true);
  });
  test("claim 4 is false: require is not defined in an ES module", () => {
    assert.equal(f.requireWorks, false);
    assert.equal(f.requireMessage, true);
  });
  test("claim 5 is true: a timer waits for readFileSync but not for the async read", () => {
    assert.deepEqual(f.syncOrder, ["read done", "timer"]);
    assert.deepEqual(f.asyncOrder, ["timer", "read done"]);
  });
  test("process.argv[2] is the first user argument", () => {
    assert.equal(f.firstArgument, "first");
    assert.equal(f.argvLength, 4);
  });
  test("claim 6 is false: an environment variable is always a string", () => assert.equal(f.envType, "string"));
});
