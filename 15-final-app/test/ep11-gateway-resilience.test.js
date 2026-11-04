import assert from "node:assert/strict";
import { describe, test } from "node:test";
import express from "express";
import { createGateway } from "../src/gateway/gateway.js";
import { createAccessLog } from "../src/gateway/logger.js";
import { start } from "../src/serve.js";

// A fake service with a delay that the test can change, and a record of the request ids it saw.
function createFake() {
  const state = { delayMs: 0, ids: [] };
  const app = express();
  app.use((req, res, next) => {
    state.ids.push(req.get("x-request-id"));
    setTimeout(next, state.delayMs);
  });
  app.get("/health", (req, res) => res.json({ status: "ok" }));
  app.get("/thing", (req, res) => res.json({ thing: 1 }));
  return { app, state };
}

// A URL where nothing listens: a server that was started and stopped again.
async function deadUrl() {
  const s = await start(express());
  await s.close();
  return s.url;
}

async function setup({ timeoutMs = 1500, log } = {}) {
  const fakes = [createFake(), createFake(), createFake()];
  const servers = await Promise.all(fakes.map((f) => start(f.app)));
  const urls = servers.map((s) => s.url);
  const gateway = await start(createGateway({ services: { studentAffairs: urls[0], finance: urls[1], facilities: urls[2] }, timeoutMs, log }));
  return { fakes, servers, gateway, close: async () => { await gateway.close(); for (const s of servers) await s.close(); } };
}

