// Start the app on a free port, call it with fetch and print what comes back.   Run:  node demo.js
import { createApp } from "./src/app.js";

const logLines = [];
const app = createApp({ logger: (line) => logLines.push(line) });
const server = app.listen(0);
const base = `http://localhost:${server.address().port}`;

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, location: res.headers.get("location"), data };
}

const show = (label, r, summary) => console.log(`${label.padEnd(36)} ${r.status}  ${summary}`);

const all = await call("GET", "/api/venues");
show("GET /api/venues", all, `${all.data.length} venues`);

const big = await call("GET", "/api/venues?minCapacity=400");
show("GET /api/venues?minCapacity=400", big, big.data.map((v) => v.id).join(", "));

const gym = await call("GET", "/api/venues/gym");
show("GET /api/venues/gym", gym, `${gym.data.name}, capacity ${gym.data.capacity}`);

const none = await call("GET", "/api/venues/pool");
show("GET /api/venues/pool", none, none.data.error.code);

const good = await call("POST", "/api/requests", { title: "Orientation Day", date: "2027-03-04", venue: "gym", attendees: 120 });
show("POST /api/requests (good)", good, `${good.data.requestNo}, Location ${good.location}`);

const bad = await call("POST", "/api/requests", { title: "", date: "2027-02-30", venue: "lab-a", attendees: 90 });
show("POST /api/requests (bad)", bad, `${bad.data.error.problems.length} problems`);
for (const p of bad.data.error.problems) console.log("  - " + p);

console.log("");
console.log("The server's own log:");
for (const line of logLines) console.log("  " + line);

server.close();
