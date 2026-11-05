// Check what an AI assistant said about BPMN symbols.   Run:  node review/symbols-review.js
import { collect } from "./symbols-facts.js";

const f = collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
const line = (tag, said, proof, result) => console.log(`${tag.padEnd(10)} ${said.padEnd(50)} ${proof.padEnd(40)} ${result}`);
line("FINDING 1", "a thick circle is an end event", "catalog: every thick circle is an end", verdict(f.thickAreEnds));
line("FINDING 2", "a double circle is an intermediate event", "catalog: every double circle is one", verdict(f.doubleAreIntermediate));
line("FINDING 3", "the broken order: dead end, no split, no lane", "checker found T07, G3 and T04", verdict(f.deadEnd && f.noSplit && f.noLane));
const plus = f.exclusiveMarker === "plus";
const same = f.messageFlowScope === "inside one pool";
line("CLAIM 4", "an exclusive gateway is drawn with a plus sign", `catalog marker: ${f.exclusiveMarker}`, plus ? "TRUE" : "FALSE");
line("CLAIM 5", "a parallel gateway starts all its paths", `both checks ran: ${f.parallelRanAll}`, f.parallelRanAll ? "TRUE" : "FALSE");
line("CLAIM 6", "a message flow connects tasks in the same pool", `catalog scope: ${f.messageFlowScope}`, same ? "TRUE" : "FALSE");
