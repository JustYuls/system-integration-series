// The two documents of this episode: the requirements specification and the integration recommendation.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTask, simulate } from "./bpmn.js";
import { evaluate } from "./nfr.js";
import { feasibility } from "./measure.js";
import { CRITERIA, explain, sensitivityAll } from "./strategy.js";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
export const loadRisks = (file = path.join(docs, "risks.json")) => JSON.parse(readFileSync(file, "utf8"));

// The risks must each point to a real NFR.
export function riskProblems(risks, nfrs) {
  const found = [];
  for (const r of risks) {
    if (!nfrs.some((n) => n.id === r.nfr)) found.push({ where: r.id, problem: `is tied to ${r.nfr}, which is not a non-functional requirement` });
    if (!r.mitigation?.trim()) found.push({ where: r.id, problem: "has no mitigation" });
  }
  return found;
}

// The measured values we really have: NFR-01 is the slowest p95 of the outside APIs plus our own 500 ms.
export function measuredValues(measurements) {
  const f = feasibility(measurements.apis, { limitMs: 3000, overheadMs: 500, parallel: true });
  return { "NFR-01": f.totalMs };
}

const target = (n) => `${n.target.comparison} ${n.target.value} ${n.target.unit}`;
const bullets = (items) => items.map((x) => `- ${x}`);

// ---------- the requirements specification ----------
export function renderSpec({ model, notes, stakeholders, requirements, nfrs, measurements, standards, matrix, problems, risks }) {
  const steps = simulate(model, { G3: "Yes" }).filter((id) => isTask(model.nodes[id])).map((id, i) => `${i + 1}. ${model.nodes[id].name} (${id})`);
  const results = evaluate(nfrs, measuredValues(measurements));
  const must = requirements.filter((r) => r.priority === "Must").length;
  const lines = [
    "# Requirements specification: Campus Event Planner", "",
    "## 1 Purpose and scope", "",
    notes.purpose, "",
    "This document is the agreement between the people who need the system (organizers, Student Affairs, Facilities, Finance) and the people who build it. "
      + "It says **what** the system must do and how well. It does not say how it is built: that is the recommendation.", "",
    `Scope: ${requirements.length} functional requirements (${must} Must), ${nfrs.length} non-functional requirements, ${Object.keys(notes.rules).length} business rules.`, "",
    "## 2 Process overview", "",
    `The process is "${model.name}". Lanes: ${model.lanes.map((l) => l.name).join(", ")}.`, "",
    ...steps, "",
    ...Object.entries(notes.decisions).map(([id, d]) => `**${id} ${d.question}** Yes: ${d.yes}. No: ${d.no}.`), "",
    "## 3 Stakeholders", "",
    "| ID | Stakeholder | Concern | How we asked |", "|---|---|---|---|",
    ...stakeholders.map((s) => `| ${s.id} | ${s.name} | ${s.concern} | ${s.technique} |`), "",
    "## 4 Functional requirements", "",
  ];
  for (const r of requirements) {
    lines.push(`### ${r.id} (${r.priority}, ${r.task}, ${r.rules.join(", ") || "no rule"})`, "", r.statement, "", "Acceptance criteria:", ...bullets(r.acceptance), "");
  }
  lines.push("## 5 Non-functional requirements", "",
    "| ID | Category | Target | Measured | Status |", "|---|---|---|---|---|",
    ...nfrs.map((n, i) => {
      const e = results[i];
      return `| ${n.id} | ${n.category} | ${target(n)} | ${e.measured === undefined ? "not measured yet" : `${e.measured} ${n.target.unit}`} | ${e.status} |`;
    }), "",
    `The measured value of NFR-01 comes from the three outside APIs (${measurements.measuredAt}): the slowest p95 plus 500 ms of our own work. The others are proved by tests later.`, "",
    "## 6 Business rules", "",
    "| Rule | Statement | Requirements |", "|---|---|---|",
    ...Object.entries(notes.rules).map(([rule, text]) => `| ${rule} | ${text} | ${requirements.filter((r) => r.rules.includes(rule)).map((r) => r.id).join(", ")} |`), "",
    "## 7 Standards and constraints", "",
    "| ID | Kind | Name | Rule | Serves |", "|---|---|---|---|---|",
    ...standards.map((s) => `| ${s.id} | ${s.kind} | ${s.name} | ${s.rule} | ${s.nfr} |`), "",
    "## 8 Traceability summary", "",
    `${matrix.length} rows link each requirement to its task, rule, service, endpoint and test tag (see traceability.md).`,
    problems.length === 0 ? "The completeness check found no problems: every task, rule, FR and NFR is linked." : `The completeness check found ${problems.length} problems: ${problems.map((p) => `${p.where} ${p.problem}`).join("; ")}.`, "",
    "## 9 Risks and assumptions", "",
    "| Risk | Likelihood | Impact | NFR | Mitigation |", "|---|---|---|---|---|",
    ...risks.risks.map((r) => `| ${r.title} | ${r.likelihood} | ${r.impact} | ${r.nfr} | ${r.mitigation} |`), "",
    "Assumptions:", ...bullets(risks.assumptions));
  return lines.join("\n") + "\n";
}

