// Check what an AI assistant said about API gateways.   Run:  node review/gateway-review.js
import { collect } from "./gateway-facts.js";

const f = await collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
const line = (label, text, evidence, result) => console.log(`${label.padEnd(10)} ${text.padEnd(46)} ${evidence.padEnd(34)} ${result}`);

line("FINDING 1", "the gateway adds a request id and returns it", `id sent on and echoed: ${f.upstreamGotGeneratedId && f.upstreamGotCallerId}`, verdict(f.generatedId?.length === 36 && f.upstreamGotGeneratedId && f.echoedId === "demo-123" && f.upstreamGotCallerId));
line("FINDING 2", "a down service gives 502, not a hang", `${f.downStatus} in ${f.downMs} ms`, verdict(f.downStatus === 502 && f.downMs < f.timeoutMs));
line("FINDING 3", "a slow service gives 504 after the timeout", `${f.lateStatus} after ${f.lateMs} ms (limit ${f.timeoutMs})`, verdict(f.lateStatus === 504 && f.lateMs >= f.timeoutMs && f.lateMs < f.slowMs));
line("CLAIM 4", "the services no longer need to validate input", `direct: ${f.directStatus}, via gateway: ${f.throughStatus}`, f.directStatus === 400 ? "FALSE" : "TRUE");
line("CLAIM 5", "the gateway must contain the business rules", `venue taken twice: ${f.reservationStatuses.join(", ")}`, f.reservationStatuses[1] === 409 && !f.importsServices ? "FALSE" : "TRUE");
line("CLAIM 6", "the gateway forwards the Location header", `${f.gatewayLocation}`, f.gatewayCreateStatus === 201 && f.gatewayLocation === f.expectedLocation && f.gatewayLocation ? "TRUE" : "FALSE");
