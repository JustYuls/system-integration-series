// Walk a token through the event request process:  node simulate-demo.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import { names, readBpmn, simulate } from "./src/bpmn.js";

const model = readBpmn(path.join(path.dirname(fileURLToPath(import.meta.url)), "docs", "process.bpmn"));
for (const answer of ["Yes", "No"]) {
  console.log(`All checks passed? ${answer}`);
  console.log("  " + names(model, simulate(model, { G3: answer })).join("  ->  "));
}
