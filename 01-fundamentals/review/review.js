// Check what an AI assistant said about integrating the three silos.   Run:  node review/review.js
import { collect } from "./facts.js";

const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
const short = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

const f = collect();
const [march, april] = f.sameTextTwoDates;
console.log(`FINDING 1  joining on the title merges two requests      ${f.naiveRecords} records for ${f.requests} requests   ${verdict(f.naiveRecords < f.requests)}`);
console.log(`FINDING 2  '03/04/2027' is ${short(march)} or ${short(april)}                wrong order: ${f.dmyErrors} errors, ${f.dmyWrongDates} wrong dates   ${verdict(march !== april && f.dmyOk === 0)}`);
console.log(`FINDING 3  normalize the id first, then join             ${f.idsNormalizedMatch} of ${f.requests} match (was ${f.idsRawMatch})   ${verdict(f.idsNormalizedMatch > f.idsRawMatch)}`);
console.log(`CLAIM 4    point-to-point needs n links for n systems    for 6 systems: ${f.p2p6} links          ${f.p2p6 === 6 ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 5    a hub needs n links for n systems             for 6 systems: ${f.hub6} links           ${f.hub6 === 6 ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 6    the view stays complete if finance is down    complete: ${f.completeWhenFinanceDown} of ${f.requests}        ${f.completeWhenFinanceDown === f.requests ? "TRUE" : "FALSE"}`);
