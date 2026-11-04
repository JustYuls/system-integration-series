// Check what an AI assistant said about the BPMN process.   Run:  node review/bpmn-review.js
import { collect } from "./bpmn-facts.js";

const f = collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
console.log(`FINDING 1  the weather check is a dead end                 T04 never reaches an end   ${verdict(f.deadEnd)}`);
console.log(`FINDING 2  the gateway after the checks has one exit       G3 must split or join      ${verdict(f.badGateway)}`);
console.log(`FINDING 3  the budget check is not in any lane             T05 has no owner           ${verdict(f.noLane)}`);
console.log(`CLAIM 4    an exclusive gateway sends the token down every path   approve and return both ran: ${f.exclusiveTookBoth}   ${f.exclusiveTookBoth ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 5    a parallel gateway starts all its paths                all 4 checks ran: ${f.allChecksRan}              ${f.allChecksRan ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 6    the join continues after the first check finishes      join waited for all 4: ${f.joinWaited}     ${f.joinWaited ? "FALSE" : "TRUE"}`);
