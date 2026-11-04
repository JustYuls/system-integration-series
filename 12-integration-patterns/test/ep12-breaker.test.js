import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CircuitOpenError, createBreaker } from "../src/patterns/circuit-breaker.js";
import { createFakeClock } from "../src/patterns/fakes.js";

const boom = async () => { throw new Error("503"); };
const fine = async () => "ok";

function setup(options = {}) {
  const clock = createFakeClock();
  const breaker = createBreaker({ failureThreshold: 3, coolDownMs: 10_000, now: clock.now, ...options });
  const fail = async (times) => { for (let i = 0; i < times; i++) await breaker.call(boom).catch(() => {}); };
  return { clock, breaker, fail };
}

describe("circuit breaker", () => {
  test("it starts closed and lets calls through", async () => {
    const { breaker } = setup();
    assert.equal(breaker.state(), "closed");
    assert.equal(await breaker.call(fine), "ok");
  });
  test("failures below the limit keep it closed, and the error still reaches the caller", async () => {
    const { breaker, fail } = setup();
    await fail(2);
    assert.equal(breaker.state(), "closed");
    await assert.rejects(breaker.call(boom), /503/);
  });
  test("[NFR-02] it opens after 3 consecutive failures", async () => {
    const { breaker, fail } = setup();
    await fail(3);
    assert.equal(breaker.state(), "open");
  });
  test("a success resets the count of consecutive failures", async () => {
    const { breaker, fail } = setup();
    await fail(2);
    await breaker.call(fine);
    await fail(2);
    assert.equal(breaker.state(), "closed");
  });
  test("[NFR-02] while open it rejects at once and never calls the service", async () => {
    const { breaker, fail } = setup();
    await fail(3);
    let calls = 0;
    await assert.rejects(breaker.call(async () => { calls++; }), CircuitOpenError);
    assert.equal(calls, 0);
  });
  test("it stays open until the cool-down has passed", async () => {
    const { clock, breaker, fail } = setup();
    await fail(3);
    clock.advance(9_999);
    assert.equal(breaker.state(), "open");
    clock.advance(1);
    assert.equal(breaker.state(), "half-open");
  });
  test("[NFR-02] a successful probe in half-open closes it again", async () => {
    const { clock, breaker, fail } = setup();
    await fail(3);
    clock.advance(10_000);
    assert.equal(await breaker.call(fine), "ok");
    assert.equal(breaker.state(), "closed");
    assert.equal(breaker.failures(), 0);
  });
  test("a failed probe opens it again for a new cool-down", async () => {
    const { clock, breaker, fail } = setup();
    await fail(3);
    clock.advance(10_000);
    await breaker.call(boom).catch(() => {});
    assert.equal(breaker.state(), "open");
    clock.advance(9_999);
    assert.equal(breaker.state(), "open");
  });
  test("in half-open only one probe is allowed at a time", async () => {
    const { clock, breaker, fail } = setup();
    await fail(3);
    clock.advance(10_000);
    let release;
    const slow = breaker.call(() => new Promise((resolve) => { release = resolve; }));
    await assert.rejects(breaker.call(fine), CircuitOpenError); // the second caller waits outside
    release("done");
    assert.equal(await slow, "done");
  });
  test("errors that are not the service's fault can be ignored with isFailure", async () => {
    const { breaker } = setup({ isFailure: (err) => err.status !== 404 });
    for (let i = 0; i < 5; i++) await breaker.call(async () => { throw Object.assign(new Error("nope"), { status: 404 }); }).catch(() => {});
    assert.equal(breaker.state(), "closed");
  });
});
