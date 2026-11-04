// Choose the integration strategy from the NFRs:  node choose-strategy.js
import { loadNfr } from "./src/nfr.js";
import { CRITERIA, criteriaWeights, explain, linksHub, linksPointToPoint, loadStrategyData, scoreOptions, sensitivityAll } from "./src/strategy.js";

const data = loadStrategyData();
const weights = criteriaWeights(loadNfr(), data.priorities, data.constraints);
const ranking = scoreOptions(data.options, weights);

console.log("Weights (points of the NFRs in each category)");
for (const c of CRITERIA) console.log(`  ${c.padEnd(16)} ${"#".repeat(weights[c])} ${weights[c]}`);

console.log("\nRanking");
for (const r of ranking) console.log(`  ${r.rank}. ${r.name.padEnd(34)} ${String(r.total).padStart(3)} of ${r.max}  ${String(r.percent).padStart(3)}%`);

console.log("\n" + explain(ranking));
const n = data.scenario.systems;
console.log(`\nLinks for ${n} systems: point-to-point ${linksPointToPoint(n)}, hub ${linksHub(n)}`);

console.log("\nSensitivity: double one weight, does the winner change?");
for (const s of sensitivityAll(data.options, weights)) {
  console.log(`  ${s.criterion.padEnd(16)} ${s.changed ? "CHANGES to " + s.winnerAfter : "same winner"}  (margin ${s.marginAfter})`);
}
