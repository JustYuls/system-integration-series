// Document the BPMN process: check that every task is described, and write docs/process.md from the model and the notes.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTask, readBpmn, simulate } from "./bpmn.js";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
export const loadNotes = () => JSON.parse(readFileSync(path.join(docs, "process-notes.json"), "utf8"));
export const loadStakeholders = () => JSON.parse(readFileSync(path.join(docs, "stakeholders.json"), "utf8")).stakeholders;
export const loadModel = () => readBpmn(path.join(docs, "process.bpmn"));

const laneName = (model, id) => model.lanes.find((l) => l.nodes.includes(id))?.name;

// The tasks in the order a token meets them (the "Yes" path first, then the tasks that are only on the other path).
export function taskOrder(model) {
  const first = simulate(model, { G3: "Yes" });
  const rest = Object.keys(model.nodes).filter((id) => !first.includes(id));
  return [...first, ...rest].filter((id) => isTask(model.nodes[id]));
}

// Every gap is { task, gap }. An empty list means the process is documented.
export function gaps(model, notes) {
  const found = [];
  const add = (task, gap) => found.push({ task, gap });
  const used = new Set();
  for (const id of taskOrder(model)) {
    const task = model.nodes[id];
    const n = notes.tasks[id];
    if (!n) {
      add(id, "has no notes at all");
      continue;
    }
    if (!n.actor) add(id, "has no actor");
    else if (n.actor !== laneName(model, id)) add(id, `is done by "${n.actor}" in the notes, but sits in the lane "${laneName(model, id)}"`);
    if (!n.inputs?.length) add(id, "has no inputs");
    if (!n.outputs?.length) add(id, "has no outputs");
    if (task.type === "serviceTask" && !n.system) add(id, "is a service task but names no system");
    if (task.type === "serviceTask" && !n.exceptions?.length) add(id, "is a service task with no exception: what if the service is down?");
    for (const r of n.rules ?? []) {
      used.add(r);
      if (!notes.rules[r]) add(id, `uses ${r}, which is not a business rule`);
    }
  }
  for (const r of Object.keys(notes.rules)) if (!used.has(r)) add(r, "is a business rule that no task uses");
  for (const id of Object.keys(notes.tasks)) if (!model.nodes[id]) add(id, "is described in the notes but is not in the process");
  return found;
}

const list = (items) => (items?.length ? items.join("; ") : "none");

export function renderProcessDoc(model, notes) {
  const order = taskOrder(model);
  const steps = simulate(model, { G3: "Yes" }).filter((id) => isTask(model.nodes[id])).map((id, i) => `${i + 1}. ${model.nodes[id].name} (${id})`);
  const lines = [
    `# ${model.name}`,
    "",
    `**Purpose.** ${notes.purpose}`,
    "",
    "## Who takes part",
    "",
    ...model.lanes.map((l) => `- **${l.name}**: ${l.nodes.filter((id) => isTask(model.nodes[id])).map((id) => model.nodes[id].name).join(", ") || "starts and ends the process"}`),
    "",
    "## The process at a glance",
    "",
    ...steps,
    "",
    "## Tasks",
    "",
  ];
  for (const id of order) {
    const n = notes.tasks[id];
    lines.push(`### ${id} ${model.nodes[id].name}`, "", "| | |", "|---|---|", `| Actor | ${n.actor} |`, `| Type | ${model.nodes[id].type} |`, `| System | ${n.system}${n.externalApi ? ` (${n.externalApi})` : ""} |`,
      `| Inputs | ${list(n.inputs)} |`, `| Outputs | ${list(n.outputs)} |`, `| Rules | ${list(n.rules)} |`, `| If it goes wrong | ${list(n.exceptions)} |`, "");
  }
  lines.push("## Decisions", "");
  for (const [id, d] of Object.entries(notes.decisions)) lines.push(`- **${id} ${d.question}** Yes: ${d.yes}. No: ${d.no}.`);
  lines.push("", "## Business rules", "", "| Rule | Statement | Used by |", "|---|---|---|");
  for (const [r, text] of Object.entries(notes.rules)) {
    const by = Object.entries(notes.tasks).filter(([, n]) => n.rules?.includes(r)).map(([id]) => id);
    lines.push(`| ${r} | ${text} | ${list(by)} |`);
  }
  return lines.join("\n") + "\n";
}

// Questions for the people who know the process.
export function questionProblems(stakeholders, model) {
  const found = [];
  for (const s of stakeholders) {
    if (s.questions.length < 3) found.push(`${s.id} has fewer than 3 questions`);
    for (const q of s.questions) {
      if (!q.endsWith("?")) found.push(`${s.id}: "${q}" is not a question`);
      if (/^(do|does|is|are|can|did|will|would) /i.test(q)) found.push(`${s.id}: "${q}" can be answered with yes or no; ask an open question`);
    }
    if (!model.lanes.some((l) => l.name === s.lane)) found.push(`${s.id} is in the lane "${s.lane}", which is not in the process`);
  }
  for (const l of model.lanes) if (!stakeholders.some((s) => s.lane === l.name)) found.push(`nobody is asked about the lane "${l.name}"`);
  return found;
}
