// Check what an AI assistant said about the service contracts and the catalog.   Run:  node review/soa-review.js
import { collect } from "./soa-facts.js";

const f = collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
const twice = f.tasksWithTwoServices.join(", ");
console.log(`FINDING 1  Facilities exposes internal database fields          venue_row_id, tbl_penalty  ${verdict(f.exposesInternals)}`);
console.log(`FINDING 2  Weather returns the raw Open-Meteo JSON              output: daily              ${verdict(f.returnsRaw)}`);
console.log(`FINDING 3  Notification keeps a session between calls           input: sessionId           ${verdict(f.keepsSession)}`);
console.log(`CLAIM 4    each service task maps to exactly one service        ${twice} needs two          ${twice === "" ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 5    all the services share one database                 ${f.dataOwnerCount} owners for ${f.serviceCount} services    ${f.dataOwnerCount === 1 ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 6    every service task has a service in the catalog      ${f.tasksWithNoService.length} without one            ${f.tasksWithNoService.length === 0 ? "TRUE" : "FALSE"}`);
