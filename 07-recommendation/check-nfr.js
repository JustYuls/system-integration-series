// Check the non-functional requirements and write docs/nfr.md:  node check-nfr.js
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { categoriesCovered, checkAll, checkNfr, evaluate, loadNfr, renderNfrDoc } from "./src/nfr.js";
import { feasibility, loadMeasurements } from "./src/measure.js";

// node check-nfr.js --draft   checks the list that an AI wrote (review/nfr-facts.js): one line for each requirement
if (process.argv.includes("--draft")) {
  const { draftNfrs } = await import("./review/nfr-facts.js");
  const draft = draftNfrs();
  console.log(`${draft.length} draft requirements, ${categoriesCovered(draft).covered.length} of 8 categories covered`);
  for (const n of draft) {
    const [first, ...more] = checkNfr(n);
    console.log(`${n.id}  ${first ? "FAIL" : "ok  "}  ${first ?? n.statement}${more.length ? ` (and ${more.length} more)` : ""}`);
  }
  process.exit(1);
}

const nfrs = loadNfr();
const problems = checkAll(nfrs);
const { covered, missing } = categoriesCovered(nfrs);
console.log(`${nfrs.length} non-functional requirements, ${covered.length} of 8 categories covered`);
console.log(problems.length ? `${problems.length} problems:` : "OK: every requirement has a category, a number, a metric and a measure");
for (const p of problems) console.log(`  ${p.id} ${p.problem}`);
if (missing.length) console.log("  missing categories: " + missing.join(", "));

// The one requirement we can already judge: the timing of the outside APIs.
const sample = loadMeasurements();
const nfr01 = nfrs.find((n) => n.id === "NFR-01");
const plan = feasibility(sample.apis, { limitMs: nfr01.target.value });
console.log(`NFR-01 feasibility: slowest outside p95 ${plan.outsideMs} ms + ${plan.overheadMs} ms = ${plan.totalMs} ms (limit ${plan.limitMs} ms)`);
for (const r of evaluate(nfrs, { "NFR-01": plan.totalMs })) console.log(`  ${r.id}  ${r.target.padEnd(28)} ${String(r.measured ?? "-").padStart(5)}  ${r.status}`);

if (!problems.length && !missing.length) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "docs", "nfr.md");
  writeFileSync(file, renderNfrDoc(nfrs));
  console.log("written", path.relative(process.cwd(), file));
}
process.exitCode = problems.length || missing.length ? 1 : 0;
