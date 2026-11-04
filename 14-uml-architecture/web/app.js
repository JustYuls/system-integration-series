// The browser side of the planner: the form, the decision card and the list of requests.
// Text that comes from users goes in with textContent. The only innerHTML is renderChecks(), which escapes everything.
import { decisionClass, decisionLabel, renderChecks } from "./render.js";

const $ = (id) => document.getElementById(id);
const form = $("request-form");

// One call to the gateway. Returns { ok, status, body } and never throws for an HTTP error.
async function api(path, options) {
  try {
    const res = await fetch(path, options);
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

// The form becomes the JSON body of POST /api/requests. Empty fields stay empty, so the service lists them as missing.
function readForm() {
  const value = (name) => form.elements[name].value.trim();
  const body = {
    title: value("title"),
    organization: value("organization"),
    date: value("date"),
    venue: value("venue"),
    attendees: value("attendees") === "" ? "" : Number(value("attendees")),
    outdoor: form.elements.outdoor.checked,
    contactEmail: value("contactEmail"),
  };
  if (value("amount") !== "") body.budget = { amount: Number(value("amount")), currency: value("currency") };
  return body;
}

// FR-01: say which fields are missing or invalid, and keep what was typed.
const FIELD_ID = { budget: "amount" };
function showProblems(problems) {
  const names = [...(problems?.missing ?? []), ...(problems?.invalid ?? [])];
  for (const element of form.elements) element.removeAttribute?.("aria-invalid");
  const box = $("form-problems");
  box.hidden = names.length === 0;
  const missing = problems?.missing?.length ? `Missing: ${problems.missing.join(", ")}. ` : "";
  const invalid = problems?.invalid?.length ? `Please check: ${problems.invalid.join(", ")}.` : "";
  box.textContent = missing + invalid;
  for (const name of names) $(FIELD_ID[name] ?? name)?.setAttribute("aria-invalid", "true");
  if (names.length > 0) $(FIELD_ID[names[0]] ?? names[0])?.focus();
}

function showDecision(assessment, title) {
  $("decision").hidden = false;
  const badge = $("decision-badge");
  badge.textContent = decisionLabel(assessment.decision);
  badge.className = `decision ${decisionClass(assessment.decision)}`;
  $("decision-request").textContent = `${assessment.requestNo}${title ? `: ${title}` : ""}. Status in Student Affairs: ${assessment.status}.`;
  $("checks").innerHTML = renderChecks(assessment.checks); // escaped by renderChecks
  const reasons = $("reasons");
  reasons.replaceChildren();
  for (const text of assessment.reasons) {
    const item = document.createElement("li");
    item.textContent = text;
    reasons.append(item);
  }
  $("decision").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function loadRequests() {
  const { ok, body } = await api("/api/requests");
  const status = $("list-status");
  const list = $("requests");
  list.replaceChildren();
  if (!ok) {
    status.textContent = "The planner could not load the requests.";
    return;
  }
  status.textContent = `${body.length} requests`;
  for (const request of body) list.append(requestItem(request));
}

function requestItem(request) {
  const item = document.createElement("li");
  item.className = "request";
  const text = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = `${request.requestNo}  ${request.title}`;
  const meta = document.createElement("span");
  meta.className = "muted";
  meta.textContent = `${request.date}, ${request.venue}, ${request.attendees} people`;
  text.append(name, document.createElement("br"), meta);

  const badge = document.createElement("span");
  badge.className = `decision small ${decisionClass(request.decision)}`;
  badge.textContent = request.decision ? decisionLabel(request.decision) : request.status;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary";
  button.textContent = request.decision ? "Check again" : "Check now";
  button.addEventListener("click", async () => {
    button.disabled = true;
    const res = await api(`/api/requests/${encodeURIComponent(request.requestNo)}/assessment`, { method: "POST" });
    button.disabled = false;
    if (res.ok) showDecision(res.body, request.title);
    await loadRequests();
  });
  item.append(text, badge, button);
  return item;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = $("submit");
  submit.disabled = true;
  submit.textContent = "Planning...";
  const res = await api("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(readForm()) });
  submit.disabled = false;
  submit.textContent = "Send the request";
  if (res.status === 201) {
    showProblems(null);
    showDecision(res.body, $("title").value.trim());
    form.reset();
    await loadRequests();
  } else if (res.status === 400) {
    showProblems(res.body?.error);
  } else {
    const box = $("form-problems");
    box.hidden = false;
    box.textContent = "The planner is not available right now. Your answers are still in the form. Please try again.";
  }
});

loadRequests();
