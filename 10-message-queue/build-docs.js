// Write the three documents of episode 7 and print the completeness report:  node build-docs.js
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadModel, loadNotes, loadStakeholders } from "./src/document.js";
import { loadRequirements } from "./src/requirements.js";
import { loadNfr } from "./src/nfr.js";
import { loadStandards } from "./src/standards.js";
import { loadMeasurements } from "./src/measure.js";
import { loadOpenApi } from "./src/openapi-check.js";
import { criteriaWeights, loadStrategyData, scoreOptions } from "./src/strategy.js";
import { buildMatrix, completeness, counts, loadLinks, loadServiceIds, renderTraceability } from "./src/trace.js";
import { loadRisks, renderRecommendation, renderSpec, riskProblems } from "./src/spec.js";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "docs");
const model = loadModel(), notes = loadNotes(), requirements = loadRequirements(), nfrs = loadNfr();
const links = loadLinks(), risks = loadRisks(), strategy = loadStrategyData();

const matrix = buildMatrix({ requirements, links });
const problems = [...completeness({ notes, requirements, nfrs, links, openapi: loadOpenApi(), serviceIds: loadServiceIds() }), ...riskProblems(risks.risks, nfrs)];
const weights = criteriaWeights(nfrs, strategy.priorities, strategy.constraints);
const ranking = scoreOptions(strategy.options, weights);

const files = {
  "requirements-spec.md": renderSpec({ model, notes, stakeholders: loadStakeholders(), requirements, nfrs, measurements: loadMeasurements(), standards: loadStandards(), matrix, problems, risks }),
  "recommendation.md": renderRecommendation({ nfrs, strategy, weights, ranking, risks }),
  "traceability.md": renderTraceability({ matrix, nfrs, links }),
};
for (const [name, text] of Object.entries(files)) {
  writeFileSync(path.join(docs, name), text);
  console.log(`wrote docs/${name.padEnd(22)} ${text.split("\n").length - 1} lines`);
}

console.log("\nCompleteness report");
console.log(`  tasks and decisions   ${Object.keys(notes.tasks).length + Object.keys(notes.decisions).length}`);
console.log(`  business rules        ${Object.keys(notes.rules).length}`);
console.log(`  functional (FR)       ${requirements.length}`);
console.log(`  non-functional (NFR)  ${nfrs.length}`);
console.log(`  matrix rows           ${matrix.length}`);
const c = counts({ requirements, nfrs, problems });
console.log(`  fully linked          ${c.linked} of ${c.total}`);
if (problems.length === 0) console.log("  problems              none: the trace is complete");
else for (const p of problems) console.log(`  PROBLEM  ${p.where} ${p.problem}`);
process.exitCode = problems.length === 0 ? 0 : 1;
