// Prove that every requirement has a test.   node verify.js    (exit code 1 when something is missing)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyProject } from "./src/verify.js";

const result = verifyProject(path.dirname(fileURLToPath(import.meta.url)));

console.log("Requirement  tests");
for (const r of result.rows) console.log(`${r.id.padEnd(13)}${String(r.total).padEnd(6)}${r.total === 0 ? " MISSING" : ""}`);
console.log(`\nEndpoints named in a test: ${result.endpoints.filter((e) => e.tested).length} of ${result.endpoints.length}`);
console.log(`Tests found: ${result.counts.total}, with a requirement tag: ${result.counts.tagged}`);
if (result.ok) console.log("\nOK: every requirement has a tagged test, every endpoint has a test.");
else {
  console.log(`\nNOT VERIFIED: ${result.problems.length} problems`);
  for (const p of result.problems) console.log(`  - ${p}`);
}
process.exitCode = result.ok ? 0 : 1;
