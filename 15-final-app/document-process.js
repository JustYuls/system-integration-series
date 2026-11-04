// Check the notes and write docs/process.md:  node document-process.js
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gaps, loadModel, loadNotes, loadStakeholders, questionProblems, renderProcessDoc } from "./src/document.js";

const model = loadModel();
const notes = loadNotes();
const found = gaps(model, notes);
const questions = questionProblems(loadStakeholders(), model);
console.log(`${Object.keys(notes.tasks).length} tasks documented, ${Object.keys(notes.rules).length} business rules`);
console.log(found.length ? `${found.length} gaps:` : "OK: every task is documented");
for (const g of found) console.log(`  ${g.task} ${g.gap}`);
console.log(questions.length ? `${questions.length} question problems:` : "OK: every stakeholder has good questions");
for (const q of questions) console.log("  " + q);
if (!found.length) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "docs", "process.md");
  writeFileSync(file, renderProcessDoc(model, notes));
  console.log("written", path.relative(process.cwd(), file));
}
process.exitCode = found.length || questions.length ? 1 : 0;
