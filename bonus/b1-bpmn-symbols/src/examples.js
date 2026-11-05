// The example processes of this bonus: where they are, and the gateway decisions used to walk through them.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readBpmn } from "./bpmn.js";

export const EXAMPLE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "examples");
export const EXAMPLES = ["library-borrowing", "online-order", "event-request"];

// For each example: the exclusive gateway that decides, and its two answers.
export const DECISIONS = {
  "library-borrowing": { gateway: "G1", answers: ["Yes", "No"] },
  "online-order": { gateway: "G3", answers: ["Yes", "No"] },
  "event-request": { gateway: "G3", answers: ["Yes", "No"] },
};

export const exampleFile = (name) => path.join(EXAMPLE_DIR, `${name}.bpmn`);
export const readExample = (name) => readBpmn(exampleFile(name));
