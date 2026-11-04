// Check what an AI assistant wrote in a recommendation draft.   Run:  node review/trace-review.js
import { collect } from "./trace-facts.js";

const f = collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
const tests = f.byVerification.test;
console.log(`FINDING 1  the draft recommends hub-and-spoke, which ranks lower   rank ${f.recommendedRank}, ${f.recommendedTotal} points against ${f.bestTotal}   ${verdict(f.recommendedRank > 1)}`);
console.log(`FINDING 2  the draft cites an NFR that does not exist              ${f.unknownNfrs.join(", ")} (the list ends at NFR-0${f.nfrCount})   ${verdict(f.unknownNfrs.length > 0)}`);
console.log(`FINDING 3  the draft leaves two Must requirements out of the trace  ${f.missingMust.join(", ")} missing   ${verdict(f.missingMust.length === 2)}`);
console.log(`CLAIM 4    the queue makes the answer faster                       performance ${f.perfWithQueue} with the queue, ${f.perfGatewayOnly} without   ${f.perfWithQueue > f.perfGatewayOnly ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 5    every NFR is verified by an automated test              ${tests} of ${f.nfrCount} by a test   ${tests === f.nfrCount ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 6    the trace has no gaps                                   ${f.traceProblems} problems found   ${f.traceProblems === 0 ? "TRUE" : "FALSE"}`);
