// Check what an AI assistant said about the planner and its web page.   Run:  node review/plan-review.js
import { collect } from "./plan-facts.js";

const f = await collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
console.log(`FINDING 1  user text must not go into innerHTML as it is        draft keeps <img>, escaped: ${f.safeEscaped}   ${verdict(f.draftKeepsTag && !f.safeKeepsTag && f.safeEscaped)}`);
console.log(`FINDING 2  an unknown check must not count as ok                 draft: ${f.draftDecision}, planEvent: ${f.realDecision}   ${verdict(f.draftDecision === "approved" && f.realDecision === "needs-review")}`);
console.log(`FINDING 3  the four checks should run at the same time           draft ${f.draftMaxInFlight} at once, planEvent ${f.realMaxInFlight}   ${verdict(f.draftMaxInFlight === 1 && f.realMaxInFlight >= 4)}`);
console.log(`CLAIM 4    innerHTML is safe because the server validates       the server stored it: ${f.createdStatus}   ${f.createdStatus === 201 ? "FALSE" : "TRUE"}`);
console.log(`CLAIM 5    Promise.all returns the other results on a failure   rejected: ${f.allRejected}, allSettled kept ${f.allSettledCount}   ${f.allRejected ? "FALSE" : "TRUE"}`);
console.log(`CLAIM 6    parallel checks take about as long as the slowest    ${f.parallelMs} ms, not ${f.sequentialMs} ms (sum ${f.sumDelaysMs})   ${f.parallelMs < f.sumDelaysMs * 0.75 ? "TRUE" : "FALSE"}`);
