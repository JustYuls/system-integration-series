// One adapter per silo. Each reads its own format and returns the same shape: the canonical record.
//
// Canonical record (only the keys a system knows):
//   requestNo, title, organization, date, status, balancePhp, hours, penaltyPhp
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "data");

// "EVT0001" and "EVT-0001" are the same request. The canonical form is EVT-NNNN.
export function normalizeId(raw) {
  const match = /^EVT-?(\d{4})$/i.exec(String(raw).trim());
  if (!match) throw new Error(`not a request number: ${raw}`);
  return `EVT-${match[1]}`;
}

// "ORIENTATION DAY" -> "Orientation Day"
export function normalizeTitle(raw) {
  return raw.trim().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

// Returns "YYYY-MM-DD". order is "MDY" (month first), "DMY" (day first) or "ISO".
export function parseDate(text, order) {
  const parts = text.trim().split(order === "ISO" ? "-" : "/").map(Number);
  const [y, m, d] = order === "ISO" ? parts : order === "MDY" ? [parts[2], parts[0], parts[1]] : [parts[2], parts[1], parts[0]];
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    throw new Error(`not a date in ${order} order: ${text}`);
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Student Affairs: CSV. Dates are month/day/year.
export function readStudentAffairs({ file = path.join(DATA, "student-affairs.csv"), order = "MDY" } = {}) {
  const [header, ...rows] = readFileSync(file, "utf8").trim().split(/\r?\n/);
  const names = header.split(",");
  return rows.map((line) => {
    const cell = Object.fromEntries(line.split(",").map((value, i) => [names[i], value]));
    return {
      requestNo: normalizeId(cell.request_no),
      title: normalizeTitle(cell.title),
      organization: cell.organization,
      date: parseDate(cell.event_date, order),
      status: cell.status,
    };
  });
}

// Finance: JSON. Ids have no dash, titles are in capitals, money is a number of pesos still unpaid.
export function readFinance({ file = path.join(DATA, "finance.json") } = {}) {
  const { deposits } = JSON.parse(readFileSync(file, "utf8"));
  return deposits.map((d) => ({ requestNo: normalizeId(d.ref), title: normalizeTitle(d.title), balancePhp: Number(d.balance) }));
}

// Facilities: XML. Dates are ISO (year-month-day). One element per booking, so duplicates are possible.
export function readFacilities({ file = path.join(DATA, "facilities.xml") } = {}) {
  const xml = readFileSync(file, "utf8");
  const tag = (body, name) => new RegExp(`<${name}>(.*?)</${name}>`).exec(body)[1];
  return [...xml.matchAll(/<reservation request="([^"]+)">(.*?)<\/reservation>/g)].map(([, request, body]) => ({
    requestNo: normalizeId(request),
    title: normalizeTitle(tag(body, "title")),
    date: parseDate(tag(body, "date"), "ISO"),
    venue: tag(body, "venue"),
    hours: Number(tag(body, "hours")),
    penaltyPhp: Number(tag(body, "penalty")),
  }));
}
