// Facts for the AI review: what an AI assistant said about API gateways, checked against the real gateway.
// Every number here comes from starting the gateway and calling it with fetch.
import { readFileSync } from "node:fs";
import express from "express";
import { createGateway } from "../src/gateway/gateway.js";
import { start } from "../src/serve.js";
import { createFacilitiesApp } from "../src/services/facilities.js";
import { createStudentAffairsApp } from "../src/services/student-affairs.js";

// Like send() of src/serve.js, with the option to add request headers.
async function send(base, path, { method = "GET", body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(base + path, init);
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

const TIMEOUT_MS = 300;
const SLOW_MS = 1500;

export async function collect() {
  // A fake service that records what it receives and can be slow.
  const seen = [];
  const fake = express();
  fake.use((req, res, next) => {
    seen.push(req.get("x-request-id"));
    setTimeout(next, req.path === "/slow" ? SLOW_MS : 0);
  });
  fake.get("/ok", (req, res) => res.json({ ok: true }));
  fake.get("/slow", (req, res) => res.json({ ok: true }));
  const upstream = await start(fake);

  // A service that was started and stopped, so its port refuses connections.
  const gone = await start(express());
  const goneUrl = gone.url;
  await gone.close();

  const studentAffairs = await start(createStudentAffairsApp(undefined, { log: () => {} }));
  const facilities = await start(createFacilitiesApp());
  const gateway = await start(createGateway({ services: { studentAffairs: studentAffairs.url, finance: goneUrl, facilities: facilities.url }, timeoutMs: TIMEOUT_MS }));
  // A second gateway whose "student affairs" is the fake, for the request id and the timeout.
  const probe = await start(createGateway({ services: { studentAffairs: upstream.url, finance: goneUrl, facilities: facilities.url }, timeoutMs: TIMEOUT_MS }));

  try {
    // Finding 1: a request id is added, passed to the service, and returned.
    const noId = await send(probe.url, "/api/student-affairs/ok");
    const withId = await send(probe.url, "/api/student-affairs/ok", { headers: { "x-request-id": "demo-123" } });

    // Finding 2: a down service gives 502 at once, not a hang.
    let t = Date.now();
    const down = await send(gateway.url, "/api/finance/deposits/EVT-0004");
    const downMs = Date.now() - t;

    // Finding 3: a slow service gives 504 after the timeout, not after the slow answer.
    t = Date.now();
    const late = await send(probe.url, "/api/student-affairs/slow");
    const lateMs = Date.now() - t;

    // Claim 4: "the services no longer need to validate". Send an empty request directly and through the gateway.
    const direct = await send(studentAffairs.url, "/requests", { method: "POST", body: {} });
    const through = await send(gateway.url, "/api/student-affairs/requests", { method: "POST", body: {} });

    // Claim 5: "the gateway must contain the business rules". Reserve the same venue and date twice through the gateway.
    const slot = { requestNo: "EVT-0001", venueId: "lab-a", date: "2031-01-01", hours: 2 };
    const first = await send(gateway.url, "/api/facilities/reservations", { method: "POST", body: slot });
    const second = await send(gateway.url, "/api/facilities/reservations", { method: "POST", body: { ...slot, requestNo: "EVT-0003" } });
    const source = readFileSync(new URL("../src/gateway/gateway.js", import.meta.url), "utf8");
    const importsServices = /from\s+["'][^"']*services\//.test(source);

    // Claim 6: "the gateway forwards the Location header".
    const newRequest = { title: "Quiz Night", organization: "Math Club", date: "2027-05-20", venue: "Lab A", attendees: 35, budget: { amount: 1200, currency: "PHP" }, contactEmail: "math@campus.test" };
    const viaGateway = await send(gateway.url, "/api/student-affairs/requests", { method: "POST", body: newRequest });

    return {
      timeoutMs: TIMEOUT_MS, slowMs: SLOW_MS,
      generatedId: noId.headers.get("x-request-id"),
      upstreamGotGeneratedId: seen[0] === noId.headers.get("x-request-id"),
      echoedId: withId.headers.get("x-request-id"),
      upstreamGotCallerId: seen[1] === "demo-123",
      downStatus: down.status, downCode: down.body.error.code, downMs,
      lateStatus: late.status, lateCode: late.body.error.code, lateMs,
      directStatus: direct.status, throughStatus: through.status, throughCode: through.body.error.code,
      reservationStatuses: [first.status, second.status], importsServices,
      gatewayLocation: viaGateway.headers.get("location"), expectedLocation: `/requests/${viaGateway.body.requestNo}`, gatewayCreateStatus: viaGateway.status,
    };
  } finally {
    for (const s of [gateway, probe, upstream, studentAffairs, facilities]) await s.close();
  }
}
