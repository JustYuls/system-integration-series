// Check what an AI assistant said about reading the venue file in Node.js.   Run:  node review/node-review.js
import { collect } from "./node-facts.js";

const f = await collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
const claim = (ok) => (ok ? "TRUE" : "FALSE");
console.log(`FINDING 1  CSV cells are text: "60" > "400" is ${f.textCompare}    ${verdict(f.textCompare && f.capacityIsNumber)}`);
console.log(`FINDING 2  an import needs its extension: ./helper fails    ${verdict(f.noExtensionFails)}`);
console.log(`FINDING 3  the text "false" is truthy: Boolean is ${f.falseTextIsTruthy}    ${verdict(f.falseTextIsTruthy && f.outdoorIsBoolean)}`);
console.log(`CLAIM 4    require works in an ES module: ${f.requireWorks ? "it works" : "not defined"}    ${claim(f.requireWorks)}`);
console.log(`CLAIM 5    readFileSync blocks the event loop: timer ran ${f.syncOrder[0] === "read done" ? "after" : "before"}    ${claim(f.syncOrder[0] === "read done" && f.asyncOrder[0] === "timer")}`);
console.log(`CLAIM 6    PORT=3000 is a number in process.env: it is a ${f.envType}    ${claim(f.envType === "number")}`);
