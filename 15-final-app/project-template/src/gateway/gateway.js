// The API gateway: ONE entry point in front of the three services.
//   /api/customers/*  ->  customers service     /api/items/*  ->  items service     /api/accounts/*  ->  accounts service
// (Replace these three with the services of YOUR project: change ROUTES, nothing else in this file.)
// The gateway forwards, labels (X-Request-Id), and protects (timeout, 502, 504). It does NOT validate or decide:
// the services keep their own rules, so a service that is called directly still says 400 to a bad body.
import { randomUUID } from "node:crypto";
import express from "express";
import { sendError } from "../http.js";

// public prefix -> key in the `services` object
export const ROUTES = { "/api/customers": "customers", "/api/items": "items", "/api/accounts": "accounts" };

// The request id of the caller is kept when it looks sane; otherwise we make one.
const SAFE_ID = /^[\w.:-]{1,100}$/;
const requestIdOf = (req) => {
  const given = req.get("x-request-id");
  return given && SAFE_ID.test(given) ? given : randomUUID();
};

// Headers sent on to the service. Anything else stays behind.
const FORWARD = ["content-type", "accept", "authorization"];
// Headers copied back to the caller. Everything else is dropped, nothing is rewritten.
const COPY_BACK = ["content-type", "location"];

export function createGateway({ services, fetch = globalThis.fetch, timeoutMs = 3000, extend, log } = {}) {
  const app = express();
  app.disable("x-powered-by");

  // 1. Every request gets an id, and the response carries it (also errors and 404s).
  app.use((req, res, next) => {
    req.id = requestIdOf(req);
    res.set("X-Request-Id", req.id);
    if (log) {
      const started = Date.now();
      res.on("finish", () => log({ id: req.id, method: req.method, path: req.originalUrl, status: res.statusCode, ms: Date.now() - started }));
    }
    next();
  });

  // One call to a service with a time limit. A slow service is cut off by the AbortController.
  async function callService(url, init) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetch(url, { ...init, signal: controller.signal });
      const body = Buffer.from(await upstream.arrayBuffer());
      return { upstream, body };
    } catch (error) {
      error.timedOut = controller.signal.aborted;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // 2. Routing: same method, path rest, query and body. The body is passed as raw bytes, never parsed here.
  for (const [prefix, name] of Object.entries(ROUTES)) {
    app.use(prefix, express.raw({ type: () => true, limit: "1mb" }), async (req, res) => {
      const base = String(services[name]).replace(/\/+$/, "");
      const headers = { "x-request-id": req.id };
      for (const h of FORWARD) if (req.get(h)) headers[h] = req.get(h);
      const hasBody = Buffer.isBuffer(req.body) && req.body.length > 0;
      try {
        const { upstream, body } = await callService(base + req.url, { method: req.method, headers, body: hasBody ? req.body : undefined });
        for (const h of COPY_BACK) if (upstream.headers.get(h)) res.set(h, upstream.headers.get(h));
        res.status(upstream.status).send(body);
      } catch (error) {
        if (error.timedOut) return sendError(res, 504, "GATEWAY_TIMEOUT", `${name} did not answer within ${timeoutMs} ms`, { requestId: req.id });
        return sendError(res, 502, "BAD_GATEWAY", `${name} is not reachable`, { requestId: req.id });
      }
    });
  }

  // 3. Health: ask every service at the same time, each with the time limit.
  app.get("/health", async (req, res) => {
    const names = Object.keys(services);
    const answers = await Promise.all(
      names.map(async (name) => {
        try {
          const { upstream } = await callService(`${String(services[name]).replace(/\/+$/, "")}/health`, { headers: { "x-request-id": req.id } });
          return upstream.ok ? "up" : "down";
        } catch {
          return "down";
        }
      }),
    );
    const report = Object.fromEntries(names.map((name, i) => [name, answers[i]]));
    res.json({ status: answers.every((a) => a === "up") ? "ok" : "degraded", services: report });
  });

  // 4. Later episodes add their routes here, before the 404, without editing this file.
  if (extend) extend(app);

  app.use((req, res) => sendError(res, 404, "NOT_FOUND", `No route for ${req.method} ${req.path}`, { requestId: req.id }));
  app.use((err, req, res, next) => {
    if (err.status >= 400 && err.status < 500 && err.expose) return sendError(res, err.status, "BAD_REQUEST", err.message);
    console.error(`500 ${req.method} ${req.path}: ${err.message}`);
    return sendError(res, 500, "INTERNAL_ERROR", "Something went wrong in the gateway");
  });
  return app;
}
