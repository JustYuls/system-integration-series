// Facts for the AI review: an AI answer about UML and our architecture, checked by the checkers and by docs/uml-kinds.json.
import { checkAll, checkComponent, checkSequence, checkState, parseState } from "../src/diagram-check.js";
import { buildDiagrams } from "../src/diagrams.js";
import { loadKinds } from "../src/architecture-doc.js";
import { STATUSES } from "../src/services/student-affairs.js";
import { draftDiagrams } from "./draft-diagrams.js";

export function collect() {
  const real = buildDiagrams();
  const draft = draftDiagrams();
  const kinds = loadKinds();
  const kind = (id) => kinds.find((k) => k.id === id);

  const sequenceProblems = checkSequence(draft.sequence);
  const componentProblems = checkComponent(draft.component);
  const stateProblems = checkState(draft.state);
  const realProblems = Object.values(checkAll(real)).flat();
  const labels = parseState(real.state).states.map((s) => s.label).sort();

  return {
    realProblems: realProblems.length,
    // findings, decided by the checkers on the flawed draft
    sequenceProblems,
    skipsQueue: sequenceProblems.some((p) => p.includes("T07")),
    componentProblems,
    pageToApi: componentProblems.some((p) => p.includes("from the page to api_open_meteo")),
    stateProblems,
    stuckState: stateProblems.some((p) => p.includes("nobody can leave") && p.includes("On hold")),
    // claims, decided by the table of diagram kinds and the real diagrams
    sequenceView: kind("sequence").view,
    structureKinds: kinds.filter((k) => k.view === "structure").map((k) => k.id),
    componentShowsOrder: kind("component").showsOrder,
    componentHasMessages: /->>|\bpar\b/.test(real.component),
    stateStatesMatch: JSON.stringify(labels) === JSON.stringify([...STATUSES].sort()),
    stateViewBehavior: kind("state").view === "behavior" && kind("state").showsOrder,
  };
}
