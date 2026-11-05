// Walk a token through the examples:  node walk-through.js [example-name]
import { names, simulate } from "./src/bpmn.js";
import { DECISIONS, EXAMPLES, readExample } from "./src/examples.js";

const only = process.argv[2];
for (const name of only ? [only] : EXAMPLES) {
  const model = readExample(name);
  const { gateway, answers } = DECISIONS[name];
  console.log(`${name}.bpmn`);
  for (const answer of answers) {
    console.log(`  ${model.nodes[gateway].name} ${answer}`);
    console.log("    " + names(model, simulate(model, { [gateway]: answer })).join(" -> "));
  }
}
