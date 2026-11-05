// Add the picture (shapes and arrows) to every example so that Draw.io or bpmn.io can open it:  node add-diagrams.js
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBpmn } from "./src/bpmn.js";
import { withDiagram } from "./src/layout.js";
import { EXAMPLES } from "./src/examples.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "examples");
for (const name of [...EXAMPLES, "broken-order"]) {
  const file = path.join(dir, `${name}.bpmn`);
  const xml = readFileSync(file, "utf8");
  writeFileSync(file, withDiagram(xml, parseBpmn(xml)));
  console.log("diagram written to", path.relative(process.cwd(), file));
}
