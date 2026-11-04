import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildMessage, createNotifier, TOPIC } from "../src/notifier.js";
import { createQueue } from "../src/queue.js";

const approved = { requestNo: "EVT-0001", decision: "approved", reasons: [], contactEmail: "a@campus.test" };
const returned = { requestNo: "EVT-0002", decision: "returned", reasons: ["Room too small", "Penalty unpaid"], contactEmail: "b@campus.test" };

describe("the e-mail text", () => {
  test("[FR-12] an approved request gets a good-news message", () => {
    const m = buildMessage(approved);
    assert.equal(m.to, "a@campus.test");
    assert.equal(m.subject, "Event request EVT-0001 approved");
    assert.ok(m.body.startsWith("Good news"));
  });
  test("[FR-12] a returned request lists every reason", () => {
    const m = buildMessage(returned);
    assert.equal(m.subject, "Event request EVT-0002 returned to you");
    assert.ok(m.body.includes("- Room too small\n- Penalty unpaid"));
  });
  test("[FR-12] a request that needs review says an officer will look", () => {
    const m = buildMessage({ ...approved, decision: "needs-review", reasons: ["Holiday service not available"] });
    assert.equal(m.subject, "Event request EVT-0001 needs a manual review");
    assert.ok(m.body.includes("officer"));
    assert.ok(m.body.includes("- Holiday service not available"));
  });
  test("an approved message without reasons has no Reasons section", () => assert.ok(!buildMessage(approved).body.includes("Reasons")));
  test("an unknown decision is refused", () => assert.throws(() => buildMessage({ ...approved, decision: "maybe" }), /unknown decision/));
  test("the topic name is request.decided", () => assert.equal(TOPIC, "request.decided"));
});

describe("sending with the notifier", () => {
  test("[FR-12] send gets to, subject and body", async () => {
    const sent = [];
    await createNotifier({ send: async (m) => void sent.push(m) })(returned);
    assert.deepEqual(Object.keys(sent[0]), ["to", "subject", "body"]);
  });
  test("[FR-12] the same request and decision is sent only once", async () => {
    const sent = [];
    const notify = createNotifier({ send: async (m) => void sent.push(m) });
    assert.equal((await notify(approved)).skipped, false);
    assert.equal((await notify(approved)).skipped, true);
    assert.equal(sent.length, 1);
  });
  test("[FR-12] a new decision for the same request is sent", async () => {
    const sent = [];
    const notify = createNotifier({ send: async (m) => void sent.push(m) });
    await notify({ ...approved, decision: "needs-review" });
    await notify(approved);
    assert.equal(sent.length, 2);
  });
  test("a failed send is not remembered, so the next try sends", async () => {
    let calls = 0;
    const notify = createNotifier({
      send: async () => {
        if (++calls === 1) throw new Error("down");
      },
    });
    await assert.rejects(() => notify(approved), /down/);
    assert.equal((await notify(approved)).skipped, false);
    assert.equal(calls, 2);
  });
});

describe("the notifier on the queue", () => {
  test("[FR-12] one e-mail fails twice, is retried, and arrives once", async () => {
    const delays = [];
    const sent = [];
    let calls = 0;
    const queue = createQueue({ sleep: async (ms) => void delays.push(ms) });
    queue.subscribe(
      TOPIC,
      createNotifier({
        send: async (m) => {
          if (++calls <= 2) throw new Error("mail server down");
          sent.push(m.subject);
        },
      }),
    );
    queue.publish(TOPIC, approved);
    await queue.drain();
    assert.deepEqual(sent, ["Event request EVT-0001 approved"]);
    assert.deepEqual(delays, [100, 400]);
  });
  test("[FR-12] an e-mail that never works lands in the dead letters", async () => {
    const queue = createQueue({ sleep: async () => {} });
    queue.subscribe(TOPIC, createNotifier({ send: async () => Promise.reject(new Error("mailbox unknown")) }));
    queue.publish(TOPIC, returned);
    await queue.drain();
    assert.equal(queue.deadLetters[0].payload.requestNo, "EVT-0002");
    assert.equal(queue.deadLetters[0].error, "mailbox unknown");
  });
  test("a failure after the send does not make a second e-mail", async () => {
    const sent = [];
    const notify = createNotifier({ send: async (m) => void sent.push(m) });
    let calls = 0;
    const queue = createQueue({ sleep: async () => {} });
    queue.subscribe(TOPIC, async (p) => {
      await notify(p);
      if (++calls === 1) throw new Error("lost the acknowledgement");
    });
    queue.publish(TOPIC, approved);
    await queue.drain();
    assert.equal(calls, 2);
    assert.equal(sent.length, 1);
  });
});
