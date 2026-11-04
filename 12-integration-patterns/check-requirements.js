// Check the functional requirements and write docs/requirements.md.   node check-requirements.js [file.json]
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadModel, loadNotes } from "./src/document.js";
import { checkAll, coverage, loadRequirements, renderRequirements, uncoveredRules } from "./src/requirements.js";

const model = loadModel();
const notes = loadNotes();
const file = process.argv[2];
const reqs = file ? loadRequirements(path.resolve(file)) : loadRequirements();

const problems = checkAll(reqs, model, notes);
console.log(`${reqs.length} functional requirements`);
console.log(problems.length ? `${problems.length} quality problems:` : "OK: every requirement meets the quality rules");
for (const p of problems) console.log(`  ${p.id} ${p.problem}`);

const cov = coverage(model, reqs);
const tasks = Object.keys(cov.byTask);
console.log(`Coverage: ${tasks.length - cov.uncovered.length} of ${tasks.length} tasks have a requirement`);
for (const id of tasks) console.log(`  ${id}  ${model.nodes[id].name.padEnd(30)} ${cov.byTask[id].join(", ") || "NONE"}`);
const orphanRules = uncoveredRules(notes, reqs);
console.log(orphanRules.length ? `Rules no requirement uses: ${orphanRules.join(", ")}` : "OK: every business rule is used by a requirement");

const ok = !problems.length && !cov.uncovered.length && !orphanRules.length;
if (ok && !file) {
  const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "docs", "requirements.md");
  writeFileSync(out, renderRequirements(model, reqs));
  console.log("written", path.relative(process.cwd(), out));
}
process.exitCode = ok ? 0 : 1;
