import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadModel, loadNotes, loadStakeholders } from "../src/document.js";
import { loadRequirements } from "../src/requirements.js";
import { loadNfr } from "../src/nfr.js";
import { loadMeasurements } from "../src/measure.js";
import { loadStandards } from "../src/standards.js";
import { criteriaWeights, loadStrategyData, scoreOptions } from "../src/strategy.js";
import { buildMatrix, loadLinks } from "../src/trace.js";
import { PLAN, differences, loadRisks, measuredValues, renderRecommendation, renderSpec, riskProblems } from "../src/spec.js";

const requirements = loadRequirements();
const nfrs = loadNfr();
const risks = loadRisks();
const strategy = loadStrategyData();
const weights = criteriaWeights(nfrs, strategy.priorities, strategy.constraints);
const ranking = scoreOptions(strategy.options, weights);
const matrix = buildMatrix({ requirements, links: loadLinks() });
const spec = renderSpec({
  model: loadModel(), notes: loadNotes(), stakeholders: loadStakeholders(), requirements, nfrs, measurements: loadMeasurements(),
  standards: loadStandards(), matrix, problems: [], risks,
});
const recommendation = renderRecommendation({ nfrs, strategy, weights, ranking, risks });

describe("the requirements specification", () => {
  test("it has the nine numbered sections in order", () => {
    const titles = spec.split("\n").filter((l) => l.startsWith("## ")).map((l) => l.slice(3));
    assert.deepEqual(titles, [
      "1 Purpose and scope", "2 Process overview", "3 Stakeholders", "4 Functional requirements", "5 Non-functional requirements",
      "6 Business rules", "7 Standards and constraints", "8 Traceability summary", "9 Risks and assumptions",
    ]);
  });
  test("section 4 holds every functional requirement with its acceptance criteria", () => {
    for (const r of requirements) {
      assert.ok(spec.includes(`### ${r.id} (${r.priority}`), r.id);
      assert.ok(spec.includes(r.statement), r.id);
      for (const a of r.acceptance) assert.ok(spec.includes(a), r.id);
    }
  });
  test("section 2 lists the seven tasks of the main path and the decision", () => {
    assert.match(spec, /1\. Submit event request \(T01\)/);
    assert.match(spec, /7\. Notify organizer \(T07\)/);
    assert.match(spec, /\*\*G3 All checks passed\?\*\*/);
  });
  test("section 3 lists the five stakeholders", () => assert.equal(spec.split("\n").filter((l) => /^\| SH\d /.test(l)).length, 5));
  test("section 5 shows the target of every NFR and the one measured value we have", () => {
    for (const n of nfrs) assert.ok(spec.includes(`| ${n.id} | ${n.category} |`), n.id);
    assert.match(spec, /\| NFR-01 \| performance \| <= 3000 ms \| 1760 ms \| pass \|/);
    assert.match(spec, /\| NFR-02 \| availability \| >= 100 percent \| not measured yet \| not measured \|/);
  });
  test("section 6 names the requirements that serve each rule", () => {
    assert.match(spec, /\| BR-08 \| .* \| FR-08, FR-09, FR-10 \|/);
    assert.match(spec, /\| BR-01 \| .* \| FR-02 \|/);
  });
  test("section 7 lists the 12 standards and practices", () => assert.equal(spec.split("\n").filter((l) => /^\| STD-\d\d /.test(l)).length, 12));
  test("section 8 reports problems when there are some", () => {
    assert.match(spec, /no problems: every task, rule, FR and NFR is linked/);
    const bad = renderSpec({
      model: loadModel(), notes: loadNotes(), stakeholders: loadStakeholders(), requirements, nfrs, measurements: loadMeasurements(),
      standards: loadStandards(), matrix, problems: [{ where: "FR-04", problem: "has no test tag" }], risks,
    });
    assert.match(bad, /found 1 problems: FR-04 has no test tag/);
  });
  test("the measured value of NFR-01 is the slowest p95 plus 500 ms", () => assert.deepEqual(measuredValues(loadMeasurements()), { "NFR-01": 1760 }));
});

describe("the integration recommendation", () => {
  test("the executive summary comes first and names the winner with its real score", () => {
    const first = recommendation.split("\n").filter((l) => l.startsWith("## "))[0];
    assert.equal(first, "## Executive summary");
    assert.match(recommendation, /\*\*We recommend: Gateway \+ queue for notifications\.\*\*/);
    assert.match(recommendation, /scores 99 of 115 points \(86 percent\), 5 ahead of Hub-and-spoke \(API gateway\) \(94\)/);
  });
  test("it has the seven sections after the summary", () => {
    const titles = recommendation.split("\n").filter((l) => l.startsWith("## ")).map((l) => l.slice(3));
    assert.deepEqual(titles, [
      "Executive summary", "1 Problem", "2 Options considered", "3 Criteria and weights", "4 The decision and why",
      "5 What we will not do", "6 Risks and mitigations", "7 Plan by phase",
    ]);
  });
  test("the options table shows the scores of src/strategy.js", () => {
    for (const r of ranking) assert.ok(recommendation.includes(`| ${r.rank} | ${r.name} | ${r.total} of ${r.max} | ${r.percent} |`), r.id);
    assert.deepEqual(ranking.map((r) => r.total), [99, 94, 81, 77, 63, 59]);
  });
  test("the weights table shows each criterion with the NFRs behind it", () => {
    assert.match(recommendation, /\| availability \| 3 \| NFR-02 \(Must\) \|/);
    assert.match(recommendation, /\| capacity \| 1 \| NFR-08 \(Could\) \|/);
    assert.match(recommendation, /\| cost \| 3 \| project constraint \|/);
  });
  test("the winner gains 10 weighted points and gives up 5 against the runner-up", () => {
    const d = differences(ranking);
    assert.deepEqual(d.map((x) => [x.criterion, x.delta]), [["availability", 6], ["reliability", 3], ["maintainability", -2], ["capacity", 1], ["cost", -3]]);
    assert.equal(d.reduce((sum, x) => sum + x.delta, 0), 5);
  });
  test("every option that is not chosen appears under what we will not do", () => {
    const part = recommendation.split("## 5 What we will not do")[1].split("## 6")[0];
    for (const r of ranking.slice(1)) assert.ok(part.includes(`**${r.name}**`), r.id);
  });
  test("the plan has four phases and the first one is done", () => {
    assert.deepEqual(PLAN.map((p) => p.status), ["done", "next", "planned", "planned"]);
    assert.match(recommendation, /\| 1 Process and requirements \| done \|/);
  });
});

describe("the risks", () => {
  test("there are six risks, each tied to a real NFR with a mitigation", () => {
    assert.equal(risks.risks.length, 6);
    assert.deepEqual(riskProblems(risks.risks, nfrs), []);
  });
  test("a risk tied to an NFR that does not exist is reported", () => {
    const bad = [{ ...risks.risks[0], nfr: "NFR-09" }];
    assert.deepEqual(riskProblems(bad, nfrs), [{ where: "RISK-1", problem: "is tied to NFR-09, which is not a non-functional requirement" }]);
  });
  test("likelihood and impact use Low, Medium and High", () => {
    for (const r of risks.risks) assert.ok(["Low", "Medium", "High"].includes(r.likelihood) && ["Low", "Medium", "High"].includes(r.impact), r.id);
  });
});
