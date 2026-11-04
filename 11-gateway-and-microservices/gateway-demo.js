// Demo: the three services and the gateway on free ports. Calls go through the gateway; then one service is
// stopped (502) and another is made slow (504).   Run:  node gateway-demo.js
import express from "express";
import { createAccessLog } from "./src/gateway/logger.js";
import { createGateway } from "./src/gateway/gateway.js";
import { send, start } from "./src/serve.js";
import { createFacilitiesApp } from "./src/services/facilities.js";
import { createFinanceApp } from "./src/services/finance.js";
import { createStudentAffairsApp } from "./src/services/student-affairs.js";

const TIMEOUT_MS = 1000;

// Facilities behind a switch: when slow is true, every call waits 4 seconds before the real service answers.
let slow = false;
const facilities = express();
facilities.use((req, res, next) => (slow ? setTimeout(next, 4000) : next()));
facilities.use(createFacilitiesApp());

const studentAffairs = await start(createStudentAffairsApp());
const finance = await start(createFinanceApp());
const facilitiesServer = await start(facilities);
const gateway = await start(createGateway({
  services: { studentAffairs: studentAffairs.url, finance: finance.url, facilities: facilitiesServer.url },
  timeoutMs: TIMEOUT_MS,
  log: createAccessLog(() => {}), // the access log is shown in the README; here it stays quiet
}));

async function call(method, path, body) {
  const res = await send(gateway.url, path, { method, body });
  const id = res.headers.get("x-request-id");
  console.log(`${method.padEnd(4)} ${path}  ->  ${res.status}`);
  return { ...res, id };
}

const newRequest = { title: "Quiz Night", organization: "Math Club", date: "2027-05-20", venue: "Lab A", attendees: 35, budget: { amount: 1200, currency: "PHP" }, contactEmail: "math@campus.test" };

console.log("--- everything is up");
const first = await call("GET", "/api/student-affairs/requests/EVT-0001");
console.log(`     X-Request-Id: ${first.id}   (made by the gateway: ${first.id.length} characters)`);
const created = await call("POST", "/api/student-affairs/requests", newRequest);
console.log(`     Location: ${created.headers.get("location")}`);
await call("GET", "/api/finance/deposits/EVT-0004");
await call("GET", "/api/facilities/venues/gym");
const bad = await call("POST", "/api/student-affairs/requests", {});
console.log(`     the service said: ${bad.body.error.code}`);
console.log("GET  /health  ->  " + JSON.stringify((await send(gateway.url, "/health")).body));

console.log("--- Finance is stopped");
await finance.close();
const down = await call("GET", "/api/finance/deposits/EVT-0004");
console.log(`     ${down.body.error.code}: ${down.body.error.message}`);
console.log("GET  /health  ->  " + JSON.stringify((await send(gateway.url, "/health")).body));

console.log(`--- Facilities becomes slow (the gateway waits ${TIMEOUT_MS} ms)`);
slow = true;
const started = Date.now();
const late = await call("GET", "/api/facilities/venues/gym");
console.log(`     ${late.body.error.code}: ${late.body.error.message}   (waited ${Date.now() - started >= TIMEOUT_MS ? "the full limit" : "too little"}, not 4000 ms)`);
console.log("GET  /health  ->  " + JSON.stringify((await send(gateway.url, "/health")).body));

await gateway.close();
await studentAffairs.close();
await facilitiesServer.close();

// The slow request of the demo still has a timer running: leave now instead of waiting for it.
process.exit(0);
