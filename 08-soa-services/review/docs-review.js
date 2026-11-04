// Check what an AI assistant said about the process documentation.   Run:  node review/docs-review.js
import { collect } from "./docs-facts.js";

const f = collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
console.log(`FINDING 1  the weather check is given to the wrong actor        T04 is in another lane     ${verdict(f.actorMismatch)}`);
console.log(`FINDING 2  the budget check says nothing about failures         T05 has no exception       ${verdict(f.noExceptions)}`);
console.log(`FINDING 3  the currency rule is never used by a task            BR-07 is orphaned          ${verdict(f.unusedRule)}`);
console.log(`CLAIM 4    the process runs two checks in parallel              the gateway starts ${f.parallelChecks}            ${f.parallelChecks === 2 ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 5    the rain rule applies to every event                 BR-02 is outdoor only: ${f.br02IsOutdoorOnly}   ${f.br02IsOutdoorOnly ? "FALSE" : "TRUE"}`);
console.log(`CLAIM 6    every service task calls an outside API              ${f.servicesWithOutsideApi} of ${f.serviceTasks} do                ${f.servicesWithOutsideApi === f.serviceTasks ? "TRUE" : "FALSE"}`);
