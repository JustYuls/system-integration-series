// Check what an AI assistant said about JavaScript.   Run:  node review/js-review.js
import { collect } from "./js-facts.js";

const f = await collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
console.log(`FINDING 1  money in decimals drifts                0.1 + 0.2 = ${f.sum}                 ${verdict(!f.sumIsPointThree)}`);
console.log(`FINDING 2  attendees "120" is text, not a number   checkRequest flags it: ${f.stringAttendeesFound}   ${verdict(f.stringAttendeesFound)}`);
console.log(`FINDING 3  2027-02-30 looks right, is not a day    regex ok ${f.impossibleDateLooksFine}, flagged ${f.impossibleDateFound}   ${verdict(f.impossibleDateLooksFine && f.impossibleDateFound)}`);
console.log(`CLAIM 4    '5' == 5 and '5' === 5 are the same     == ${f.looseEqual}, === ${f.strictEqual}   ${f.looseEqual === f.strictEqual ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 5    a const object can still change inside  limit is now 10: ${f.constObjectChanged}   ${f.constObjectChanged ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 6    fetch rejects when the server says 404  rejected: ${f.fetch404.rejected}, ok: ${f.fetch404.ok}   ${f.fetch404.rejected ? "TRUE" : "FALSE"}`);
