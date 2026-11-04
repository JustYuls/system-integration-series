// Check what an AI assistant said about the non-functional requirements.   Run:  node review/nfr-review.js
import { collect } from "./nfr-facts.js";

const f = collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
console.log(`FINDING 1  three of the five requirements are vague words      ${f.vagueCount} of ${f.draftCount} fail the rules          ${verdict(f.vagueCount === 3)}`);
console.log(`FINDING 2  the list has no reliability or interoperability     missing: ${f.draftMissing.length} of 8 categories  ${verdict(f.draftMissing.includes("reliability") && f.draftMissing.includes("interoperability"))}`);
console.log(`FINDING 3  500 ms for every request cannot be met              needs ${f.needMs} ms at least        ${verdict(f.needMs > f.draft500)}`);
console.log(`CLAIM 4    calling the three APIs one after another still fits   ${f.oneAfterAnother.totalMs} ms against ${f.oneAfterAnother.limitMs}   ${f.oneAfterAnother.ok ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 5    three tries of the slowest call still fit            ${f.threeTries.totalMs} ms against ${f.threeTries.limitMs}   ${f.threeTries.ok ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 6    the real list covers all eight categories             ${f.realCovered} of 8 covered           ${f.realMissing.length === 0 ? "TRUE" : "FALSE"}`);
