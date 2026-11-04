// Facts for the AI review: a flawed process drawn by an AI, and what a BPMN engine really does.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, parseBpmn, simulate } from "../src/bpmn.js";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "process.bpmn");

// The AI draft: the weather check is a dead end, the "No" choice is missing, and a task has no lane.
export function flawedDraft(xml) {
  return xml
    .replace(/\s*<sequenceFlow id="F09"[^>]*\/>/, "")
    .replace(/\s*<sequenceFlow id="F13"[^>]*\/>/, "")
    .replace("<flowNodeRef>T05</flowNodeRef>", "");
}

export function collect() {
  const xml = readFileSync(file, "utf8");
  const real = parseBpmn(xml);
  const problems = check(parseBpmn(flawedDraft(xml)));
  const yes = simulate(real, { G3: "Yes" });
  const no = simulate(real, { G3: "No" });
  const checks = ["T02", "T03", "T04", "T05"];
  return {
    realProblems: check(real).length,
    flawedRules: problems.map((p) => `${p.rule}:${p.id}`),
    deadEnd: problems.some((p) => p.rule === "reaches-end" && p.id === "T04"),
    badGateway: problems.some((p) => p.rule === "gateway-shape" && p.id === "G3"),
    noLane: problems.some((p) => p.rule === "lane" && p.id === "T05"),
    yesPath: yes,
    noPath: no,
    exclusiveTookBoth: yes.includes("T06") && yes.includes("T08"),
    allChecksRan: checks.every((id) => yes.includes(id)),
    joinWaited: checks.every((id) => yes.indexOf(id) < yes.indexOf("G2")),
    joinRanOnce: yes.filter((id) => id === "G2").length === 1,
  };
}
