// [NFR-07] Walk EVERY operation of docs/openapi.json (the planner) and docs/openapi-services.json (the three services)
// and call it at least once. If a documented operation is missing from the tables below, or from the application,
// a test fails. The key of each row ("GET /health") is the operation as the OpenAPI file writes it: verify.js looks for it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { operations } from "../src/openapi-check.js";
import { call, newRequest, startApp } from "./ep15-support.js";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
const load = (file) => JSON.parse(readFileSync(path.join(docs, file), "utf8"));
const keysOf = (doc) => operations(doc).map((o) => `${o.verb.toUpperCase()} ${o.path}`);

// The planner API (the gateway). `at` runs the call and returns { status, headers, body }.
const PLANNER = [
  ["POST /api/requests", (a) => call(a.url, "/api/requests", { method: "POST", body: newRequest() }), 201],
  ["GET /api/requests/{requestNo}", (a) => call(a.url, "/api/requests/EVT-0001"), 200],
  ["GET /api/requests/{requestNo}/assessment", (a) => call(a.url, "/api/requests/EVT-0001/assessment", { method: "POST" }).then(() => call(a.url, "/api/requests/EVT-0001/assessment")), 200],
  ["GET /health", (a) => call(a.url, "/health"), 200],
];

// The three services, called directly (each on its own port). The calls run in this order, so later ones use earlier results.
const SERVICES = [
  ["GET /requests", "studentAffairs", (u) => call(u, "/requests"), 200],
  ["POST /requests", "studentAffairs", (u) => call(u, "/requests", { method: "POST", body: newRequest({ title: "Walk" }) }), 201],
  ["GET /requests/{requestNo}", "studentAffairs", (u) => call(u, "/requests/EVT-0001"), 200],
  ["PATCH /requests/{requestNo}", "studentAffairs", (u) => call(u, "/requests/EVT-0003", { method: "PATCH", body: { status: "On hold" } }), 200],
  ["DELETE /requests/{requestNo}", "studentAffairs", (u) => call(u, "/requests/EVT-0010", { method: "DELETE" }), 204], // the request created by the POST above (EVT-0009 came from the planner)
  ["GET /deposits/{requestNo}", "finance", (u) => call(u, "/deposits/EVT-0002"), 200],
  ["POST /deposits/{requestNo}/payments", "finance", (u) => call(u, "/deposits/EVT-0002/payments", { method: "POST", body: { amountPhp: 100 } }), 201],
  ["GET /deposits/{requestNo}/payments", "finance", (u) => call(u, "/deposits/EVT-0002/payments"), 200],
  ["GET /deposits/{requestNo}/payments/{id}", "finance", (u) => call(u, "/deposits/EVT-0002/payments/1"), 200],
  ["GET /venues", "facilities", (u) => call(u, "/venues"), 200],
  ["GET /venues/{id}", "facilities", (u) => call(u, "/venues/gym"), 200],
  ["GET /venues/{id}/availability", "facilities", (u) => call(u, "/venues/gym/availability?date=2027-03-04&attendees=100"), 200],
  ["POST /reservations", "facilities", (u) => call(u, "/reservations", { method: "POST", body: { requestNo: "EVT-0012", venueId: "lab-a", date: "2027-06-01", hours: 2 } }), 201],
  ["GET /reservations", "facilities", (u) => call(u, "/reservations"), 200],
  ["GET /reservations/{requestNo}", "facilities", (u) => call(u, "/reservations/EVT-0006"), 200],
  ["GET /health", "studentAffairs", (u) => call(u, "/health"), 200],
  ["GET /health", "finance", (u) => call(u, "/health"), 200],
  ["GET /health", "facilities", (u) => call(u, "/health"), 200],
];

describe("[NFR-07] every documented operation is called by a test", () => {
  let app;
  before(async () => (app = await startApp()));
  after(() => app.close());

  test("[NFR-07] the table of planner calls lists exactly the operations of docs/openapi.json", () => {
    assert.deepEqual(PLANNER.map((row) => row[0]).sort(), keysOf(load("openapi.json")).sort());
  });

  test("[NFR-07] the table of service calls lists exactly the operations of docs/openapi-services.json", () => {
    const keys = [...new Set(SERVICES.map((row) => row[0]))].sort();
    assert.deepEqual(keys, [...new Set(keysOf(load("openapi-services.json")))].sort());
  });

  const planner = operations(load("openapi.json"));
  for (const [key, run, expected] of PLANNER) {
    test(`[NFR-07] planner: ${key} answers ${expected}, a status the OpenAPI file documents`, async () => {
      const res = await run(app);
      assert.equal(res.status, expected);
      const [verb, p] = key.split(" ");
      const op = planner.find((o) => o.verb === verb.toLowerCase() && o.path === p);
      assert.ok(String(res.status) in op.op.responses, `${res.status} is not documented for ${key}`);
    });
  }

  const services = operations(load("openapi-services.json"));
  for (const [key, name, run, expected] of SERVICES) {
    test(`[NFR-07] ${name}: ${key} answers ${expected}, a status the OpenAPI file documents`, async () => {
      const res = await run(app.services[name]);
      assert.equal(res.status, expected);
      const [verb, p] = key.split(" ");
      const op = services.find((o) => o.verb === verb.toLowerCase() && o.path === p);
      assert.ok(String(res.status) in op.op.responses, `${res.status} is not documented for ${key}`);
    });
  }
});
