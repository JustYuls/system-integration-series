// Facts for the AI review: what an AI recommended about integration strategy, checked by the scores, the standards and the OpenAPI checker.
import { loadNfr } from "../src/nfr.js";
import { loadRequirements } from "../src/requirements.js";
import { checkOpenApi, coverageTable, loadOpenApi } from "../src/openapi-check.js";
import { isIsoDate } from "../src/standards.js";
import { criteriaWeights, linksHub, linksPointToPoint, loadStrategyData, scoreOptions, sensitivityAll } from "../src/strategy.js";

export function collect() {
  const data = loadStrategyData();
  const weights = criteriaWeights(loadNfr(), data.priorities, data.constraints);
  const ranking = scoreOptions(data.options, weights);
  const rankOf = (id) => ranking.find((r) => r.id === id);
  const sens = sensitivityAll(data.options, weights);
  const closest = [...sens].sort((a, b) => a.marginAfter - b.marginAfter)[0];
  const doc = loadOpenApi();
  const must = coverageTable(doc, loadRequirements()).filter((r) => r.priority === "Must");
  const n = data.scenario.systems;
  return {
    // finding 1: the combination ranks first
    winner: ranking[0].id, winnerTotal: ranking[0].total, margin: ranking[0].total - ranking[1].total, runnerUp: ranking[1].id,
    // finding 2: point-to-point needs too many links
    systems: n, linksP2P: linksPointToPoint(n), linksHub: linksHub(n),
    p2pMaintainability: data.options.find((o) => o.id === "point-to-point").ratings.maintainability,
    // finding 3: no single doubled weight changes the winner
    changes: sens.filter((s) => s.changed).length, sensitivityCount: sens.length, closest: closest.criterion, closestMargin: closest.marginAfter,
    // claim 4: an ESB is the best for 3 services
    esbRank: rankOf("esb").rank, esbTotal: rankOf("esb").total, esbCost: data.options.find((o) => o.id === "esb").ratings.cost,
    // claim 5: dates as dd/mm/yyyy
    ddmmyyyy: isIsoDate("04/03/2027"), iso: isIsoDate("2027-03-04"),
    // claim 6: the API file covers every Must requirement
    openApiProblems: checkOpenApi(doc).length, mustCount: must.length, mustCovered: must.filter((r) => r.served.length || r.internal).length,
  };
}
