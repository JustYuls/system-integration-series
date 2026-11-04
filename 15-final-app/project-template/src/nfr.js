// Non-functional requirements: load them, check their quality, and compare targets with measured values.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
export const loadNfr = () => JSON.parse(readFileSync(path.join(docs, "nfr.json"), "utf8")).nonFunctional;

export const CATEGORIES = ["performance", "availability", "reliability", "security", "usability", "interoperability", "maintainability", "capacity"];
export const COMPARISONS = ["<=", ">=", "="];

// Words that sound good but cannot be tested. They are allowed only next to a number.
export const VAGUE = ["fast", "faster", "quick", "quickly", "user-friendly", "easy", "robust", "scalable", "secure", "reliable", "flexible", "efficient", "intuitive"];

// A whole word (a hyphen is part of a word, so "user-friendly" is one word).
const hasWord = (text, word) => new RegExp(`(^|[^\\w-])${word}([^\\w-]|$)`, "i").test(text);

// Every problem is a short text. An empty list means the requirement is well written.
export function checkNfr(nfr) {
  const found = [];
  const text = (v) => typeof v === "string" && v.trim().length > 0;
  if (!/^NFR-\d\d$/.test(nfr.id ?? "")) found.push("the id must look like NFR-01");
  if (!CATEGORIES.includes(nfr.category)) found.push(`the category "${nfr.category}" is not in the list`);
  if (!text(nfr.statement)) found.push("has no statement");
  else {
    if (!/\bshall\b/.test(nfr.statement)) found.push('the statement must say "shall"');
    const vague = VAGUE.find((w) => hasWord(nfr.statement, w));
    const noNumber = !/\d/.test(nfr.statement);
    if (vague && noNumber) found.push(`uses the vague word "${vague}" with no number`);
  }
  if (!text(nfr.metric)) found.push("has no metric: what do we count?");
  const t = nfr.target;
  if (typeof t?.value !== "number" || Number.isNaN(t.value)) found.push("the target needs a number");
  if (!text(t?.unit)) found.push("the target needs a unit");
  if (!COMPARISONS.includes(t?.comparison)) found.push('the target needs a comparison: "<=", ">=" or "="');
  if (!text(nfr.measure)) found.push("has no measure: how do we verify it?");
  return found;
}

// Problems of the whole list: each one is { id, problem }.
export function checkAll(nfrs) {
  const found = [];
  const seen = new Set();
  for (const n of nfrs) {
    for (const problem of checkNfr(n)) found.push({ id: n.id, problem });
    if (seen.has(n.id)) found.push({ id: n.id, problem: "the id is used twice" });
    seen.add(n.id);
  }
  return found;
}

export function categoriesCovered(nfrs) {
  const covered = CATEGORIES.filter((c) => nfrs.some((n) => n.category === c));
  return { covered, missing: CATEGORIES.filter((c) => !covered.includes(c)) };
}

// Does a measured value meet the target?
export function meets(target, measured) {
  if (target.comparison === "<=") return measured <= target.value;
  if (target.comparison === ">=") return measured >= target.value;
  return measured === target.value;
}

// measurements: { "NFR-01": 1760, ... }. Each result is { id, target, measured, status } with the status
// "pass", "fail" or "not measured" (a requirement with no number yet is not a pass).
export function evaluate(nfrs, measurements) {
  return nfrs.map((n) => {
    const measured = measurements[n.id];
    const status = measured === undefined ? "not measured" : meets(n.target, measured) ? "pass" : "fail";
    return { id: n.id, target: `${n.target.comparison} ${n.target.value} ${n.target.unit}`, measured, status };
  });
}

// How many requests per minute does a crowd create? (people x share who ask) / minutes
export const requestsPerMinute = (students, share, minutes) => Math.ceil((students * share) / minutes);

// The document docs/nfr.md.
export function renderNfrDoc(nfrs) {
  const lines = ["# Non-functional requirements", "", "How well the system must do its job. Each one has a number and a way to check it.", "",
    "| ID | Category | Target | Metric |", "|---|---|---|---|"];
  for (const n of nfrs) lines.push(`| ${n.id} | ${n.category} | ${n.target.comparison} ${n.target.value} ${n.target.unit} | ${n.metric} |`);
  for (const n of nfrs) lines.push("", `## ${n.id} ${n.category}`, "", n.statement, "", `- **Metric:** ${n.metric}`, `- **Target:** ${n.target.comparison} ${n.target.value} ${n.target.unit}`, `- **Measure:** ${n.measure}`);
  return lines.join("\n") + "\n";
}