// ---------- the recommendation ----------
// The plan by phase. The first phase is done: the earlier episodes produced it.
export const PLAN = [
  { phase: "1 Process and requirements", status: "done", work: "BPMN process, 12 functional and 8 non-functional requirements, strategy and standards." },
  { phase: "2 Design", status: "next", work: "Find the services in the process (SOA) and write a contract for each." },
  { phase: "3 Build", status: "planned", work: "REST services, the gateway, the message queue, integration patterns and the web page." },
  { phase: "4 Proof", status: "planned", work: "Tests for every requirement, architecture diagrams and documents." },
];

// Where does the winner gain or lose against the runner-up? Weighted points, per criterion.
export function differences(ranking) {
  const [a, b] = ranking;
  return CRITERIA.map((c) => ({ criterion: c, delta: a.parts[c] - b.parts[c] })).filter((d) => d.delta !== 0);
}

// The reason each option we do not choose is left out: its weakest rating.
function weakest(option) {
  const [criterion, rating] = Object.entries(option.ratings).sort((x, y) => x[1] - y[1])[0];
  return { criterion, rating, why: option.why?.[criterion] };
}

export function renderRecommendation({ nfrs, strategy, weights, ranking, risks }) {
  const [first, second] = ranking;
  const chosen = strategy.options.find((o) => o.id === first.id);
  const sens = sensitivityAll(strategy.options, weights);
  const changes = sens.filter((s) => s.changed).length;
  const diffs = differences(ranking);
  const gains = diffs.filter((d) => d.delta > 0).map((d) => `${d.criterion} +${d.delta}`).join(", ");
  const losses = diffs.filter((d) => d.delta < 0).map((d) => `${d.criterion} ${d.delta}`).join(", ");
  const top = risks.risks.filter((r) => r.impact === "High").slice(0, 2);
  const lines = [
    "# Integration recommendation: Campus Event Planner", "",
    "## Executive summary", "",
    `**We recommend: ${chosen.name}.** ${chosen.idea}`, "",
    ...bullets([
      `**Evidence.** It scores ${first.total} of ${first.max} points (${first.percent} percent), ${first.total - second.total} ahead of ${second.name} (${second.total}).`,
      `**Robust.** Doubling any one of the ${sens.length} weights ${changes === 0 ? "never changes the winner" : `changes the winner ${changes} times`}.`,
      `**Why it wins.** Against the runner-up it gains ${gains}, and it gives up ${losses || "nothing"}.`,
      `**Main risks.** ${top.map((r) => `${r.title} (${r.nfr})`).join("; ")}. Each has a mitigation below.`,
      "**Decision we ask for.** Approve this strategy and the plan below, so that the design phase can start.",
    ]), "",
    "## 1 Problem", "",
    `${strategy.scenario.description} The organizer needs an answer within 3 seconds, even when an outside service is down, and the team is small.`, "",
    "## 2 Options considered", "",
    "| Rank | Option | Points | Percent |", "|---|---|---|---|",
    ...ranking.map((r) => `| ${r.rank} | ${r.name} | ${r.total} of ${r.max} | ${r.percent} |`), "",
    "## 3 Criteria and weights", "",
    "The criteria are the eight non-functional categories plus cost. A Must is worth 3 points, a Should 2, a Could 1; cost is a project constraint of 3 points.", "",
    "| Criterion | Weight | From |", "|---|---|---|",
    ...CRITERIA.map((c) => `| ${c} | ${weights[c]} | ${c === "cost" ? "project constraint" : nfrs.filter((n) => n.category === c).map((n) => `${n.id} (${strategy.priorities[n.id] ?? "Must"})`).join(", ")} |`), "",
    "## 4 The decision and why", "",
    explain(ranking), "",
    `Compared with ${second.name}, the queue adds ${gains}; the price is ${losses || "nothing"}. The numbers favor the combination, and the sensitivity check shows the result does not depend on one weight.`, "",
    "## 5 What we will not do", "",
    ...ranking.slice(1).map((r) => {
      const w = weakest(strategy.options.find((o) => o.id === r.id));
      return `- **${r.name}** (${r.total} points). Its weakest criterion is ${w.criterion} (${w.rating} of 5)${w.why ? `: ${w.why}` : ""}.`;
    }), "",
    "## 6 Risks and mitigations", "",
    "| Risk | Likelihood | Impact | NFR | Mitigation |", "|---|---|---|---|---|",
    ...risks.risks.map((r) => `| ${r.title} | ${r.likelihood} | ${r.impact} | ${r.nfr} | ${r.mitigation} |`), "",
    "## 7 Plan by phase", "",
    "| Phase | Status | Work |", "|---|---|---|",
    ...PLAN.map((p) => `| ${p.phase} | ${p.status} | ${p.work} |`),
  ];
  return lines.join("\n") + "\n";
}
