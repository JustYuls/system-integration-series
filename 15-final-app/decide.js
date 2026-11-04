// Print the ranking of the architecture options.   Run:  node decide.js
import { checkMatrix, explain, loadMatrix, ranking, sensitivity, tradeOffs } from "./src/matrix.js";

const matrix = loadMatrix();
const problems = checkMatrix(matrix);
if (problems.length) {
  console.log(problems.join("\n"));
  process.exit(1);
}

console.log("Weights: " + matrix.criteria.map((c) => `${c.name} ${c.weight}`).join(", "));
console.log("");
for (const r of ranking(matrix)) {
  const bar = "#".repeat(Math.round((r.total / r.max) * 40));
  console.log(`${r.rank}. ${r.name.padEnd(38)} ${String(r.total).padStart(2)} / ${r.max}  (${r.score} of 5)  ${bar}`);
}
console.log("");
console.log(explain(matrix));
const trade = tradeOffs(matrix);
console.log(`\n${trade.winner} gives up:`);
for (const t of trade.gives) console.log(`  ${t.criterion}: rated ${t.winner}, ${t.better} rated ${t.betterRating}`);
console.log("\nWhat if one weight doubles?");
for (const c of matrix.criteria) {
  const s = sensitivity(matrix, c.id);
  console.log(`  ${c.name.padEnd(30)} winner: ${s.after}${s.changed ? "   <- changes" : ""}`);
}
