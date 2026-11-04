// Check a BPMN file:  node bpmn-check.js [docs/process.bpmn]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, readBpmn } from "./src/bpmn.js";

const file = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "docs", "process.bpmn");
const model = readBpmn(file);
const problems = check(model);
console.log(`${model.name}: ${Object.keys(model.nodes).length} elements, ${model.flows.length} flows, ${model.lanes.length} lanes`);
if (problems.length === 0) console.log("OK: no problems found");
for (const p of problems) console.log(`  ${p.rule.padEnd(18)} ${p.message}`);
process.exitCode = problems.length ? 1 : 0;
