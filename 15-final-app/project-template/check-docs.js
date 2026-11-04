// Check your documents: the BPMN file, its notes, the functional and the non-functional requirements.   node check-docs.js
// The quality checkers are the ones of episodes 2 to 5. "TODO" lines are not errors: they are your list of work.
import { check } from "./src/bpmn.js";
import { gaps, loadModel, loadNotes } from "./src/document.js";
import { checkAll, coverage, loadRequirements, uncoveredRules } from "./src/requirements.js";
import { checkAll as checkNfrs, loadNfr } from "./src/nfr.js";

const model = loadModel();
const notes = loadNotes();
const requirements = loadRequirements();
const nfrs = loadNfr();
let errors = 0;
const report = (title, problems) => {
  console.log(problems.length ? `${title}: ${problems.length} problems` : `${title}: OK`);
  for (const p of problems) console.log(`  - ${p}`);
  errors += problems.length;
};

report("BPMN process", check(model).map((p) => p.message));
report("Process notes", gaps(model, notes).map((g) => `${g.task} ${g.gap}`));
report("Functional requirements", checkAll(requirements, model, notes).map((p) => `${p.id} ${p.problem}`));
report("Non-functional requirements", checkNfrs(nfrs).map((p) => `${p.id} ${p.problem}`));

const open = coverage(model, requirements).uncovered;
console.log(`\nTODO: ${open.length} tasks have no requirement yet: ${open.map((id) => `${id} ${model.nodes[id].name}`).join("; ") || "none"}`);
const rules = uncoveredRules(notes, requirements);
console.log(`TODO: ${rules.length} business rules are used by no requirement: ${rules.join(", ") || "none"}`);
process.exitCode = errors ? 1 : 0;
