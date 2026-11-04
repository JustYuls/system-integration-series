// Facts for the AI review: a requirement list drafted by an AI, checked with the quality rules and the coverage check.
import { loadModel, loadNotes } from "../src/document.js";
import { checkRequirement, coverage, loadRequirements, uncoveredRules } from "../src/requirements.js";

// The AI draft: vague, compound, no acceptance criteria, an orphan task, and the "return" requirement forgotten.
export function draftRequirements() {
  const reqs = structuredClone(loadRequirements());
  const get = (id) => reqs.find((r) => r.id === id);
  get("FR-05").statement = "The system shall be fast and easy when it checks the rain chance.";
  get("FR-03").statement = "The system shall check that the venue is free and the system shall check that it holds the attendees.";
  get("FR-06").acceptance = [];
  get("FR-11").task = "T09";
  return reqs.filter((r) => r.id !== "FR-10");
}

export function collect() {
  const model = loadModel();
  const notes = loadNotes();
  const real = loadRequirements();
  const draft = draftRequirements();
  const problemsOf = (id) => checkRequirement(draft.find((r) => r.id === id), model, notes);
  const realCoverage = coverage(model, real);
  const perTask = Object.values(realCoverage.byTask).map((ids) => ids.length);
  return {
    realProblems: real.flatMap((r) => checkRequirement(r, model, notes)).length,
    vague: problemsOf("FR-05").some((p) => p.startsWith("vague words")),
    vagueWords: problemsOf("FR-05").find((p) => p.startsWith("vague words")),
    compound: problemsOf("FR-03").some((p) => p.includes("2 \"shall\"")),
    noAcceptance: problemsOf("FR-06").includes("has no acceptance criteria"),
    orphanTask: problemsOf("FR-11").some((p) => p.includes("T09")),
    draftUncovered: coverage(model, draft).uncovered,
    realUncovered: realCoverage.uncovered,
    taskCount: perTask.length,
    tasksWithManyRequirements: perTask.filter((n) => n > 1).length,
    rulesUncovered: uncoveredRules(notes, real),
    ruleCount: Object.keys(notes.rules).length,
  };
}
