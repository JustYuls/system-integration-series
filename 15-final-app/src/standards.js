// The standards of the project, and small validators for the ones a program can check.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
export const loadStandards = () => JSON.parse(readFileSync(path.join(docs, "standards.json"), "utf8")).standards;

// ISO 8601 date: 2027-03-04. The text must be a real calendar day (no 2027-02-30).
export function isIsoDate(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(text + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

// ISO 4217: three capital letters. We accept the codes this project may meet.
export const CURRENCIES = ["PHP", "USD", "EUR", "JPY", "GBP", "AUD", "SGD", "CNY", "KRW", "HKD", "CAD", "CHF"];
export const isCurrencyCode = (text) => typeof text === "string" && CURRENCIES.includes(text);

// The one error format: { "error": { "code": "NOT_FOUND", "message": "..." } }
export function isErrorBody(body) {
  const e = body?.error;
  return Object.keys(body ?? {}).length === 1 && typeof e?.code === "string" && /^[A-Z][A-Z_]*$/.test(e.code)
    && typeof e?.message === "string" && e.message.length > 0;
}

// Walk a JSON value and report every date and money value that breaks a convention.
function walk(value, where, problems) {
  if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${where}[${i}]`, problems));
  if (value === null || typeof value !== "object") return;
  if ("amount" in value && "currency" in value && !isCurrencyCode(value.currency)) problems.push(`${where}.currency "${value.currency}" is not an ISO 4217 code`);
  for (const [k, v] of Object.entries(value)) {
    // a field called date, or ending in Date, must hold a date
    if (/^date$|Date$/.test(k) && typeof v === "string" && !isIsoDate(v)) problems.push(`${where}.${k} "${v}" is not an ISO 8601 date`);
    walk(v, `${where}.${k}`, problems);
  }
}

// A response { status, headers, body } is checked against the conventions. An empty list means it follows them.
export function checkEnvelope(response) {
  const problems = [];
  const type = String(response.headers?.["content-type"] ?? "").toLowerCase();
  if (!type.startsWith("application/json")) problems.push(`content type "${type || "none"}" is not application/json`);
  if (type.includes("charset") && !type.includes("utf-8")) problems.push("the charset is not utf-8");
  if (response.status >= 400 && !isErrorBody(response.body)) problems.push("an error response must use the error format");
  walk(response.body, "body", problems);
  return problems;
}
