// Pure helpers that turn data into text or HTML. No document, no window: Node tests import this file too.

// Text from a user must never be put into HTML as it is: "<" and "&" become entities first.
const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ENTITIES[ch]);

const DECISIONS = {
  approved: "Approved",
  returned: "Returned to the organizer",
  "needs-review": "Needs a manual review",
};
export const decisionLabel = (decision) => DECISIONS[decision] ?? "Not decided";

// The CSS class is chosen from a fixed list, so the data can never inject a class name.
export const decisionClass = (decision) => (decision in DECISIONS ? decision : "none");

const CHECKS = { holiday: "Public holiday", venue: "Venue", weather: "Weather", budget: "Budget and deposit" };
const STATUSES = { passed: "Passed", failed: "Failed", unknown: "Could not check" };

// The word shown on a check: the weather of an indoor event is "Not needed" instead of "Passed".
export const statusLabel = (check) => (check.needed === false ? "Not needed" : (STATUSES[check.status] ?? "Could not check"));
const statusClass = (check) => (check.status in STATUSES ? check.status : "unknown");

// One list item for each check, in the order of the process. Every piece of data goes through escapeHtml.
export function renderChecks(checks) {
  return Object.entries(CHECKS)
    .filter(([key]) => checks?.[key])
    .map(([key, label]) => {
      const check = checks[key];
      const reasons = (check.reasons ?? []).map((r) => `<span class="reason">${escapeHtml(r)}</span>`).join("");
      return (
        `<li class="check ${statusClass(check)}">` +
        `<span class="check-name">${escapeHtml(label)}</span>` +
        `<span class="badge">${escapeHtml(statusLabel(check))}</span>` +
        `${reasons}</li>`
      );
    })
    .join("");
}
