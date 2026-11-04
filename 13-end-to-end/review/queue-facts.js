// Facts for the AI review: what an AI assistant said about message queues, decided by running the queue.
import { createNotifier } from "../src/notifier.js";
import { createQueue } from "../src/queue.js";

const decided = { requestNo: "EVT-0001", decision: "approved", reasons: [], contactEmail: "a@campus.test" };

// A queue with a fake sleep that records the waits instead of waiting.
function testQueue() {
  const delays = [];
  const queue = createQueue({ sleep: async (ms) => void delays.push(ms) });
  return { queue, delays };
}

export async function collect() {
  // Finding 1: a handler that fails twice is retried, and the waits grow.
  const a = testQueue();
  let calls = 0;
  a.queue.subscribe("t", () => {
    if (++calls <= 2) throw new Error("down");
  });
  a.queue.publish("t", {});
  await a.queue.drain();

  // Finding 2: a handler that always fails: after maxAttempts the message is a dead letter.
  const b = testQueue();
  let failures = 0;
  b.queue.subscribe("t", () => {
    failures++;
    throw new Error("always");
  });
  b.queue.publish("t", { n: 1 });
  await b.queue.drain();

  // Finding 3: five messages of one topic arrive in the order they were published.
  const c = testQueue();
  const seen = [];
  c.queue.subscribe("t", (p) => void seen.push(p.n));
  for (let n = 1; n <= 5; n++) c.queue.publish("t", { n });
  await c.queue.drain();

  // Claim: "exactly once". A handler does its side effect and then fails, so the retry repeats the effect.
  const naive = testQueue();
  const naiveOutbox = [];
  let naiveCalls = 0;
  naive.queue.subscribe("t", (p) => {
    naiveOutbox.push(p.requestNo); // the side effect (an e-mail)
    if (++naiveCalls === 1) throw new Error("connection lost after sending");
  });
  naive.queue.publish("t", decided);
  await naive.queue.drain();

  // The same failure with the idempotent notifier: one e-mail only.
  const safe = testQueue();
  const safeOutbox = [];
  const notify = createNotifier({ send: async (m) => void safeOutbox.push(m.to) });
  let safeCalls = 0;
  safe.queue.subscribe("t", async (p) => {
    await notify(p);
    if (++safeCalls === 1) throw new Error("connection lost after sending");
  });
  safe.queue.publish("t", decided);
  await safe.queue.drain();

  // Claim: "publish does not wait for the handler".
  const d = testQueue();
  let handled = 0;
  d.queue.subscribe("t", () => void handled++);
  d.queue.publish("t", {});
  const handledAfterPublish = handled;
  await d.queue.drain();

  return {
    retryDelays: a.delays,
    retriedUntilSuccess: calls === 3 && a.queue.stats().delivered === 1,
    delaysGrow: a.delays.length === 2 && a.delays[1] > a.delays[0],
    deadCount: b.queue.deadLetters.length,
    deadAttempts: b.queue.deadLetters[0]?.attempts,
    handlerCallsBeforeDead: failures,
    order: seen,
    inOrder: seen.join() === "1,2,3,4,5",
    naiveEmails: naiveOutbox.length,
    safeEmails: safeOutbox.length,
    handledAfterPublish,
    handledAfterDrain: handled,
    immediateRetries: a.delays.every((ms) => ms === 0),
  };
}