describe("the request id", () => {
  test("a request without an id gets a generated one, in the response", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/api/finance/thing`);
    await res.json();
    await t.close();
    assert.match(res.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
  });

  test("the generated id is also sent to the service", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/api/finance/thing`);
    await res.json();
    await t.close();
    assert.equal(t.fakes[1].state.ids[0], res.headers.get("x-request-id"));
  });

  test("an id from the caller is kept, sent on and returned", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/api/facilities/thing`, { headers: { "x-request-id": "abc-123" } });
    await res.json();
    await t.close();
    assert.equal(res.headers.get("x-request-id"), "abc-123");
    assert.equal(t.fakes[2].state.ids[0], "abc-123");
  });

  test("an id with strange characters is replaced, so it cannot reach the logs", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/api/finance/thing`, { headers: { "x-request-id": "bad id; drop table" } });
    await res.json();
    await t.close();
    assert.notEqual(res.headers.get("x-request-id"), "bad id; drop table");
    assert.match(res.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
  });

  test("two requests get two different ids", async () => {
    const t = await setup();
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const res = await fetch(`${t.gateway.url}/api/finance/thing`);
      await res.json();
      ids.push(res.headers.get("x-request-id"));
    }
    await t.close();
    assert.notEqual(ids[0], ids[1]);
  });

  test("even a 404 of the gateway carries the id, in the header and in the body", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/nowhere`);
    const body = await res.json();
    await t.close();
    assert.equal(body.error.requestId, res.headers.get("x-request-id"));
  });

  test("the access log has one line per request with the id", async () => {
    const lines = [];
    const t = await setup({ log: createAccessLog((line) => lines.push(line)) });
    const res = await fetch(`${t.gateway.url}/api/finance/thing?x=1`, { headers: { "x-request-id": "log-1" } });
    await res.json();
    await new Promise((r) => setTimeout(r, 20));
    await t.close();
    assert.equal(lines.length, 1);
    assert.match(lines[0], /^GET \/api\/finance\/thing\?x=1 -> 200 +\d+ ms +id=log-1$/);
  });
});

describe("when a service is down or slow", () => {
  test("[NFR-02] an unreachable service is a 502 BAD_GATEWAY in the error format", async () => {
    const gateway = await start(createGateway({ services: { studentAffairs: await deadUrl(), finance: await deadUrl(), facilities: await deadUrl() } }));
    const res = await fetch(`${gateway.url}/api/finance/deposits/EVT-0004`);
    const body = await res.json();
    await gateway.close();
    assert.equal(res.status, 502);
    assert.equal(body.error.code, "BAD_GATEWAY");
    assert.equal(body.error.requestId, res.headers.get("x-request-id"));
  });

  test("[NFR-02] an unreachable service answers at once, it does not hang", async () => {
    const gateway = await start(createGateway({ services: { studentAffairs: await deadUrl(), finance: await deadUrl(), facilities: await deadUrl() }, timeoutMs: 3000 }));
    const started = Date.now();
    const res = await fetch(`${gateway.url}/api/finance/x`);
    await res.json();
    const ms = Date.now() - started;
    await gateway.close();
    assert.ok(ms < 1500, `took ${ms} ms`);
  });

  test("[NFR-02] a slow service is a 504 GATEWAY_TIMEOUT after the limit", async () => {
    const t = await setup({ timeoutMs: 300 });
    t.fakes[1].state.delayMs = 1500;
    const started = Date.now();
    const res = await fetch(`${t.gateway.url}/api/finance/thing`);
    const body = await res.json();
    const ms = Date.now() - started;
    await t.close();
    assert.equal(res.status, 504);
    assert.equal(body.error.code, "GATEWAY_TIMEOUT");
    assert.ok(ms >= 290 && ms < 1200, `took ${ms} ms`);
  });

  test("[NFR-02] the other services keep answering while one is down", async () => {
    const t = await setup();
    const gateway = await start(createGateway({ services: { studentAffairs: t.servers[0].url, finance: await deadUrl(), facilities: t.servers[2].url }, timeoutMs: 1500 }));
    const results = [];
    for (const prefix of ["student-affairs", "finance", "facilities"]) {
      const res = await fetch(`${gateway.url}/api/${prefix}/thing`);
      await res.json();
      results.push(res.status);
    }
    await gateway.close();
    await t.close();
    assert.deepEqual(results, [200, 502, 200]);
  });

  test("[NFR-02] after a timeout the same service works again when it is fast", async () => {
    const t = await setup({ timeoutMs: 300 });
    t.fakes[0].state.delayMs = 1500;
    const first = await fetch(`${t.gateway.url}/api/student-affairs/thing`);
    await first.json();
    t.fakes[0].state.delayMs = 0;
    const second = await fetch(`${t.gateway.url}/api/student-affairs/thing`);
    await second.json();
    await t.close();
    assert.deepEqual([first.status, second.status], [504, 200]);
  });

  test("a service that is a little slow, but inside the limit, is not cut off", async () => {
    const t = await setup({ timeoutMs: 1500 });
    t.fakes[1].state.delayMs = 100;
    const res = await fetch(`${t.gateway.url}/api/finance/thing`);
    await res.json();
    await t.close();
    assert.equal(res.status, 200);
  });

  test("a fetch that rejects with a network error is a 502", async () => {
    const fake = async () => {
      throw new TypeError("fetch failed");
    };
    const gateway = await start(createGateway({ services: { studentAffairs: "http://x.test", finance: "http://x.test", facilities: "http://x.test" }, fetch: fake }));
    const res = await fetch(`${gateway.url}/api/finance/x`);
    await res.json();
    await gateway.close();
    assert.equal(res.status, 502);
  });

  test("an injected fetch gets an abort signal, and the gateway answers 504 when it fires", async () => {
    let signal;
    const fake = (url, init) => {
      signal = init.signal;
      return new Promise((resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    };
    const gateway = await start(createGateway({ services: { studentAffairs: "http://x.test", finance: "http://x.test", facilities: "http://x.test" }, fetch: fake, timeoutMs: 50 }));
    const res = await fetch(`${gateway.url}/api/finance/x`);
    await res.json();
    await gateway.close();
    assert.equal(res.status, 504);
    assert.equal(signal.aborted, true);
  });
});

describe("GET /health", () => {
  test("all three services up: status ok", async () => {
    const t = await setup();
    const res = await fetch(`${t.gateway.url}/health`);
    const body = await res.json();
    await t.close();
    assert.equal(res.status, 200);
    assert.deepEqual(body, { status: "ok", services: { studentAffairs: "up", finance: "up", facilities: "up" } });
  });

  test("[NFR-02] one service down: status degraded, and the gateway still answers", async () => {
    const t = await setup();
    const gateway = await start(createGateway({ services: { studentAffairs: t.servers[0].url, finance: await deadUrl(), facilities: t.servers[2].url } }));
    const res = await fetch(`${gateway.url}/health`);
    const body = await res.json();
    await gateway.close();
    await t.close();
    assert.equal(res.status, 200);
    assert.deepEqual(body, { status: "degraded", services: { studentAffairs: "up", finance: "down", facilities: "up" } });
  });

  test("[NFR-02] a slow service counts as down after the limit", async () => {
    const t = await setup({ timeoutMs: 300 });
    t.fakes[2].state.delayMs = 1500;
    const body = await (await fetch(`${t.gateway.url}/health`)).json();
    await t.close();
    assert.equal(body.status, "degraded");
    assert.equal(body.services.facilities, "down");
    assert.equal(body.services.finance, "up");
  });

  test("the three checks run at the same time, not one after the other", async () => {
    const t = await setup({ timeoutMs: 3000 });
    for (const f of t.fakes) f.state.delayMs = 500;
    const started = Date.now();
    await (await fetch(`${t.gateway.url}/health`)).json();
    const ms = Date.now() - started;
    await t.close();
    assert.ok(ms < 1100, `took ${ms} ms; three in a row would take 1500`);
  });

  test("a service that answers /health with an error status is down", async () => {
    const sick = express();
    sick.get("/health", (req, res) => res.status(503).json({ status: "sick" }));
    const server = await start(sick);
    const t = await setup();
    const gateway = await start(createGateway({ services: { studentAffairs: server.url, finance: t.servers[1].url, facilities: t.servers[2].url } }));
    const body = await (await fetch(`${gateway.url}/health`)).json();
    await gateway.close();
    await server.close();
    await t.close();
    assert.equal(body.services.studentAffairs, "down");
  });
});
