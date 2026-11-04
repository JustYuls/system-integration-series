// Write docs/final-report.md from the real files of this folder and from a real run of the tests.
//   node build-report.js            runs `node --test` first (about a minute) and reports what passed
//   node build-report.js --no-run   skips the run (the table says "not run")
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReport, parseJunit } from "./src/report.js";

const root = path.dirname(fileURLToPath(import.meta.url));
let run = null;
if (!process.argv.includes("--no-run")) {
  console.log("running node --test ...");
  const started = Date.now();
  const r = spawnSync("node", ["--test", "--test-reporter=junit", "--test-reporter-destination=stdout"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  run = { results: parseJunit(r.stdout), seconds: Math.round((Date.now() - started) / 1000) };
  console.log(`${run.results.filter((x) => x.ok).length} of ${run.results.length} tests passed in ${run.seconds} s`);
}
const file = path.join(root, "docs", "final-report.md");
writeFileSync(file, buildReport({ root, run }));
console.log("written", path.relative(process.cwd(), file));
