// What a gap looks like: break three links on purpose and let the completeness check find them.   node gap-demo.js
import { loadNotes } from "./src/document.js";
import { loadRequirements } from "./src/requirements.js";
import { loadNfr } from "./src/nfr.js";
import { loadOpenApi } from "./src/openapi-check.js";
import { completeness, loadLinks, loadServiceIds } from "./src/trace.js";

const links = loadLinks();
delete links.functional["FR-04"];                                    // a requirement nobody linked
links.functional["FR-09"].endpoint = "GET /api/requests";            // an endpoint that is not in the OpenAPI file
links.nonFunctional["NFR-09"] = { verification: "test", evidence: "none", testTag: "NFR-09" }; // an orphan

const input = { notes: loadNotes(), requirements: loadRequirements(), nfrs: loadNfr(), links, openapi: loadOpenApi(), serviceIds: loadServiceIds() };
const problems = completeness(input);
console.log(`${problems.length} problems found:`);
for (const p of problems) console.log(`  ${p.where.padEnd(7)} ${p.problem}`);
