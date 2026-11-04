import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, test } from "node:test";
import { collect } from "../review/gateway-facts.js";

describe("the AI review of the gateway answer", async () => {
  const f = await collect();

  test("finding 1: a request id is made, sent to the service and returned; the caller's id is kept", () => {
    assert.match(f.generatedId, /^[0-9a-f-]{36}$/);
    assert.equal(f.upstreamGotGeneratedId, true);
    assert.equal(f.echoedId, "demo-123");
    assert.equal(f.upstreamGotCallerId, true);
  });

  test("finding 2: a down service gives 502 BAD_GATEWAY, fast", () => {
    assert.equal(f.downStatus, 502);
    assert.equal(f.downCode, "BAD_GATEWAY");
    assert.ok(f.downMs < f.timeoutMs);
  });

  test("finding 3: a slow service gives 504 after the timeout, not after the slow answer", () => {
    assert.equal(f.lateStatus, 504);
    assert.equal(f.lateCode, "GATEWAY_TIMEOUT");
    assert.ok(f.lateMs >= f.timeoutMs && f.lateMs < f.slowMs);
  });

  test("claim 4 is false: the service still answers 400, with or without the gateway", () => {
    assert.equal(f.directStatus, 400);
    assert.equal(f.throughStatus, 400);
  });

  test("claim 5 is false: the double booking is a 409 of the service, and the gateway imports no service", () => {
    assert.deepEqual(f.reservationStatuses, [201, 409]);
    assert.equal(f.importsServices, false);
  });

  test("claim 6 is true: the Location header comes through", () => {
    assert.equal(f.gatewayCreateStatus, 201);
    assert.equal(f.gatewayLocation, f.expectedLocation);
  });

  test("the review script prints three FINDING lines and three CLAIM lines", () => {
    const out = execFileSync("node", ["review/gateway-review.js"], { cwd: new URL("..", import.meta.url), encoding: "utf8" }).split("\n").filter(Boolean);
    assert.equal(out.filter((l) => l.startsWith("FINDING")).length, 3);
    assert.equal(out.filter((l) => l.startsWith("CLAIM")).length, 3);
    assert.deepEqual(out.slice(0, 3).map((l) => l.endsWith("confirmed")), [true, true, true]);
    assert.deepEqual(out.slice(3).map((l) => l.split(/\s+/).at(-1)), ["FALSE", "FALSE", "TRUE"]);
  });
});

describe("gateway-demo.js", () => {
  test("it shows 200, 201, 502 and 504 and a degraded health", () => {
    const out = execFileSync("node", ["gateway-demo.js"], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
    for (const needle of ["->  200", "->  201", "->  502", "->  504", '"status":"degraded"', "Location: /requests/EVT-"]) assert.ok(out.includes(needle), needle);
  });
});
