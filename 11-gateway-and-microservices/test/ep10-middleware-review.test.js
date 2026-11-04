import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { collect } from "../review/queue-facts.js";

const doc = JSON.parse(readFileSync(fileURLToPath(new URL("../docs/middleware-types.json", import.meta.url)), "utf8"));

describe("docs/middleware-types.json", () => {
  test("it lists the five integration technologies", () => {
    assert.deepEqual(doc.types.map((t) => t.id), ["mom", "esb", "gateway", "etl", "eai-hub"]);
  });
  test("every entry has a name, purpose, style, example and use in the planner", () => {
    for (const t of doc.types) for (const k of ["id", "name", "purpose", "style", "example", "usedInPlanner"]) assert.ok(t[k]?.length > 0, `${t.id} lacks ${k}`);
  });
  test("every style is one of the known ones", () => {
    for (const t of doc.types) assert.ok(["asynchronous", "synchronous", "batch", "both"].includes(t.style), t.id);
  });
  test("ids are unique", () => assert.equal(new Set(doc.types.map((t) => t.id)).size, doc.types.length));
});

const f = await collect();

describe("the AI review of the queue", () => {
  test("finding 1: a failing handler is retried with growing waits", () => {
    assert.deepEqual(f.retryDelays, [100, 400]);
    assert.ok(f.retriedUntilSuccess && f.delaysGrow);
  });
  test("finding 2: after three attempts the message is a dead letter", () => {
    assert.equal(f.deadCount, 1);
    assert.equal(f.deadAttempts, 3);
    assert.equal(f.handlerCallsBeforeDead, 3);
  });
  test("finding 3: messages of one topic arrive in order", () => assert.deepEqual(f.order, [1, 2, 3, 4, 5]));
  test("claim 4 is false: a handler that fails after its effect repeats it", () => assert.equal(f.naiveEmails, 2));
  test("claim 4 fix: the idempotent notifier sends one e-mail", () => assert.equal(f.safeEmails, 1));
  test("claim 5 is true: publish returns before the handler runs", () => assert.deepEqual([f.handledAfterPublish, f.handledAfterDrain], [0, 1]));
  test("claim 6 is false: the retries wait", () => assert.equal(f.immediateRetries, false));
});
