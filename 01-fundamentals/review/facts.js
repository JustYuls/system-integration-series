// Collect the facts that the review script prints and the tests check.
import { readFileSync } from "node:fs";
import path from "node:path";
import { DATA, parseDate, readFacilities, readFinance, readStudentAffairs } from "../src/adapters.js";
import { hubAndSpoke, pointToPoint } from "../src/connections.js";
import { integrate, isComplete } from "../src/integrate.js";
import { naiveJoinByTitle } from "./flawed.js";

// Read the Student Affairs dates as day/month/year (the wrong order) and compare them with Facilities.
function wrongOrderDates(facilities) {
  const dateByRequest = Object.fromEntries(facilities.map((f) => [f.requestNo, f.date]));
  const rows = readFileSync(path.join(DATA, "student-affairs.csv"), "utf8").trim().split(/\r?\n/).slice(1);
  let errors = 0, wrong = 0, ok = 0;
  for (const line of rows) {
    const [no, , , date] = line.split(",");
    try {
      parseDate(date, "DMY") === dateByRequest[no] ? ok++ : wrong++;
    } catch {
      errors++;
    }
  }
  return { errors, wrong, ok };
}

export function collect() {
  const studentAffairs = readStudentAffairs();
  const finance = readFinance();
  const facilities = readFacilities();
  const good = integrate().requests;
  const down = integrate({ finance: [] }).requests;
  const rawIds = new Set(JSON.parse(readFileSync(path.join(DATA, "finance.json"), "utf8")).deposits.map((d) => d.ref));
  const financeIds = new Set(finance.map((f) => f.requestNo));
  const { errors, wrong, ok } = wrongOrderDates(facilities);
  const merged = naiveJoinByTitle(studentAffairs, facilities).find((r) => r.title === "General Assembly");
  return {
    requests: studentAffairs.length,
    naiveRecords: naiveJoinByTitle(studentAffairs, facilities).length,
    integratedRecords: Object.keys(good).length,
    penaltyOf0002: good["EVT-0002"].penaltyPhp,
    mergedPenalty: merged.penaltyPhp,
    sameTextTwoDates: [parseDate("03/04/2027", "MDY"), parseDate("03/04/2027", "DMY")],
    dmyErrors: errors, dmyWrongDates: wrong, dmyOk: ok,
    idsRawMatch: studentAffairs.filter((r) => rawIds.has(r.requestNo)).length,
    idsNormalizedMatch: studentAffairs.filter((r) => financeIds.has(r.requestNo)).length,
    p2p6: pointToPoint(6), hub6: hubAndSpoke(6),
    completeWhenFinanceUp: Object.values(good).filter(isComplete).length,
    completeWhenFinanceDown: Object.values(down).filter(isComplete).length,
  };
}
