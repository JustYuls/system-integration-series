// Check the example processes with the checker of episode 2, and say which symbols each one uses.
//   node check-examples.js            the three good examples
//   node check-examples.js --broken   the flawed order (lists its problems)
import { check } from "./src/bpmn.js";
import { EXAMPLES, readExample } from "./src/examples.js";
import { symbolsUsed } from "./src/symbols.js";

const broken = process.argv.includes("--broken");
let failed = 0;

for (const name of broken ? ["broken-order"] : EXAMPLES) {
  const model = readExample(name);
  const problems = check(model);
  const count = `${Object.keys(model.nodes).length} elements, ${model.flows.length} flows, ${model.lanes.length} lanes`;
  console.log(`${(name + ".bpmn").padEnd(22)} ${problems.length ? "PROBLEMS" : "OK      "} ${count}`);
  if (problems.length === 0) {
    console.log("  uses: " + symbolsUsed(model).map((s) => s.name.toLowerCase()).join(", "));
  }
  for (const p of problems) console.log(`  ${p.rule.padEnd(15)} ${p.message}`);
  if (problems.length) console.log(`  ${problems.length} problems found`);
  failed += problems.length;
}
process.exitCode = failed ? 1 : 0;
