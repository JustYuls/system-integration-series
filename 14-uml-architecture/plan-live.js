// The planner with the REAL outside APIs (Open-Meteo, Nager.Date, Frankfurter). Needs internet.   Run:  npm run plan-live
// The seed requests are moved to a few days from now, because a forecast reaches only 16 days ahead.
// For this demo the Field penalty and the deposit of EVT-0004 are cleared, so the outside answers decide.
import { createExternal } from "./src/external.js";
import { createQueue } from "./src/queue.js";
import { start } from "./src/serve.js";
import { seedData } from "./src/seed.js";
import { createClients } from "./src/gateway/clients.js";
import { planEvent } from "./src/gateway/plan.js";
import { createFacilitiesApp } from "./src/services/facilities.js";
import { createFinanceApp } from "./src/services/finance.js";
import { createStudentAffairsApp } from "./src/services/student-affairs.js";

const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const data = seedData();
const move = { "EVT-0001": 3, "EVT-0004": 4, "EVT-0008": 6 };
for (const r of data.requests) if (move[r.requestNo]) r.date = inDays(move[r.requestNo]);
data.venues.find((v) => v.id === "field").penaltyPhp = 0;
data.deposits.find((d) => d.requestNo === "EVT-0004").balancePhp = 0;

const apps = { studentAffairs: await start(createStudentAffairsApp(data)), finance: await start(createFinanceApp(data)), facilities: await start(createFacilitiesApp(data)) };
const clients = createClients(Object.fromEntries(Object.entries(apps).map(([k, v]) => [k, v.url])));
const external = createExternal();
const queue = createQueue();

console.log(`PLAN LIVE  today = ${today}`);
for (const requestNo of Object.keys(move)) {
  const t0 = performance.now();
  const a = await planEvent(requestNo, { clients, external, queue, today });
  const ms = Math.round(performance.now() - t0);
  console.log(`${requestNo}  ${a.decision.toUpperCase()}   (${ms} ms)`);
  for (const [name, check] of Object.entries(a.checks)) console.log(`  ${name.padEnd(8)} ${check.status.padEnd(8)} ${check.reasons[0]}`);
}
await Promise.all(Object.values(apps).map((a) => a.close()));
