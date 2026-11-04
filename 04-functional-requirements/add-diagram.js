// Add the picture (shapes and arrows) to docs/process.bpmn so that Draw.io or bpmn.io can open it:  node add-diagram.js
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBpmn } from "./src/bpmn.js";
import { withDiagram } from "./src/layout.js";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "docs", "process.bpmn");
const xml = readFileSync(file, "utf8");
writeFileSync(file, withDiagram(xml, parseBpmn(xml)));
console.log("diagram written to", path.relative(process.cwd(), file));
