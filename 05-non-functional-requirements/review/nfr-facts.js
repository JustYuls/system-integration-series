// Facts for the AI review: a list of non-functional requirements drafted by an AI, checked by the NFR rules and the measurements.
import { categoriesCovered, checkNfr, loadNfr } from "../src/nfr.js";
import { feasibility, loadMeasurements } from "../src/measure.js";

const item = (id, category, statement, value, unit, comparison = "<=") => ({
  id, category, statement, metric: "as measured", target: { value, unit, comparison }, measure: "tested",
});
// A vague item: only a word, no metric, no number, no measure.
const vague = (id, category, statement) => ({ id, category, statement, target: {} });

// The AI draft: three items are vague, and one asks for 500 ms for everything.
export function draftNfrs() {
  return [
    vague("NFR-01", "performance", "The system shall be fast."),
    vague("NFR-02", "usability", "The system shall be user-friendly."),
    vague("NFR-03", "security", "The system shall be secure."),
    item("NFR-04", "performance", "The planner shall answer every request within 500 ms.", 500, "ms"),
    item("NFR-05", "availability", "The planner shall still answer when an outside API is down.", 100, "percent", ">="),
  ];
}

export function collect() {
  const real = loadNfr();
  const draft = draftNfrs();
  const sample = loadMeasurements();
  const limitMs = real.find((n) => n.id === "NFR-01").target.value;
  const apis = sample.apis;
  const vagueItems = draft.filter((n) => checkNfr(n).some((p) => p.includes("vague word")));
  const draft500 = draft.find((n) => n.id === "NFR-04").target.value;
  return {
    realProblems: real.flatMap((n) => checkNfr(n)).length,
    vagueCount: vagueItems.length,
    draftCount: draft.length,
    draftMissing: categoriesCovered(draft).missing,
    draft500,
    // what the 500 ms target would need: the slowest outside call plus our own 500 ms of work
    needMs: feasibility(apis, { limitMs: draft500 }).totalMs,
    parallel: feasibility(apis, { limitMs }),
    oneAfterAnother: feasibility(apis, { limitMs, parallel: false }),
    threeTries: feasibility(apis, { limitMs, attempts: 3 }),
    realCovered: categoriesCovered(real).covered.length,
    realMissing: categoriesCovered(real).missing,
  };
}
