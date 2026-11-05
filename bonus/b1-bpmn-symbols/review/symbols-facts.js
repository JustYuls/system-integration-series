// Facts for the AI review: what an AI assistant said about BPMN symbols, decided by the catalog, the checker and the simulator.
import { check, simulate } from "../src/bpmn.js";
import { readExample } from "../src/examples.js";
import { bySymbol, catalog } from "../src/symbols.js";

export function collect() {
  // Findings 1 and 2: the circle rule, read from the catalog
  const thick = catalog.filter((s) => s.shape === "thick circle");
  const double = catalog.filter((s) => s.shape === "double circle");
  const isEnd = (s) => s.id.startsWith("end-");
  const isMiddle = (s) => s.id.startsWith("intermediate-");
  const thickAreEnds = thick.length > 0 && thick.every(isEnd);
  const doubleAreIntermediate = double.length > 0 && double.every(isMiddle);

  // Finding 3: the checker on the broken order
  const problems = check(readExample("broken-order"));
  const rules = problems.map((p) => `${p.rule}:${p.id}`);

  // Claims: the catalog and the simulator
  const exclusiveMarker = bySymbol("exclusive-gateway").marker;
  const messageFlowScope = bySymbol("message-flow").scope;
  const order = readExample("online-order");
  const yes = simulate(order, { G3: "Yes" });
  const parallelRanAll = ["T02", "T03"].every((id) => yes.includes(id));

  return {
    thickAreEnds,
    doubleAreIntermediate,
    brokenRules: rules,
    deadEnd: rules.includes("reaches-end:T07"),
    noSplit: rules.includes("gateway-shape:G3"),
    noLane: rules.includes("lane:T04"),
    exclusiveMarker,
    messageFlowScope,
    yesPath: yes,
    parallelRanAll,
    joinRanOnce: yes.filter((id) => id === "G2").length === 1,
  };
}
