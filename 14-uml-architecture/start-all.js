// Start the whole planner: the three services, the queue with the notifier, and the gateway on port 4000.
// The outside APIs are the real ones (Open-Meteo, Nager.Date, Frankfurter), so this needs internet.   Run:  npm start
import { createExternal } from "./src/external.js";
import { createNotifier, TOPIC } from "./src/notifier.js";
import { PORTS, baseUrl } from "./src/ports.js";
import { createQueue } from "./src/queue.js";
import { createFacilitiesApp } from "./src/services/facilities.js";
import { createFinanceApp } from "./src/services/finance.js";
import { createStudentAffairsApp } from "./src/services/student-affairs.js";
import { createPlannerApp } from "./src/gateway/server.js";

function listen(name, app, port) {
  const server = app.listen(port, () => console.log(`${name.padEnd(16)} http://localhost:${port}`));
  server.on("error", (err) => {
    console.error(`${name}: cannot listen on ${port}: ${err.message}`);
    process.exit(1);
  });
}

listen("student-affairs", createStudentAffairsApp(), PORTS.studentAffairs);
listen("finance", createFinanceApp(), PORTS.finance);
listen("facilities", createFacilitiesApp(), PORTS.facilities);

// The "e-mail" is a line in the console. A real planner would call a mail server here.
const send = async ({ to, subject }) => console.log(`e-mail to ${to}: ${subject}`);
const queue = createQueue();
queue.subscribe(TOPIC, createNotifier({ send }));

const services = { studentAffairs: baseUrl("studentAffairs"), finance: baseUrl("finance"), facilities: baseUrl("facilities") };
const app = createPlannerApp({ services, external: createExternal(), queue });
listen("gateway + page", app, PORTS.gateway);
console.log("Open http://localhost:4000 in a browser.");
