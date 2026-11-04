import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, test } from "node:test";
import { CATEGORIES, loadNfr } from "../src/nfr.js";
import { checkMatrix, explain, loadMatrix, ranking, sensitivity, tradeOffs, weightedScores } from "../src/matrix.js";
import { criteriaWeights, loadStrategyData } from "../src/strategy.js";

const matrix = loadMatrix();

describe("docs/decision-matrix.json", () => {
  test("it compares three options on six criteria", () => {
    assert.deepEqual(matrix.options.map((o) => o.id), ["monolith", "soa-esb", "microservices-gateway"]);
    assert.deepEqual(matrix.criteria.map((c) => c.id), ["deployment", "isolation", "simplicity", "performance", "skills", "cost"]);
  });

  test("it has no problems: every rating is 1 to 5 and has a reason", () => {
    assert.deepEqual(checkMatrix(matrix, CATEGORIES), []);
  });

  test("the categories of the criteria are NFR categories of docs/nfr.json", () => {
    const used = new Set(loadNfr().map((n) => n.category));
    for (const c of matrix.criteria.filter((x) => x.category)) assert.ok(used.has(c.category), c.id);
  });

  test("the weights follow the rule of episode 6: the points of the NFR category", () => {
    const data = loadStrategyData();
    const weights = criteriaWeights(loadNfr(), data.priorities, data.constraints);
    for (const c of matrix.criteria.filter((x) => x.category)) assert.equal(c.weight, weights[c.category], c.id);
    assert.equal(matrix.criteria.find((c) => c.id === "cost").weight, weights.cost);
  });

  test("checkMatrix finds a rating outside 1 to 5, a missing rating and a missing reason", () => {
    const broken = structuredClone(matrix);
    broken.options[0].ratings.cost.rating = 6;
    delete broken.options[1].ratings.skills;
    broken.options[2].ratings.deployment.why = " ";
    const problems = checkMatrix(broken);
    assert.equal(problems.length, 3);
    assert.ok(problems.some((p) => p.includes("monolith") && p.includes("1 to 5")));
    assert.ok(problems.some((p) => p.includes("soa-esb: no rating for skills")));
    assert.ok(problems.some((p) => p.includes("no reason")));
  });

  test("checkMatrix finds a category that is not an NFR category", () => {
    const broken = structuredClone(matrix);
    broken.criteria[0].category = "happiness";
    assert.equal(checkMatrix(broken, CATEGORIES).length, 1);
  });
});

describe("scores and ranking", () => {
  test("weighted totals are the sum of weight x rating", () => {
    const totals = Object.fromEntries(weightedScores(matrix).map((s) => [s.id, s.total]));
    assert.deepEqual(totals, { monolith: 54, "soa-esb": 29, "microservices-gateway": 55 });
  });

  test("the maximum is five times the sum of the weights", () => {
    assert.equal(weightedScores(matrix)[0].max, 80);
  });

  test("the score on the 1 to 5 scale is total divided by the weights", () => {
    const s = weightedScores(matrix).find((x) => x.id === "microservices-gateway");
    assert.equal(s.score, 3.44);
  });

  test("the ranking is best first, with ranks 1 to 3", () => {
    const r = ranking(matrix);
    assert.deepEqual(r.map((x) => [x.rank, x.id]), [[1, "microservices-gateway"], [2, "monolith"], [3, "soa-esb"]]);
  });

  test("the ESB is last: it is the heaviest and the most expensive", () => {
    assert.equal(ranking(matrix).at(-1).id, "soa-esb");
  });

  test("a tie keeps the order of the file", () => {
    const tie = { criteria: [{ id: "a", name: "A", weight: 1 }], options: [{ id: "x", name: "X", ratings: { a: { rating: 3, why: "." } } }, { id: "y", name: "Y", ratings: { a: { rating: 3, why: "." } } }] };
    assert.deepEqual(ranking(tie).map((r) => r.id), ["x", "y"]);
  });

  test("a changed weight changes the scores", () => {
    const heavy = ranking(matrix, { simplicity: 8 });
    assert.equal(heavy[0].id, "monolith");
  });
});

describe("explain, trade-offs and sensitivity", () => {
  test("explain names the winner, the margin and says that the race is close", () => {
    const text = explain(matrix);
    assert.match(text, /Microservices behind an API gateway ranks first with 55 of 80/);
    assert.match(text, /the margin is 1/);
    assert.match(text, /race is close/);
    assert.match(text, /Fault isolation/);
  });

  test("tradeOffs lists what the winner gives up to the monolith", () => {
    const t = tradeOffs(matrix);
    assert.equal(t.winner, "Microservices behind an API gateway");
    assert.deepEqual(t.gives.map((g) => g.criterion), ["Simplicity for a student team", "Performance overhead", "Team skills", "Cost"]);
    assert.ok(t.gives.every((g) => g.better === "Monolith"));
  });

  test("the winner does not give up fault isolation or independent deployment", () => {
    const names = tradeOffs(matrix).gives.map((g) => g.criterion);
    assert.ok(!names.includes("Fault isolation"));
    assert.ok(!names.includes("Independent deployment"));
  });

  test("doubling the weight of fault isolation keeps the winner", () => {
    assert.deepEqual(sensitivity(matrix, "isolation"), { criterion: "isolation", before: "microservices-gateway", after: "microservices-gateway", changed: false });
  });

  test("doubling the weight of simplicity makes the monolith the winner", () => {
    const s = sensitivity(matrix, "simplicity");
    assert.equal(s.after, "monolith");
    assert.equal(s.changed, true);
  });

  test("sensitivity refuses an unknown criterion", () => {
    assert.throws(() => sensitivity(matrix, "beauty"), /not a criterion/);
  });
});

describe("decide.js", () => {
  test("it prints the real ranking", () => {
    const out = execFileSync("node", ["decide.js"], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
    assert.match(out, /1\. Microservices behind an API gateway\s+55 \/ 80 {2}\(3\.44 of 5\)/);
    assert.match(out, /2\. Monolith\s+54 \/ 80/);
    assert.match(out, /3\. SOA with an ESB\s+29 \/ 80/);
  });
});
