// The planner end to end, with FAKE outside services and a fixed "today", so the output is always the same.
// Real services (Student Affairs, Finance, Facilities), the real gateway, the real queue and notifier.   Run:  npm run plan-demo
import { createNotifier, TOPIC } from "./src/notifier.js";
import { createQueue } from "./src/queue.js";
import { send, start } from "./src/serve.js";
import { createClients } from "./src/gateway/clients.js";
import { createFakeExternal } from "./src/gateway/fakes.js";
import { planEvent } from "./src/gateway/plan.js";
import { createPlannerApp } from "./src/gateway/server.js";
import { draftPlan } from "./review/draft-plan.js";
import { createFacilitiesApp } from "./src/services/facilities.js";
import { createFinanceApp } from "./src/services/finance.js";
import { createStudentAffairsApp } from "./src/services/student-affairs.js";

const TODAY = "2027-02-20";
const apps = { studentAffairs: await start(createStudentAffairsApp()), finance: await start(createFinanceApp()), facilities: await start(createFacilitiesApp()) };
const services = Object.fromEntries(Object.entries(apps).map(([name, app]) => [name, app.url]));
const clients = createClients(services);

const queue = createQueue();
const mails = [];
queue.subscribe(TOPIC, createNotifier({ send: async ({ to, subject }) => void mails.push(`mail to ${to}: ${subject}`) }));

const show = (a) => {
  console.log(`${a.requestNo}  ${a.decision.toUpperCase()}   (status in Student Affairs: ${a.status})`);
  for (const [name, check] of Object.entries(a.checks)) console.log(`  ${name.padEnd(8)} ${check.status.padEnd(8)} ${check.reasons[0]}`);
};

console.log(`PART 1  planEvent with fake outside services, today = ${TODAY}`);
const external = createFakeExternal({ today: TODAY });
for (const requestNo of ["EVT-0001", "EVT-0002", "EVT-0008"]) show(await planEvent(requestNo, { clients, external, queue, today: TODAY }));

console.log("");
console.log("PART 2  the holiday service is down (FR-12)");
const outage = createFakeExternal({ today: TODAY, down: ["holiday"] });
show(await planEvent("EVT-0003", { clients, external: outage, queue, today: TODAY }));

console.log("");
console.log("PART 3  the same process through the gateway");
const gateway = await start(createPlannerApp({ services, external, queue, today: TODAY }));
const quizNight = { title: "Quiz Night", organization: "Math Club", date: "2027-05-20", venue: "Lab A", attendees: 35, budget: { amount: 1200, currency: "PHP" }, contactEmail: "math@campus.example" };
const created = await send(gateway.url, "/api/requests", { method: "POST", body: quizNight });
console.log(`POST /api/requests  ->  ${created.status}   Location: ${created.headers.get("location")}`);
console.log(`  decision ${created.body.decision}: ${created.body.reasons.join(" ")}`);
const bad = await send(gateway.url, "/api/requests", { method: "POST", body: { title: "Quiz Night", date: "2027-05-20" } });
console.log(`POST /api/requests  ->  ${bad.status}   missing: ${bad.body.error.missing.join(", ")}`);
const stored = await send(gateway.url, created.headers.get("location"));
console.log(`GET  ${created.headers.get("location")}  ->  ${stored.status}   decision ${stored.body.decision}`);
const none = await send(gateway.url, "/api/requests/EVT-0003/assessment");
console.log(`GET  /api/requests/EVT-0003/assessment  ->  ${none.status}   ${none.body.error.code}`);

console.log("");
console.log("PART 4  the queue delivers the notices (the planner did not wait for them)");
await queue.drain();
for (const line of mails) console.log(line);

console.log("");
console.log("PART 5  four checks in parallel, or one after another (fake delays: 60, 80, 100, 120 ms)");
const slow = () => createFakeExternal({ today: TODAY, delayMs: { holiday: 60, forecast: 100, convert: 120 } });
const slowClients = { ...clients, availability: async (q) => (await new Promise((r) => setTimeout(r, 80)), clients.availability(q)) };
async function timed(run) {
  const t0 = performance.now();
  await run();
  return Math.round(performance.now() - t0);
}
const parallelMs = await timed(() => planEvent("EVT-0008", { clients: slowClients, external: slow(), queue, today: TODAY }));
const oneByOneMs = await timed(() => draftPlan("EVT-0008", { clients: slowClients, external: slow(), today: TODAY }));
console.log(`planEvent (Promise.all)      ${parallelMs} ms`);
console.log(`one after another (the draft) ${oneByOneMs} ms`);

await queue.drain();
await Promise.all([gateway, ...Object.values(apps)].map((a) => a.close()));
