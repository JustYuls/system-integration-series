// Check what an AI assistant said about its Express route.   Run:  node review/rest-review.js
import { collect } from "./rest-facts.js";

const f = await collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
const line = (label, text, evidence, result) => console.log(`${label.padEnd(10)} ${text.padEnd(42)} ${evidence.padEnd(30)} ${result}`);

line("FINDING 1", "a create must answer 201 and a Location", `draft: ${f.draftCreateStatus}, no Location`, verdict(f.draftCreateStatus === 200 && !f.draftLocation));
line("FINDING 2", "the draft accepts an empty body", `stored, status ${f.draftEmptyStatus}`, verdict(f.draftEmptyStored));
line("FINDING 3", "a GET must never change data", `GET /approve: ${f.draftStatusAfterGet}`, verdict(f.draftStatusAfterGet === "Approved"));
line("CLAIM 4", "the draft hides its insides on failure", `500 body has a stack: ${f.draftLeaksStack}`, f.draftLeaksStack ? "FALSE" : "TRUE");
line("CLAIM 5", "DELETE is safe: it changes nothing", `GET after DELETE: ${f.deleteAfter}`, f.deleteAfter === 200 ? "TRUE" : "FALSE");
line("CLAIM 6", "the same POST twice makes two requests", `two numbers: ${f.twoNumbers}`, f.twoNumbers ? "TRUE" : "FALSE");
