import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { collect } from "../review/js-facts.js";

describe("the AI review of JavaScript", async () => {
  const f = await collect();
  test("finding 1: 0.1 + 0.2 is not 0.3, but rounding fixes it", () => assert.deepEqual([f.sumIsPointThree, f.cents], [false, 0.3]));
  test("finding 2: attendees as text is flagged", () => assert.ok(f.stringAttendeesFound));
  test("finding 3: an impossible date passes the pattern but is flagged", () => assert.deepEqual([f.impossibleDateLooksFine, f.impossibleDateFound], [true, true]));
  test("claim 4 is false: == and === differ", () => assert.deepEqual([f.looseEqual, f.strictEqual], [true, false]));
  test("claim 5 is true: a const object can change inside", () => assert.deepEqual([f.constObjectChanged, f.constReassignFails], [true, true]));
  test("claim 6 is false: fetch resolves on a 404", () => assert.deepEqual(f.fetch404, { rejected: false, status: 404, ok: false }));
});
