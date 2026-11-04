// Choose an integration strategy from the non-functional requirements: weights, scores, ranking, sensitivity.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./nfr.js";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
export const loadStrategyData = (file = path.join(docs, "strategy-options.json")) => JSON.parse(readFileSync(file, "utf8"));

// The criteria are the eight NFR categories plus cost (effort to build).
export const CRITERIA = [...CATEGORIES, "cost"];
export const PRIORITY_POINTS = { Must: 3, Should: 2, Could: 1 };

// THE RULE: the weight of a category = the sum of the points of its NFRs.
// An NFR is worth 3 points (Must), 2 (Should) or 1 (Could); an NFR with no priority counts as Must.
// Cost is not an NFR: it comes from the project constraints (a fixed number of points).
export function criteriaWeights(nfrs, priorities = {}, constraints = { cost: { points: 3 } }) {
  const weights = {};
  for (const c of CRITERIA) weights[c] = 0;
  for (const n of nfrs) {
    const priority = priorities[n.id] ?? n.priority ?? "Must";
    const points = PRIORITY_POINTS[priority];
    if (points === undefined) throw new Error(`${n.id}: priority "${priority}" is not Must, Should or Could`);
    if (!(n.category in weights)) throw new Error(`${n.id}: "${n.category}" is not a criterion`);
    weights[n.category] += points;
  }
  weights.cost = constraints.cost?.points ?? 0;
  return weights;
}

export const maxScore = (weights) => 5 * Object.values(weights).reduce((a, b) => a + b, 0);

// Weighted total of each option: the sum of rating x weight. The result is ranked, best first.
export function scoreOptions(options, weights) {
  const max = maxScore(weights);
  const scored = options.map((o) => {
    const parts = {};
    for (const c of Object.keys(weights)) {
      const rating = o.ratings[c];
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error(`${o.id}: the rating for ${c} must be 1 to 5`);
      parts[c] = rating * weights[c];
    }
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    return { id: o.id, name: o.name, total, max, percent: Math.round((total * 100) / max), parts };
  });
  // sort is stable: with equal totals the order of the file stays
  return scored.sort((a, b) => b.total - a.total).map((r, i) => ({ rank: i + 1, ...r }));
}

// The text for people: the winner, the margin, and where the winner is strongest.
export function explain(ranking) {
  const [first, second] = ranking;
  const margin = first.total - second.total;
  const best = Object.entries(first.parts).sort((a, b) => b[1] - a[1])[0][0];
  const tie = margin === 0 ? " It is a tie: look at the criteria that matter most." : "";
  return `${first.name} ranks first with ${first.total} of ${first.max} points (${first.percent} percent). `
    + `The next one, ${second.name}, has ${second.total}: the margin is ${margin} points.${tie} The biggest contribution comes from ${best}.`;
}

// Double one weight and score again. Does the winner change?
export function sensitivity(options, weights, criterion) {
  if (!(criterion in weights)) throw new Error(`"${criterion}" is not a criterion`);
  const before = scoreOptions(options, weights);
  const after = scoreOptions(options, { ...weights, [criterion]: weights[criterion] * 2 });
  return {
    criterion, winnerBefore: before[0].id, winnerAfter: after[0].id,
    changed: before[0].id !== after[0].id, marginAfter: after[0].total - after[1].total,
  };
}

export const sensitivityAll = (options, weights) => Object.keys(weights).map((c) => sensitivity(options, weights, c));

// How many links are needed for n systems? Point-to-point: every pair. A hub: one for each system.
export const linksPointToPoint = (n) => (n * (n - 1)) / 2;
export const linksHub = (n) => n;
