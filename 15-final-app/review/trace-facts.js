// Facts for the AI review: an AI wrote a recommendation draft; scores, requirement lists and the trace decide what is right.
import { loadNfr } from "../src/nfr.js";
import { loadRequirements } from "../src/requirements.js";
import { loadNotes } from "../src/document.js";
import { loadOpenApi } from "../src/openapi-check.js";
import { criteriaWeights, loadStrategyData, scoreOptions } from "../src/strategy.js";
import { completeness, loadLinks, loadServiceIds } from "../src/trace.js";

// The draft, shortened. It is the data that the review checks.
export const DRAFT = {
  recommends: "hub-and-spoke",
  because: "It is simple, it has one gateway, and it satisfies NFR-01, NFR-02 and NFR-09.",
  citedNfrs: ["NFR-01", "NFR-02", "NFR-09"],
  tracedFrs: ["FR-01", "FR-02", "FR-03", "FR-05", "FR-06", "FR-07", "FR-08", "FR-09", "FR-11", "FR-12"],
  claims: {
    queueFasterAnswer: "The queue makes the answer to the organizer faster.",
    everyNfrAutomated: "Every non-functional requirement is verified by an automated test.",
    traceComplete: "The traceability matrix has no gaps: every task, rule, FR and NFR is linked.",
  },
};

export function collect() {
  const data = loadStrategyData();
  const nfrs = loadNfr();
  const requirements = loadRequirements();
  const ranking = scoreOptions(data.options, criteriaWeights(nfrs, data.priorities, data.constraints));
  const rank = (id) => ranking.find((r) => r.id === id);
  const rating = (id, c) => data.options.find((o) => o.id === id).ratings[c];
  const links = loadLinks();
  const problems = completeness({ notes: loadNotes(), requirements, nfrs, links, openapi: loadOpenApi(), serviceIds: loadServiceIds() });
  const missing = requirements.filter((r) => !DRAFT.tracedFrs.includes(r.id));
  return {
    // finding 1: the draft recommends an option that ranks lower
    recommendedRank: rank(DRAFT.recommends).rank, recommendedTotal: rank(DRAFT.recommends).total,
    bestId: ranking[0].id, bestTotal: ranking[0].total,
    // finding 2: the draft cites an NFR that does not exist
    unknownNfrs: DRAFT.citedNfrs.filter((id) => !nfrs.some((n) => n.id === id)), nfrCount: nfrs.length,
    // finding 3: two Must requirements are left out of the trace
    missingFrs: missing.map((r) => r.id), missingMust: missing.filter((r) => r.priority === "Must").map((r) => r.id),
    // claim 4: the queue makes the answer faster (performance of the winner and of the gateway alone)
    perfWithQueue: rating("gateway-plus-queue", "performance"), perfGatewayOnly: rating("hub-and-spoke", "performance"),
    availWithQueue: rating("gateway-plus-queue", "availability"), availGatewayOnly: rating("hub-and-spoke", "availability"),
    // claim 5: every NFR is verified by an automated test
    byVerification: Object.fromEntries(["test", "measurement", "review", "inspection"].map((v) => [v, nfrs.filter((n) => links.nonFunctional[n.id].verification === v).length])),
    // claim 6: the trace has no gaps
    traceProblems: problems.length,
    taskCount: Object.keys(loadNotes().tasks).length + Object.keys(loadNotes().decisions).length,
  };
}
