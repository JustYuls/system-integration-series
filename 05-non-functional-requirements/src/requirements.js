// Functional requirements: load them, check their quality, check that they cover the process, write docs/requirements.md.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTask, simulate } from "./bpmn.js";
import { taskOrder } from "./document.js";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
export const loadRequirements = (file = path.join(docs, "requirements.json")) => JSON.parse(readFileSync(file, "utf8")).functional;

export const PRIORITIES = ["Must", "Should", "Could"];

// Words that cannot be tested. "Fast" and "easy" are non-functional ideas: they belong in the next episode.
export const VAGUE_WORDS = ["fast", "quick", "quickly", "easy", "easily", "user-friendly", "flexible", "simple", "robust", "efficient",
  "modern", "reasonable", "adequate", "appropriate", "as needed", "if possible", "approximately", "etc."];

const wordPattern = (w) => new RegExp(`(?<![\\w-])${w.replace(/\./g, "\\.")}(?![\\w-])`, "i");
export const vagueWordsIn = (text) => VAGUE_WORDS.filter((w) => wordPattern(w).test(text));

const GIVEN_WHEN_THEN = /^Given .+ when .+ then .+/;
const laneOf = (model, id) => model.lanes.find((l) => l.nodes.includes(id))?.name;

// The quality problems of ONE requirement (an empty list means it is good).
export function checkRequirement(req, model, notes) {
  const found = [];
  const s = req.statement ?? "";
  if (!/^FR-\d{2}$/.test(req.id ?? "")) found.push(`id "${req.id}" is not in the form FR-NN`);
  if (!s.startsWith("The system shall ")) found.push("does not start with The system shall");
  const shalls = (s.match(/\bshall\b/gi) ?? []).length;
  if (shalls !== 1) found.push(`has ${shalls} "shall", it must have one`);
  const vague = vagueWordsIn(s);
  if (vague.length) found.push(`vague words: ${vague.join(", ")}`);
  if (/\band\/or\b/i.test(s)) found.push('"and/or" hides a choice; say which one');
  const acceptance = req.acceptance ?? [];
  if (!acceptance.length) found.push("has no acceptance criteria");
  for (const a of acceptance) if (!GIVEN_WHEN_THEN.test(a)) found.push(`acceptance is not Given, when, then: "${a}"`);
  if (!model.nodes[req.task]) found.push(`the task ${req.task} is not in the process`);
  else if (laneOf(model, req.task) !== req.actor) found.push(`the actor "${req.actor}" is not the lane of ${req.task} ("${laneOf(model, req.task)}")`);
  for (const r of req.rules ?? []) if (!notes.rules[r]) found.push(`${r} is not a business rule`);
  if (!PRIORITIES.includes(req.priority)) found.push(`priority "${req.priority}" is not Must, Should or Could`);
  return found;
}

// Problems of the whole list: { id, problem }.
export function checkAll(requirements, model, notes) {
  const found = [];
  const seen = new Set();
  for (const req of requirements) {
    if (seen.has(req.id)) found.push({ id: req.id, problem: "the id is used twice" });
    seen.add(req.id);
    for (const problem of checkRequirement(req, model, notes)) found.push({ id: req.id, problem });
  }
  return found;
}

// Which requirements cover each task? Every user, service and send task needs at least one.
export function coverage(model, requirements) {
  const byTask = {};
  for (const id of taskOrder(model)) {
    byTask[id] = requirements.filter((r) => r.task === id).map((r) => r.id);
  }
  return { byTask, uncovered: Object.keys(byTask).filter((id) => !byTask[id].length) };
}

// Which business rules does no requirement use?
export const uncoveredRules = (notes, requirements) => {
  const used = new Set(requirements.flatMap((r) => r.rules ?? []));
  return Object.keys(notes.rules).filter((r) => !used.has(r));
};

// The nodes that have requirements, in the order of the flow.
function sections(model, requirements) {
  const flow = [...simulate(model, { G3: "Yes" }), ...Object.keys(model.nodes)];
  return [...new Set(flow)].filter((id) => requirements.some((r) => r.task === id));
}

export function renderRequirements(model, requirements) {
  const count = (p) => requirements.filter((r) => r.priority === p).length;
  const lines = [
    "# Functional requirements", "",
    `${requirements.length} requirements for the process "${model.name}": ${count("Must")} Must, ${count("Should")} Should, ${count("Could")} Could.`,
    "", "| Id | Task | Priority | Actor |", "|---|---|---|---|",
    ...requirements.map((r) => `| ${r.id} | ${r.task} | ${r.priority} | ${r.actor} |`), "",
  ];
  for (const id of sections(model, requirements)) {
    lines.push(`## ${id} ${model.nodes[id].name}`, "");
    for (const r of requirements.filter((x) => x.task === id)) {
      lines.push(`### ${r.id} (${r.priority})`, "", r.statement, "", `Actor: ${r.actor}. Rules: ${r.rules?.length ? r.rules.join(", ") : "none"}.`, "", "Acceptance criteria:", "",
        ...r.acceptance.map((a) => `- ${a}`), "");
    }
  }
  return lines.join("\n");
}
