// The weighted decision matrix: score each architecture option, rank them, explain the result, show the trade-offs.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
export const loadMatrix = (file = path.join(docs, "decision-matrix.json")) => JSON.parse(readFileSync(file, "utf8"));

const round2 = (n) => Math.round(n * 100) / 100;

// Problems in the matrix itself: bad weights, a missing rating, a rating outside 1..5, no reason.
export function checkMatrix(matrix, nfrCategories = null) {
  const problems = [];
  for (const c of matrix.criteria) {
    if (!Number.isInteger(c.weight) || c.weight < 1) problems.push(`${c.id}: the weight must be a whole number from 1`);
    if (c.category && nfrCategories && !nfrCategories.includes(c.category)) problems.push(`${c.id}: "${c.category}" is not an NFR category`);
  }
  for (const o of matrix.options) {
    for (const c of matrix.criteria) {
      const cell = o.ratings[c.id];
      if (!cell) problems.push(`${o.id}: no rating for ${c.id}`);
      else if (!Number.isInteger(cell.rating) || cell.rating < 1 || cell.rating > 5) problems.push(`${o.id}: the rating for ${c.id} must be 1 to 5`);
      else if (!cell.why || !cell.why.trim()) problems.push(`${o.id}: the rating for ${c.id} has no reason`);
    }
  }
  return problems;
}

// THE RULE: total = sum(weight x rating). The score on the 1..5 scale is total / sum of weights.
export function weightedScores(matrix, weights = {}) {
  const w = (c) => weights[c.id] ?? c.weight;
  const weightSum = matrix.criteria.reduce((sum, c) => sum + w(c), 0);
  return matrix.options.map((o) => {
    const parts = {};
    for (const c of matrix.criteria) parts[c.id] = w(c) * o.ratings[c.id].rating;
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    return { id: o.id, name: o.name, total, max: weightSum * 5, score: round2(total / weightSum), parts };
  });
}

// Best first. The sort is stable: with equal totals the order of the file stays.
export function ranking(matrix, weights = {}) {
  return weightedScores(matrix, weights).sort((a, b) => b.total - a.total).map((r, i) => ({ rank: i + 1, ...r }));
}

// Where the winner gets its points, and how close the race is.
export function explain(matrix, weights = {}) {
  const [first, second] = ranking(matrix, weights);
  const margin = first.total - second.total;
  const best = matrix.criteria.map((c) => [c.name, first.parts[c.id]]).sort((a, b) => b[1] - a[1])[0];
  const close = margin <= first.max * 0.05 ? " The race is close: the weights decide it." : "";
  return `${first.name} ranks first with ${first.total} of ${first.max} points (${first.score} of 5). `
    + `Next is ${second.name} with ${second.total}: the margin is ${margin}.${close} The winner's biggest contribution: ${best[0]}.`;
}

// What the winner gives up: the criteria where another option is better than the winner.
export function tradeOffs(matrix, weights = {}) {
  const [winner] = ranking(matrix, weights);
  const win = matrix.options.find((o) => o.id === winner.id);
  const result = [];
  for (const c of matrix.criteria) {
    const mine = win.ratings[c.id].rating;
    const better = matrix.options.filter((o) => o.ratings[c.id].rating > mine);
    if (better.length) {
      const top = better.sort((a, b) => b.ratings[c.id].rating - a.ratings[c.id].rating)[0];
      result.push({ criterion: c.name, winner: mine, better: top.name, betterRating: top.ratings[c.id].rating, why: win.ratings[c.id].why });
    }
  }
  return { winner: winner.name, gives: result };
}

// Double one weight and score again: does the winner change?
export function sensitivity(matrix, criterionId) {
  const c = matrix.criteria.find((x) => x.id === criterionId);
  if (!c) throw new Error(`"${criterionId}" is not a criterion`);
  const before = ranking(matrix)[0];
  const after = ranking(matrix, { [criterionId]: c.weight * 2 })[0];
  return { criterion: criterionId, before: before.id, after: after.id, changed: before.id !== after.id };
}
