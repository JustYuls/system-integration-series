// Check what an AI assistant said about a requirement list.   Run:  node review/fr-review.js
import { collect } from "./fr-facts.js";

const f = collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
console.log(`FINDING 1  FR-05 is vague: "fast and easy" cannot be tested      ${f.vagueWords}   ${verdict(f.vague)}`);
console.log(`FINDING 2  FR-03 is two requirements in one sentence             2 "shall" in one statement   ${verdict(f.compound)}`);
console.log(`FINDING 3  FR-06 has no acceptance criteria                      nothing to test against      ${verdict(f.noAcceptance)}`);
console.log(`CLAIM 4    the draft list covers every task                      uncovered: ${f.draftUncovered.join(", ")}          ${f.draftUncovered.length === 0 ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 5    each task needs exactly one requirement               ${f.tasksWithManyRequirements} tasks have more than one          ${f.tasksWithManyRequirements === 0 ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 6    every business rule is used by a requirement          ${f.ruleCount - f.rulesUncovered.length} of ${f.ruleCount} rules used         ${f.rulesUncovered.length === 0 ? "TRUE" : "FALSE"}`);
