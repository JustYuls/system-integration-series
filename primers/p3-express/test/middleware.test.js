import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { withApp, goodRequest } from "./helpers.js";
import { requestLogger } from "../src/app.js";
import { withServer } from "../review/express-facts.js";

test("the logger records method, path, status and milliseconds", async () => {
  const lines = [];
  await withApp({ logger: (l) => lines.push(l) }, (call) => call("GET", "/api/venues/gym"));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^GET \/api\/venues\/gym 200 \d+ms$/);
});

test("the logger sees the real status of a 404 and of a 201", async () => {
  const lines = [];
  await withApp({ logger: (l) => lines.push(l) }, async (call) => {
    await call("GET", "/api/venues/pool");
    await call("POST", "/api/requests", goodRequest);
  });
  assert.match(lines[0], / 404 /);
  assert.match(lines[1], /^POST \/api\/requests 201 /);
});

test("an unknown path gives a JSON 404 from the catch-all", () =>
  withApp({}, async (call) => {
    const r = await call("GET", "/api/nothing-here");
    assert.equal(r.status, 404);
    assert.equal(r.data.error.code, "NOT_FOUND");
    assert.match(r.data.error.message, /GET \/api\/nothing-here/);
  }));

test("a handler that throws is caught by the error handler (500, JSON)", async () => {
  // Same error handler shape as the app, on a route that always fails.
  const app = express();
  app.get("/boom", () => { throw new Error("broken"); });
  app.use((err, req, res, next) => res.status(500).json({ error: { code: "SERVER_ERROR" } }));
  await withServer(app, async (base) => {
    const res = await fetch(base + "/boom");
    assert.equal(res.status, 500);
    assert.equal((await res.json()).error.code, "SERVER_ERROR");
  });
});

test("without express.json(), req.body is undefined", async () => {
  const app = express();
  app.post("/echo", (req, res) => res.json({ type: typeof req.body }));
  await withServer(app, async (base) => {
    const res = await fetch(base + "/echo", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal((await res.json()).type, "undefined");
  });
});

test("a handler that sends two responses fails the second time", async () => {
  let secondError = null;
  const app = express();
  app.get("/twice", (req, res) => {
    res.json({ first: true });
    try { res.json({ second: true }); } catch (err) { secondError = err; }
  });
  await withServer(app, async (base) => {
    const res = await fetch(base + "/twice");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { first: true });
  });
  assert.equal(secondError.code, "ERR_HTTP_HEADERS_SENT");
});

test("requestLogger is plain middleware: it calls next()", () => {
  let called = false;
  const res = { on() {}, statusCode: 200 };
  requestLogger(() => {})({ method: "GET", path: "/" }, res, () => { called = true; });
  assert.equal(called, true);
});
