// Find the services in the BPMN process, compare them with the catalog, and check every contract.   Run:  node services-report.js
import { loadModel, loadNotes } from "./src/document.js";
import { catalogProblems, checkContract, deriveServices, loadCatalog, serviceForTask, sharedData } from "./src/soa.js";

const model = loadModel();
const notes = loadNotes();
const catalog = loadCatalog();

console.log("Services found in the process (one for each system in the notes):");
for (const d of deriveServices(model, notes)) console.log(`  ${d.taskIds.join(", ").padEnd(8)} ${d.system.padEnd(22)} ${d.externalApi ? `wraps ${d.externalApi}` : ""}`);

console.log("");
console.log("Service catalog:");
for (const s of catalog.services) {
  const bad = checkContract(s).length;
  console.log(`  ${s.id.padEnd(24)} ${s.tasks.join(", ").padEnd(8)} ${String(s.operations.length).padStart(2)} operations  ${bad === 0 ? "contract OK" : `${bad} violations`}`);
}

console.log("");
for (const id of ["T02", "T05"]) console.log(`${id} ${model.nodes[id].name} is carried out by: ${serviceForTask(catalog, id).map((s) => s.id).join(", ")}`);
const problems = [...catalogProblems(model, notes, catalog), ...sharedData(catalog).map((s) => `${s.ids.join(", ")} share the data owner ${s.owner}`)];
console.log(problems.length ? problems.join("\n") : "The catalog matches the process.");
process.exitCode = problems.length ? 1 : 0;
