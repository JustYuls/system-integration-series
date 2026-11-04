// Check docs/openapi.json:  node check-openapi.js
import { loadRequirements } from "./src/requirements.js";
import { checkOpenApi, coverageTable, loadOpenApi, operations } from "./src/openapi-check.js";

const doc = loadOpenApi();
console.log(`${doc.info.title} ${doc.info.version}, OpenAPI ${doc.openapi}`);
for (const { verb, path, op } of operations(doc)) {
  const codes = Object.keys(op.responses).join(", ");
  console.log(`  ${verb.toUpperCase().padEnd(5)} ${path.padEnd(36)} ${codes.padEnd(9)} ${(op["x-requirements"] ?? []).join(" ") || (op["x-nfr"] ?? []).join(" ")}`);
}

const requirements = loadRequirements();
const table = coverageTable(doc, requirements);
const must = table.filter((r) => r.priority === "Must");
const covered = must.filter((r) => r.served.length || r.internal);
console.log(`Must requirements served: ${covered.length} of ${must.length}`);
for (const r of must.filter((x) => x.internal)) console.log(`  ${r.id} is internal (the queue, not the public API)`);

const problems = checkOpenApi(doc);
console.log(problems.length ? `${problems.length} problems:` : "OK: the file is sound and every Must requirement is covered");
for (const p of problems) console.log(`  ${p.where}: ${p.problem}`);
process.exitCode = problems.length ? 1 : 0;
