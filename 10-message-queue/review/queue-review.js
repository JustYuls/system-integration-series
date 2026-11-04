// Check what an AI assistant said about message queues.   Run:  node review/queue-review.js
import { collect } from "./queue-facts.js";

const f = await collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
console.log(`FINDING 1  a failing handler is retried with growing waits       waits ${f.retryDelays.join(", ")} ms      ${verdict(f.retriedUntilSuccess && f.delaysGrow)}`);
console.log(`FINDING 2  after max attempts the message is a dead letter       ${f.deadCount} dead, ${f.deadAttempts} attempts      ${verdict(f.deadCount === 1 && f.deadAttempts === 3)}`);
console.log(`FINDING 3  one topic is delivered in order                       order ${f.order.join("")}            ${verdict(f.inOrder)}`);
console.log(`CLAIM 4    a queue guarantees exactly-once delivery             naive handler sent ${f.naiveEmails} e-mails      ${f.naiveEmails === 1 ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 5    publish does not wait for the handler                handled ${f.handledAfterPublish} before, ${f.handledAfterDrain} after drain   ${f.handledAfterPublish === 0 && f.handledAfterDrain === 1 ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 6    retries should happen immediately, without waiting   waits ${f.retryDelays.join(", ")} ms              ${f.immediateRetries ? "TRUE" : "FALSE"}`);
