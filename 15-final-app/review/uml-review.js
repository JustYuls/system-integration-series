// Check what an AI assistant said about UML and our architecture.   Run:  node review/uml-review.js
import { collect } from "./uml-facts.js";

const f = collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
const yesNo = (v) => (v ? "yes" : "no");
console.log(`FINDING 1  the sequence diagram skips the queue and notifier      T07 missing: ${yesNo(f.skipsQueue)}   ${verdict(f.skipsQueue && f.realProblems === 0)}`);
console.log(`FINDING 2  the page has an arrow straight to Open-Meteo           page to API: ${yesNo(f.pageToApi)}   ${verdict(f.pageToApi)}`);
console.log(`FINDING 3  the state diagram has a state nobody can leave         On hold stuck: ${yesNo(f.stuckState)}   ${verdict(f.stuckState)}`);
console.log(`CLAIM 4    a sequence diagram shows the structure of the system   its view is ${f.sequenceView}; structure: ${f.structureKinds.join(", ")}   ${f.sequenceView === "structure" ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 5    a component diagram shows the order of calls           showsOrder ${f.componentShowsOrder}, messages in the text: ${yesNo(f.componentHasMessages)}   ${f.componentShowsOrder || f.componentHasMessages ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 6    a state diagram shows the statuses a request goes through   states match the ${f.stateStatesMatch ? "4" : "?"} statuses: ${yesNo(f.stateStatesMatch)}   ${f.stateStatesMatch && f.stateViewBehavior ? "TRUE" : "FALSE"}`);
