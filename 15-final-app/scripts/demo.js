// The final demo: the WHOLE application on real ports (three services, gateway, queue, planner), with FAKE outside
// APIs and a fixed date, so the story is the same every time. No internet needed.   Run:  npm run demo
// It tells four stories: EVT-0001 approved, EVT-0002 returned, EVT-0008 returned (Christmas), and an outage (needs-review).
import { createNotifier, TOPIC } from "../src/notifier.js";
import { createQueue } from "../src/queue.js";
import { send, start } from "../src/serve.js";
import { createFakeExternal } from "../src/gateway/fakes.js";
import { createPlannerApp } from "../src/gateway/server.js";
import { createFacilitiesApp } from "../src/services/facilities.js";
import { createFinanceApp } from "../src/services/finance.js";
import { createStudentAffairsApp } from "../src/services/student-affairs.js";

const TODAY = "2027-02-20";

// The outside world can be switched: healthy, or with one API down. The planner never knows the difference.
let outside = createFakeExternal({ today: TODAY });
const external = {
  holiday: (...args) => outside.holiday(...args),
  forecast: (...args) => outside.forecast(...args),
  convert: (...args) => outside.convert(...args),
};

const apps = { studentAffairs: await start(createStudentAffairsApp()), finance: await start(createFinanceApp()), facilities: await start(createFacilitiesApp()) };
const services = Object.fromEntries(Object.entries(apps).map(([name, app]) => [name, app.url]));
const queue = createQueue({ sleep: async () => {} });
const mails = [];
queue.subscribe(TOPIC, createNotifier({ send: async ({ to, subject }) => void mails.push(`e-mail to ${to}: ${subject}`) }));
const gateway = await start(createPlannerApp({ services, external, queue, today: TODAY }));

const health = await send(gateway.url, "/health");
console.log(`Campus Event Planner, final demo.  today = ${TODAY}, outside APIs are fakes.`);
console.log(`gateway /health: ${health.body.status}  (${Object.entries(health.body.services).map(([k, v]) => `${k} ${v}`).join(", ")})`);

async function story(number, requestNo, heading) {
  const request = (await send(gateway.url, `/api/requests/${requestNo}`)).body;
  const answer = await send(gateway.url, `/api/requests/${requestNo}/assessment`, { method: "POST" });
  const status = (await send(gateway.url, `/api/requests/${requestNo}`)).body.status;
  console.log("");
  console.log(`STORY ${number}: ${heading}`);
  console.log(`  ${requestNo} ${request.title}, ${request.organization}, ${request.venue}, ${request.date}, ${request.attendees} people`);
  console.log(`  POST /api/requests/${requestNo}/assessment  ->  ${answer.status}`);
  console.log(`  decision ${answer.body.decision.toUpperCase()}   (status in Student Affairs: ${status})`);
  for (const [name, check] of Object.entries(answer.body.checks)) console.log(`    ${name.padEnd(8)} ${check.status.padEnd(8)} ${check.reasons.join(" ")}`);
  await queue.drain();
  console.log(`  ${mails.at(-1)}`);
}

await story(1, "EVT-0001", "everything passes");
await story(2, "EVT-0002", "an unpaid deposit and an unpaid penalty");
await story(3, "EVT-0008", "the Christmas holiday");

outside = createFakeExternal({ today: TODAY, down: ["holiday"] });
await story(4, "EVT-0003", "the holiday API is down (an outage)");
outside = createFakeExternal({ today: TODAY });

const list = (await send(gateway.url, "/api/requests")).body;
console.log("");
console.log("THE LIST  GET /api/requests");
for (const r of list.filter((x) => x.decision)) console.log(`  ${r.requestNo}  ${r.status.padEnd(9)} ${r.decision}`);
console.log(`queue: ${JSON.stringify(queue.stats())}   e-mails sent: ${mails.length}`);

await Promise.all([gateway, ...Object.values(apps)].map((a) => a.close()));
