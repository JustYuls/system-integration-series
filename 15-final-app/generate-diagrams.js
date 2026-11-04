// Write docs/architecture.md from the project data, and check the four diagrams.   Run:  node generate-diagrams.js
// With --print and a name (component, sequence, state, deployment) it prints only that diagram's Mermaid text.
import { writeFileSync } from "node:fs";
import { renderArchitecture, DOC_FILE } from "./src/architecture-doc.js";
import { checkAll } from "./src/diagram-check.js";
import { buildDiagrams } from "./src/diagrams.js";

const diagrams = buildDiagrams();
const [flag, name] = process.argv.slice(2);
if (flag === "--print") {
  console.log(diagrams[name] ?? `unknown diagram "${name}": use ${Object.keys(diagrams).join(", ")}`);
  process.exit(diagrams[name] ? 0 : 1);
}

const problems = checkAll(diagrams);
for (const [kind, text] of Object.entries(diagrams)) {
  const found = problems[kind];
  console.log(`${kind.padEnd(11)} ${String(text.split("\n").length).padStart(3)} lines  ${found.length === 0 ? "OK" : `${found.length} problems`}`);
  for (const p of found) console.log(`  - ${p}`);
}
if (Object.values(problems).some((p) => p.length > 0)) process.exit(1);

writeFileSync(DOC_FILE, renderArchitecture({ diagrams }));
console.log("wrote docs/architecture.md");
