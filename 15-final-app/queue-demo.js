// Demo: decisions go through the queue; one e-mail fails twice, one always fails.   Run:  node queue-demo.js
// The sleep is a virtual clock: it prints the wait and adds it up, so the demo runs instantly and always prints the same.
import { createNotifier } from "./src/notifier.js";
import { createQueue } from "./src/queue.js";

let clock = 0;
const stamp = () => `t=${String(clock).padStart(4)} ms`;
const sleep = async (ms) => {
  console.log(`${stamp()}  waiting ${ms} ms before the next attempt`);
  clock += ms;
};

const calls = {};
async function send({ to, subject }) {
  calls[to] = (calls[to] ?? 0) + 1;
  const n = calls[to];
  if (to === "nursing@campus.test" && n <= 2) throw new Error("mail server down");
  if (to === "contest@campus.test") throw new Error("mailbox unknown");
  console.log(`${stamp()}  SENT   to ${to}: ${subject}`);
}

const queue = createQueue({ sleep });
const notify = createNotifier({ send });
queue.subscribe("request.decided", async (payload) => {
  try {
    const result = await notify(payload);
    if (result.skipped) console.log(`${stamp()}  SKIP   ${payload.requestNo} ${payload.decision} was already sent`);
  } catch (error) {
    console.log(`${stamp()}  FAILED ${payload.requestNo}: ${error.message}`);
    throw error;
  }
});

const decisions = [
  { requestNo: "EVT-0001", decision: "approved", reasons: [], contactEmail: "orientation@campus.test" },
  { requestNo: "EVT-0002", decision: "returned", reasons: ["The room holds 60, you expect 80"], contactEmail: "nursing@campus.test" },
  { requestNo: "EVT-0003", decision: "needs-review", reasons: ["Holiday service not available"], contactEmail: "contest@campus.test" },
  { requestNo: "EVT-0001", decision: "approved", reasons: [], contactEmail: "orientation@campus.test" },
];

for (const d of decisions) console.log(`publish ${d.requestNo} ${d.decision} -> message ${queue.publish("request.decided", d)}`);
console.log("publish returned for all four; nobody has been e-mailed yet\n--- drain ---");
await queue.drain();
console.log("--- result ---");
console.log("stats        ", JSON.stringify(queue.stats()));
for (const m of queue.deadLetters) console.log(`dead letter   message ${m.id} ${m.payload.requestNo}: ${m.error} after ${m.attempts} attempts`);
