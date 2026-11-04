// Try the standards validators on a few values:  node check-standards.js
import { checkEnvelope, isCurrencyCode, isErrorBody, isIsoDate, loadStandards } from "./src/standards.js";

const list = loadStandards();
console.log(`${list.length} standards and practices (${list.filter((s) => s.kind === "standard").length} standards, ${list.filter((s) => s.kind === "practice").length} practices)`);
for (const s of list) console.log(`  ${s.id}  ${s.name}`);

const show = (label, value, ok) => console.log(`  ${label.padEnd(15)} ${String(value).padEnd(14)} ${ok ? "ok" : "REJECTED"}`);
console.log("\nValidators");
for (const v of ["2027-03-04", "04/03/2027", "2027-02-30"]) show("isIsoDate", v, isIsoDate(v));
for (const v of ["PHP", "USD", "peso"]) show("isCurrencyCode", v, isCurrencyCode(v));
show("isErrorBody", "plain text", isErrorBody({ error: "not found" }));
show("isErrorBody", "error format", isErrorBody({ error: { code: "NOT_FOUND", message: "No request EVT-0099" } }));

const good = { status: 200, headers: { "content-type": "application/json; charset=utf-8" }, body: { requestNo: "EVT-0004", date: "2027-07-30", budget: { amount: 500, currency: "USD" } } };
const bad = { status: 200, headers: { "content-type": "text/html" }, body: { requestNo: "EVT-0004", date: "30/07/2027", budget: { amount: 500, currency: "dollars" } } };
console.log("\ncheckEnvelope: a good response");
console.log("  " + (checkEnvelope(good).join("; ") || "no problems"));
console.log("checkEnvelope: a bad response");
for (const p of checkEnvelope(bad)) console.log("  " + p);
