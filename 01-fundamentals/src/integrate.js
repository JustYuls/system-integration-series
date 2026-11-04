// Combine the three silos into one view of each event request. Student Affairs decides which requests exist.
import { readFacilities, readFinance, readStudentAffairs } from "./adapters.js";

export function blockReasons(request) {
  const reasons = [];
  if (request.status !== "Pending") reasons.push("on hold");
  if (request.balancePhp === null) reasons.push("no finance record");
  else if (request.balancePhp > 0) reasons.push("deposit unpaid");
  if (request.hours === null) reasons.push("no venue reserved");
  if (request.penaltyPhp > 0) reasons.push("facility penalty");
  return reasons;
}

export const canApprove = (request) => blockReasons(request).length === 0;

// complete = every system answered about this request
export const isComplete = (request) => request.balancePhp !== null && request.hours !== null && request.penaltyPhp !== null;

// Keep the first record for each request number and report the extra ones (data quality).
function firstById(records, system, issues) {
  const seen = new Map();
  for (const record of records) {
    if (seen.has(record.requestNo)) issues.push(`${record.requestNo}: duplicate record in ${system} (kept the first)`);
    else seen.set(record.requestNo, record);
  }
  return seen;
}

// Pass a list to replace a source, for example [] when that system is down.
export function integrate({ studentAffairs, finance, facilities } = {}) {
  studentAffairs ??= readStudentAffairs();
  finance ??= readFinance();
  facilities ??= readFacilities();
  const issues = [];
  const sa = firstById(studentAffairs, "student affairs", issues);
  const fin = firstById(finance, "finance", issues);
  const fac = firstById(facilities, "facilities", issues);

  const requests = {};
  for (const [no, row] of sa) {
    const request = { requestNo: no, title: row.title, organization: row.organization, date: row.date, status: row.status, balancePhp: null, hours: null, penaltyPhp: null, sources: ["student affairs"] };
    if (fin.has(no)) {
      request.balancePhp = fin.get(no).balancePhp;
      request.sources.push("finance");
    } else if (finance.length) issues.push(`${no}: no finance record`);
    if (fac.has(no)) {
      const f = fac.get(no);
      request.hours = f.hours;
      request.penaltyPhp = f.penaltyPhp;
      request.sources.push("facilities");
      if (f.date !== row.date) issues.push(`${no}: date differs (student affairs ${row.date}, facilities ${f.date})`);
    } else if (facilities.length) issues.push(`${no}: no venue reservation`);
    requests[no] = request;
  }
  for (const no of fin.keys()) if (!sa.has(no)) issues.push(`${no}: only in finance (not a registered request)`);
  for (const no of fac.keys()) if (!sa.has(no)) issues.push(`${no}: only in facilities (not a registered request)`);
  return { requests, issues: issues.sort() };
}
