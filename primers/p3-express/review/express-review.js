// Check what an AI assistant said about this Express app.   Run:  node review/express-review.js
import { collect } from "./express-facts.js";

const f = await collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
const tf = (ok) => (ok ? "TRUE" : "FALSE");

const jsonNeeded = f.jsonBodyWith === "object" && f.jsonBodyWithout === "undefined";
const orderMatters = f.routeFirstStatus !== f.catchAllFirstStatus;
const innerHtmlSafe = !f.unsafeHasRealTag;

console.log(`FINDING 1  an unknown venue gives a 404 in the error shape    ${f.missing.status} ${f.missing.code}              ${verdict(f.missing.status === 404 && f.missing.code === "NOT_FOUND")}`);
console.log(`FINDING 2  a good request gives 201 and a Location header     ${f.created.status} ${f.created.location}  ${verdict(f.created.status === 201 && f.created.location === "/api/requests/EVT-0001")}`);
console.log(`FINDING 3  more attendees than the capacity gives a 400       ${f.tooMany.status} ${f.tooMany.problems.length} problem            ${verdict(f.tooMany.status === 400 && f.tooMany.problems.length === 1)}`);
console.log(`CLAIM 4    express.json() is needed to read a JSON body       with: ${f.jsonBodyWith}, without: ${f.jsonBodyWithout}   ${tf(jsonNeeded)}`);
console.log(`CLAIM 5    the order of middleware does not matter            ${f.routeFirstStatus} against ${f.catchAllFirstStatus}   ${tf(!orderMatters)}`);
console.log(`CLAIM 6    innerHTML with user text is safe                   a real <img> tag appears: ${f.unsafeHasRealTag}   ${tf(innerHtmlSafe)}`);
