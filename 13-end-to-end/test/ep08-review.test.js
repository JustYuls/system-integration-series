import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { collect } from "../review/soa-facts.js";

describe("the AI review of the service contract draft", () => {
  const f = collect();
  test("the real catalog has no violations", () => assert.equal(f.realViolations, 0));
  test("the draft has four violations: two internal fields, one raw output, one session", () => assert.equal(f.draftViolations.length, 4));
  test("finding 1: the internal database fields are found", () => assert.ok(f.exposesInternals));
  test("finding 2: the raw Open-Meteo output is found", () => assert.ok(f.returnsRaw));
  test("finding 3: the session input is found", () => assert.ok(f.keepsSession));
  test("claim 4 is false: the deposit task needs two services", () => assert.deepEqual(f.tasksWithTwoServices, ["T05"]));
  test("claim 5 is false: seven services have seven data owners", () => assert.deepEqual([f.serviceCount, f.dataOwnerCount, f.sharedData], [7, 7, 0]));
  test("claim 6 is true: every service and send task has a service", () => {
    assert.deepEqual(f.tasksWithNoService, []);
    assert.deepEqual(Object.keys(f.servicesPerTask), ["T02", "T03", "T04", "T05", "T07"]);
  });
});
