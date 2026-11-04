import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadNfr } from "../src/nfr.js";
import { CRITERIA, PRIORITY_POINTS, criteriaWeights, explain, linksHub, linksPointToPoint, loadStrategyData, maxScore, scoreOptions, sensitivity, sensitivityAll } from "../src/strategy.js";

const data = loadStrategyData();
const nfrs = loadNfr();
const weights = criteriaWeights(nfrs, data.priorities, data.constraints);
const ranking = scoreOptions(data.options, weights);

describe("the strategy data", () => {
  test("there are six options and nine criteria (eight NFR categories and cost)", () => {
    assert.equal(data.options.length, 6);
    assert.equal(CRITERIA.length, 9);
  });
  test("every option rates every criterion with a whole number from 1 to 5", () => {
    for (const o of data.options) {
      for (const c of CRITERIA) assert.ok(Number.isInteger(o.ratings[c]) && o.ratings[c] >= 1 && o.ratings[c] <= 5, `${o.id} ${c}`);
    }
  });
  test("option ids are unique and the combination names two existing options", () => {
    const ids = data.options.map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const o of data.options.filter((x) => x.combination)) for (const part of o.combination) assert.ok(ids.includes(part));
  });
  test("every priority names a real NFR", () => {
    const ids = nfrs.map((n) => n.id);
    for (const id of Object.keys(data.priorities)) assert.ok(ids.includes(id));
  });
});

describe("criteriaWeights", () => {
  test("a Must NFR is worth 3 points, a Should 2, a Could 1", () => assert.deepEqual(PRIORITY_POINTS, { Must: 3, Should: 2, Could: 1 }));
  test("the weight of a category is the sum of the points of its NFRs", () => {
    const two = [{ id: "A", category: "security" }, { id: "B", category: "security" }, { id: "C", category: "capacity" }];
    const w = criteriaWeights(two, { B: "Could", C: "Should" }, { cost: { points: 4 } });
    assert.equal(w.security, 3 + 1);
    assert.equal(w.capacity, 2);
    assert.equal(w.cost, 4);
    assert.equal(w.performance, 0);
  });
  test("an NFR with no priority counts as Must", () => {
    assert.equal(criteriaWeights([{ id: "A", category: "performance" }]).performance, 3);
  });
  test("our weights follow the priorities of the NFRs", () => {
    assert.deepEqual(weights, { performance: 3, availability: 3, reliability: 3, security: 3, usability: 2, interoperability: 3, maintainability: 2, capacity: 1, cost: 3 });
  });
  test("a wrong priority is an error", () => {
    assert.throws(() => criteriaWeights([{ id: "A", category: "security" }], { A: "Urgent" }), /Must, Should or Could/);
  });
  test("an unknown category is an error", () => {
    assert.throws(() => criteriaWeights([{ id: "A", category: "beauty" }]), /not a criterion/);
  });
});

describe("scoreOptions and explain", () => {
  test("the total is the sum of rating x weight", () => {
    const hub = ranking.find((r) => r.id === "hub-and-spoke");
    assert.equal(hub.total, 94);
    assert.equal(hub.parts.security, 5 * 3);
  });
  test("the highest possible score is 5 x the sum of the weights", () => assert.equal(maxScore(weights), 115));
  test("the ranking is sorted, best first, with ranks 1 to 6", () => {
    assert.deepEqual(ranking.map((r) => r.rank), [1, 2, 3, 4, 5, 6]);
    for (let i = 1; i < ranking.length; i++) assert.ok(ranking[i - 1].total >= ranking[i].total);
  });
  test("a gateway with a queue for notifications wins, with 99 points", () => {
    assert.equal(ranking[0].id, "gateway-plus-queue");
    assert.equal(ranking[0].total, 99);
  });
  test("the order is: gateway + queue, gateway, event-driven, ESB, batch, point-to-point", () => {
    assert.deepEqual(ranking.map((r) => r.id), ["gateway-plus-queue", "hub-and-spoke", "event-driven", "esb", "batch-etl", "point-to-point"]);
  });
  test("a rating outside 1 to 5 is an error", () => {
    assert.throws(() => scoreOptions([{ id: "x", name: "x", ratings: { performance: 6 } }], { performance: 1 }), /1 to 5/);
  });
  test("explain names the winner and the margin", () => {
    const text = explain(ranking);
    assert.ok(text.startsWith("Gateway + queue for notifications ranks first with 99 of 115"));
    assert.ok(text.includes("the margin is 5 points"));
  });
  test("explain says so when two options tie", () => {
    const tie = scoreOptions([{ id: "a", name: "A", ratings: { performance: 3 } }, { id: "b", name: "B", ratings: { performance: 3 } }], { performance: 1 });
    assert.ok(explain(tie).includes("It is a tie"));
  });
  test("the NFRs choose: with the weights of an archive project, batch beats the gateway", () => {
    // a different set of needs gives a different winner: only cost and capacity matter
    const other = { performance: 0, availability: 0, reliability: 0, security: 0, usability: 0, interoperability: 0, maintainability: 0, capacity: 5, cost: 5 };
    assert.notEqual(scoreOptions(data.options, other)[0].id, "gateway-plus-queue");
  });
});

describe("sensitivity", () => {
  test("doubling the cost weight keeps the winner, with the smallest margin (2)", () => {
    const s = sensitivity(data.options, weights, "cost");
    assert.deepEqual([s.changed, s.winnerAfter, s.marginAfter], [false, "gateway-plus-queue", 2]);
  });
  test("doubling any one of the nine weights keeps the winner", () => {
    const all = sensitivityAll(data.options, weights);
    assert.equal(all.length, 9);
    assert.ok(all.every((s) => !s.changed));
  });
  test("a very large change does flip the winner: the check is able to find one", () => {
    const skewed = { ...weights, maintainability: 20 };
    const after = scoreOptions(data.options, skewed)[0].id;
    assert.notEqual(after, "gateway-plus-queue");
  });
  test("an unknown criterion is an error", () => assert.throws(() => sensitivity(data.options, weights, "beauty"), /not a criterion/));
});

describe("links", () => {
  test("6 systems need 15 point-to-point links but 6 hub links", () => {
    assert.equal(data.scenario.systems, 6);
    assert.equal(linksPointToPoint(6), 15);
    assert.equal(linksHub(6), 6);
  });
  test("10 systems need 45 links point-to-point: the growth is quadratic", () => assert.equal(linksPointToPoint(10), 45));
});
