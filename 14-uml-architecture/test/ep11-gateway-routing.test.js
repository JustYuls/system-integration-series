import assert from "node:assert/strict";
import { describe, test } from "node:test";
import express from "express";
import { createGateway, ROUTES } from "../src/gateway/gateway.js";
import { start } from "../src/serve.js";

// A fake service that echoes what it receives, so the tests can see what the gateway sent on.
function createEcho() {
  const app = express();
  app.use(express.text({ type: () => true }));
  app.all("/echo/*rest", (req, res) => {
    res.set("X-Secret", "do-not-copy");
    res.json({ method: req.method, url: req.originalUrl, body: req.body || null, contentType: req.get("content-type") ?? null, accept: req.get("accept") ?? null, id: req.get("x-request-id") });
  });
  app.post("/make", (req, res) => res.status(201).location("/things/7").json({ id: 7 }));
  app.get("/nothing", (req, res) => res.status(204).end());
  app.get("/missing", (req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "no such thing" } }));
  app.get("/boom", (req, res) => res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "the service failed" } }));
  app.get("/text", (req, res) => res.type("text/plain").send("plain words"));
  return app;
}

async function setup(options = {}) {
  const echo = await start(createEcho());
  const gateway = await start(createGateway({ services: { studentAffairs: echo.url, finance: echo.url, facilities: echo.url }, ...options }));
  return { echo, gateway, close: async () => (await gateway.close(), await echo.close()) };
}

describe("the gateway forwards requests", () => {
  test("the three public prefixes are the three services", () => {
    assert.deepEqual(ROUTES, { "/api/student-affairs": "studentAffairs", "/api/finance": "finance", "/api/facilities": "facilities" });
  });

  test("each prefix goes to its own service base URL", async () => {
    const names = ["studentAffairs", "finance", "facilities"];
    const upstreams = [];
    for (const name of names) {
      const app = express();
      app.get("/who", (req, res) => res.json({ name }));
      upstreams.push(await start(app));
    }
    const gateway = await start(createGateway({ services: { studentAffairs: upstreams[0].url, finance: upstreams[1].url, facilities: upstreams[2].url } }));
    const answers = [];
    for (const prefix of ["student-affairs", "finance", "facilities"]) answers.push((await (await fetch(`${gateway.url}/api/${prefix}/who`)).json()).name);
    await gateway.close();
    for (const u of upstreams) await u.close();
    assert.deepEqual(answers, names);
  });

  test("the method, the path and the query string reach the service unchanged", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/api/finance/echo/deposits/EVT-0004?status=Pending&x=a%20b`, { method: "DELETE" });
    const body = await res.json();
    await t.close();
    assert.equal(res.status, 200);
    assert.equal(body.method, "DELETE");
    assert.equal(body.url, "/echo/deposits/EVT-0004?status=Pending&x=a%20b");
  });

  test("a JSON body and its content type reach the service exactly as sent", async () => {
    const t = await setup();
    const sent = JSON.stringify({ title: "Quiz Night", budget: { amount: 1200, currency: "PHP" } });
    const res = await fetch(`${t.gateway.url}/api/student-affairs/echo/x`, { method: "POST", headers: { "content-type": "application/json" }, body: sent });
    const body = await res.json();
    await t.close();
    assert.equal(body.body, sent);
    assert.equal(body.contentType, "application/json");
  });

  test("the Accept header is passed on", async () => {
    const t = await setup();
    const body = await (await fetch(`${t.gateway.url}/api/finance/echo/a`, { headers: { accept: "application/json" } })).json();
    await t.close();
    assert.equal(body.accept, "application/json");
  });

  test("a body that is not valid JSON is still passed on: the gateway does not judge it", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/api/student-affairs/echo/x`, { method: "POST", headers: { "content-type": "application/json" }, body: "{ not json" });
    const body = await res.json();
    await t.close();
    assert.equal(res.status, 200);
    assert.equal(body.body, "{ not json");
  });

  test("the status and the body of the service come back: 404", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/api/finance/missing`);
    const body = await res.json();
    await t.close();
    assert.equal(res.status, 404);
    assert.deepEqual(body, { error: { code: "NOT_FOUND", message: "no such thing" } });
  });

  test("a 500 of the service is a 500 of the gateway, not a 502 (the service did answer)", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/api/finance/boom`);
    const body = await res.json();
    await t.close();
    assert.equal(res.status, 500);
    assert.equal(body.error.code, "INTERNAL_ERROR");
  });

  test("Location and Content-Type are copied, and a 201 stays a 201", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/api/facilities/make`, { method: "POST" });
    await res.json();
    await t.close();
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("location"), "/things/7");
    assert.match(res.headers.get("content-type"), /application\/json/);
  });

  test("other headers of the service are not copied", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/api/finance/echo/x`);
    await res.json();
    await t.close();
    assert.equal(res.headers.get("x-secret"), null);
  });

  test("a 204 without a body works", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/api/finance/nothing`);
    const text = await res.text();
    await t.close();
    assert.equal(res.status, 204);
    assert.equal(text, "");
  });

  test("a plain text answer keeps its content type", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/api/finance/text`);
    const text = await res.text();
    await t.close();
    assert.match(res.headers.get("content-type"), /text\/plain/);
    assert.equal(text, "plain words");
  });

  test("a base URL with a slash at the end works", async () => {
    const echo = await start(createEcho());
    const gateway = await start(createGateway({ services: { studentAffairs: echo.url + "/", finance: echo.url, facilities: echo.url } }));
    const res = await fetch(`${gateway.url}/api/student-affairs/missing`);
    await res.json();
    await gateway.close();
    await echo.close();
    assert.equal(res.status, 404);
  });

  test("the fetch can be injected: no network is needed", async () => {
    const calls = [];
    const fake = async (url, init) => {
      calls.push({ url, method: init.method });
      return new Response(JSON.stringify({ fake: true }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const gateway = await start(createGateway({ services: { studentAffairs: "http://sa.test", finance: "http://fin.test", facilities: "http://fac.test" }, fetch: fake }));
    const body = await (await fetch(`${gateway.url}/api/facilities/venues?minCapacity=100`)).json();
    await gateway.close();
    assert.deepEqual(body, { fake: true });
    assert.deepEqual(calls, [{ url: "http://fac.test/venues?minCapacity=100", method: "GET" }]);
  });
});

describe("the gateway's own routes", () => {
  test("an unknown route is a JSON 404 in the error format", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/api/orders/7`);
    const body = await res.json();
    await t.close();
    assert.equal(res.status, 404);
    assert.equal(body.error.code, "NOT_FOUND");
    assert.match(res.headers.get("content-type"), /application\/json/);
  });

  test("extend(app) adds a route before the 404 handler, without editing the gateway", async () => {
    const t = await setup({ extend: (app) => app.get("/api/ping", (req, res) => res.json({ pong: true, id: req.id })) });
    const res = await fetch(`${t.gateway.url}/api/ping`);
    const body = await res.json();
    await t.close();
    assert.equal(res.status, 200);
    assert.equal(body.pong, true);
    assert.equal(body.id, res.headers.get("x-request-id"));
  });

  test("a route added by extend can use JSON bodies of its own", async () => {
    const t = await setup({ extend: (app) => app.post("/api/echo", express.json(), (req, res) => res.json(req.body)) });
    const res = await fetch(`${t.gateway.url}/api/echo`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"a":1}' });
    const body = await res.json();
    await t.close();
    assert.deepEqual(body, { a: 1 });
  });
});
