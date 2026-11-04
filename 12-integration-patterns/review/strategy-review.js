// Check what an AI assistant recommended about integration strategy.   Run:  node review/strategy-review.js
import { collect } from "./strategy-facts.js";

const f = collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
console.log(`FINDING 1  a gateway with a queue ranks first                   ${f.winnerTotal} points, margin ${f.margin}          ${verdict(f.winner === "gateway-plus-queue")}`);
console.log(`FINDING 2  point-to-point does not scale                        ${f.systems} systems: ${f.linksP2P} links against ${f.linksHub}    ${verdict(f.linksP2P > f.linksHub)}`);
console.log(`FINDING 3  doubling one weight never changes the winner         ${f.changes} of ${f.sensitivityCount} change it          ${verdict(f.changes === 0)}`);
console.log(`CLAIM 4    an ESB is the best choice for 3 services            ESB ranks ${f.esbRank}, ${f.esbTotal} points         ${f.esbRank === 1 ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 5    dates should be sent as dd/mm/yyyy                   isIsoDate("04/03/2027") is ${f.ddmmyyyy}   ${f.ddmmyyyy ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 6    the API file covers every Must requirement           ${f.mustCovered} of ${f.mustCount} covered, ${f.openApiProblems} problems   ${f.openApiProblems === 0 && f.mustCovered === f.mustCount ? "TRUE" : "FALSE"}`);
