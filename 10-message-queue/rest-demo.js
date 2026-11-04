// Call the three services the way a client does: a request, then the status, the headers that matter, and the JSON.
// It starts the services on free ports, so it works even when start-services.js is not running.   Run:  npm run demo:rest
import { send, start } from "./src/serve.js";
import { createFacilitiesApp } from "./src/services/facilities.js";
import { createFinanceApp } from "./src/services/finance.js";
import { createStudentAffairsApp } from "./src/services/student-affairs.js";

const apps = {
  affairs: await start(createStudentAffairsApp()),
  finance: await start(createFinanceApp()),
  facilities: await start(createFacilitiesApp()),
};

const quizNight = { title: "Quiz Night", organization: "Math Club", date: "2027-05-20", venue: "Lab A", attendees: 35, budget: { amount: 1200, currency: "PHP" }, contactEmail: "math@campus.example" };

async function call(service, path, options = {}) {
  const { method = "GET" } = options;
  const res = await send(apps[service].url, path, options);
  console.log(`${method.padEnd(6)} ${path}  ->  ${res.status}`);
  const location = res.headers.get("location");
  if (location) console.log(`       Location: ${location}`);
  if (res.body) console.log(`       ${JSON.stringify(res.body)}`);
}

await call("affairs", "/requests/EVT-0001");
await call("affairs", "/requests", { method: "POST", body: quizNight });
await call("affairs", "/requests", { method: "POST", body: { title: "Quiz Night", date: "2027-05-20" } });
await call("affairs", "/requests/EVT-9999");
await call("affairs", "/requests/EVT-0009", { method: "DELETE" });
await call("finance", "/deposits/EVT-0004");
await call("facilities", "/venues/room-101/availability?date=2027-11-22&attendees=80");
await call("facilities", "/reservations", { method: "POST", body: { requestNo: "EVT-0003", venueId: "gym", date: "2027-03-05", hours: 3 } });

await Promise.all(Object.values(apps).map((a) => a.close()));
