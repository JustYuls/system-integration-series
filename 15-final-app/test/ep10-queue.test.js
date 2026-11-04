import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createQueue } from "../src/queue.js";

const fake = (options = {}) => {
  const delays = [];
  const queue = createQueue({ sleep: async (ms) => void delays.push(ms), ...options });
  return { queue, delays };
};

describe("publish and drain", () => {
  test("publish returns an id and does not call the handler", () => {
    const { queue } = fake();
    let called = 0;
    queue.subscribe("t", () => called++);
    assert.equal(queue.publish("t", {}), 1);
    assert.equal(queue.publish("t", {}), 2);
    assert.equal(called, 0);
  });
  test("drain delivers the payload to the subscriber", async () => {
    const { queue } = fake();
    const got = [];
    queue.subscribe("t", (p) => got.push(p));
    queue.publish("t", { a: 1 });
    await queue.drain();
    assert.deepEqual(got, [{ a: 1 }]);
    assert.deepEqual(queue.stats(), { delivered: 1, retried: 0, dead: 0 });
  });
  test("a second drain delivers nothing again", async () => {
    const { queue } = fake();
    let called = 0;
    queue.subscribe("t", () => called++);
    queue.publish("t", {});
    await queue.drain();
    await queue.drain();
    assert.equal(called, 1);
  });
  test("messages of one topic arrive in the order they were published", async () => {
    const { queue } = fake();
    const got = [];
    queue.subscribe("t", (p) => got.push(p.n));
    for (const n of [3, 1, 2]) queue.publish("t", { n });
    await queue.drain();
    assert.deepEqual(got, [3, 1, 2]);
  });
  test("only the subscribers of the topic receive the message", async () => {
    const { queue } = fake();
    const got = [];
    queue.subscribe("a", () => got.push("a"));
    queue.subscribe("b", () => got.push("b"));
    queue.publish("b", {});
    await queue.drain();
    assert.deepEqual(got, ["b"]);
  });
  test("every subscriber of a topic gets the message", async () => {
    const { queue } = fake();
    const got = [];
    queue.subscribe("t", () => got.push(1));
    queue.subscribe("t", () => got.push(2));
    queue.publish("t", {});
    await queue.drain();
    assert.deepEqual(got, [1, 2]);
  });
  test("a message with no subscriber is dropped without an error", async () => {
    const { queue } = fake();
    queue.publish("nobody", {});
    await queue.drain();
    assert.deepEqual(queue.stats(), { delivered: 0, retried: 0, dead: 0 });
  });
});

describe("retry with backoff", () => {
  test("a handler that fails twice is retried and then works", async () => {
    const { queue, delays } = fake();
    let calls = 0;
    queue.subscribe("t", () => {
      if (++calls <= 2) throw new Error("down");
    });
    queue.publish("t", {});
    await queue.drain();
    assert.equal(calls, 3);
    assert.deepEqual(delays, [100, 400]);
    assert.deepEqual(queue.stats(), { delivered: 1, retried: 2, dead: 0 });
    assert.equal(queue.deadLetters.length, 0);
  });
  test("an async handler that rejects is retried too", async () => {
    const { queue } = fake();
    let calls = 0;
    queue.subscribe("t", async () => {
      if (++calls === 1) throw new Error("once");
    });
    queue.publish("t", {});
    await queue.drain();
    assert.equal(queue.stats().delivered, 1);
  });
  test("the waits are the backoff list, one per retry", async () => {
    const { queue, delays } = fake({ maxAttempts: 4 });
    queue.subscribe("t", () => {
      throw new Error("no");
    });
    queue.publish("t", {});
    await queue.drain();
    assert.deepEqual(delays, [100, 400, 1600]);
  });
  test("when the list is shorter than the retries, the last wait is repeated", async () => {
    const { queue, delays } = fake({ maxAttempts: 4, backoffMs: [10, 20] });
    queue.subscribe("t", () => {
      throw new Error("no");
    });
    queue.publish("t", {});
    await queue.drain();
    assert.deepEqual(delays, [10, 20, 20]);
  });
  test("there is no wait after the last attempt", async () => {
    const { queue, delays } = fake();
    queue.subscribe("t", () => {
      throw new Error("no");
    });
    queue.publish("t", {});
    await queue.drain();
    assert.equal(delays.length, 2);
  });
});

describe("dead letters", () => {
  test("after maxAttempts the message moves to the dead letters", async () => {
    const { queue } = fake();
    let calls = 0;
    queue.subscribe("t", () => {
      calls++;
      throw new Error("always");
    });
    queue.publish("t", { requestNo: "EVT-0003" });
    await queue.drain();
    assert.equal(calls, 3);
    assert.deepEqual(queue.stats(), { delivered: 0, retried: 2, dead: 1 });
    assert.deepEqual(queue.deadLetters, [{ id: 1, topic: "t", payload: { requestNo: "EVT-0003" }, error: "always", attempts: 3 }]);
  });
  test("maxAttempts is configurable", async () => {
    const { queue } = fake({ maxAttempts: 1 });
    queue.subscribe("t", () => {
      throw new Error("no");
    });
    queue.publish("t", {});
    await queue.drain();
    assert.equal(queue.deadLetters[0].attempts, 1);
    assert.equal(queue.stats().retried, 0);
  });
  test("a dead message does not stop the messages behind it", async () => {
    const { queue } = fake();
    const got = [];
    queue.subscribe("t", (p) => {
      if (p.n === 1) throw new Error("bad");
      got.push(p.n);
    });
    for (const n of [1, 2, 3]) queue.publish("t", { n });
    await queue.drain();
    assert.deepEqual(got, [2, 3]);
    assert.equal(queue.deadLetters.length, 1);
  });
});
