// Facts for the AI review: what an AI assistant said about the planner and its web page, decided by running the code.
import { escapeHtml, renderChecks } from "../web/render.js";
import { createStudentAffairsApp } from "../src/services/student-affairs.js";
import { createFakeClients, createFakeExternal, createInFlight } from "../src/gateway/fakes.js";
import { planEvent } from "../src/gateway/plan.js";
import { createQueue } from "../src/queue.js";
import { send, start } from "../src/serve.js";
import { draftCard } from "./draft-render.js";
import { draftPlan } from "./draft-plan.js";

const TODAY = "2027-02-20";
const EVIL = "<img src=x onerror=alert(1)>";
const noWait = () => createQueue({ sleep: async () => {} });

// Count the calls that run at the same moment, for the draft and for planEvent (an outdoor event uses all the checks).
async function inFlight(plan) {
  const tracker = createInFlight();
  const ext = createFakeExternal({ today: TODAY });
  const base = createFakeClients({ request: { outdoor: true, date: "2027-02-25" } });
  const external = { holiday: tracker.wrap(ext.holiday), forecast: tracker.wrap(ext.forecast), convert: tracker.wrap(ext.convert) };
  const clients = { ...base, availability: tracker.wrap(base.availability), deposit: tracker.wrap(base.deposit) };
  await plan("EVT-0001", { clients, external, queue: noWait(), today: TODAY });
  return tracker.max;
}

async function timed(plan) {
  const external = createFakeExternal({ today: TODAY, delayMs: { holiday: 60, forecast: 100, convert: 120 } });
  const base = createFakeClients({ request: { outdoor: true, date: "2027-02-25" } });
  const clients = { ...base, availability: async (q) => (await new Promise((r) => setTimeout(r, 80)), base.availability(q)) };
  const t0 = performance.now();
  await plan("EVT-0001", { clients, external, queue: noWait(), today: TODAY });
  return Math.round(performance.now() - t0);
}

export async function collect() {
  // Finding 1: the draft card puts the title into HTML as it is.
  const draftHtml = draftCard({ title: EVIL, decision: "returned", reasons: [`Bad title: ${EVIL}`] });
  const safeHtml = `<h2>${escapeHtml(EVIL)}</h2>` + renderChecks({ holiday: { status: "failed", reasons: [`Bad title: ${EVIL}`] } });

  // Finding 2: the holiday service does not answer. The draft approves; planEvent asks for a review.
  const down = { external: createFakeExternal({ today: TODAY, down: ["holiday"] }), clients: createFakeClients(), queue: noWait(), today: TODAY };
  const draftDecision = (await draftPlan("EVT-0001", down)).decision;
  const realDecision = (await planEvent("EVT-0001", down)).decision;

  // Finding 3: how many calls run at the same moment.
  const draftMaxInFlight = await inFlight(draftPlan);
  const realMaxInFlight = await inFlight(planEvent);

  // Claim 4: "the server already validates the title". Student Affairs accepts any text.
  const affairs = await start(createStudentAffairsApp());
  const body = { title: "<script>alert(1)</script>", organization: "X", date: "2027-05-20", venue: "Lab A", attendees: 10, budget: { amount: 100, currency: "PHP" }, contactEmail: "x@campus.example" };
  const created = await send(affairs.url, "/requests", { method: "POST", body });
  await affairs.close();

  // Claim 5: "Promise.all gives the other results when one check fails".
  const later = (value, ms) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
  let allOutcome;
  try {
    allOutcome = await Promise.all([Promise.reject(new Error("holiday service down")), later("venue ok", 20)]);
  } catch (error) {
    allOutcome = error;
  }
  const settled = await Promise.allSettled([Promise.reject(new Error("holiday service down")), later("venue ok", 20)]);

  // Claim 6: parallel checks take about as long as the slowest one. Delays: 60 + 80 + 100 + 120 = 360 ms.
  const parallelMs = await timed(planEvent);
  const sequentialMs = await timed(draftPlan);

  return {
    evil: EVIL,
    draftHtml,
    safeHtml,
    draftKeepsTag: draftHtml.includes("<img"),
    safeKeepsTag: safeHtml.includes("<img"),
    safeEscaped: safeHtml.includes("&lt;img"),
    draftDecision,
    realDecision,
    draftMaxInFlight,
    realMaxInFlight,
    createdStatus: created.status,
    storedTitle: created.body.title,
    allRejected: allOutcome instanceof Error,
    allSettledCount: settled.filter((s) => s.status === "fulfilled").length,
    parallelMs,
    sequentialMs,
    sumDelaysMs: 360,
    slowestMs: 120,
  };
}
