// Prove that every requirement has a test.   node verify.js [folder]    (exit code 1 when something is missing)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderCoverage, verifyProject } from "./src/verify.js";

const root = process.argv[2] ? path.resolve(process.argv[2]) : path.dirname(fileURLToPath(import.meta.url));
const result = verifyProject(root);

for (const line of renderCoverage(result)) console.log(line);
console.log("");
if (result.ok) {
  console.log("OK: every requirement has a tagged behaviour test, every endpoint has a test, the trace is complete.");
} else {
  console.log(`NOT VERIFIED: ${result.problems.length} problems`);
  for (const p of result.problems) console.log(`  - ${p}`);
}
process.exitCode = result.ok ? 0 : 1;
