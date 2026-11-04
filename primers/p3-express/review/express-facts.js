// Facts that decide what an AI assistant said about Express, HTML and CSS. Each one is measured by running code.
import express from "express";
import { createApp } from "../src/app.js";
import { escapeHtml } from "../src/escape.js";

// Start an app on a free port, run `fn(base)`, close the server.
export async function withServer(app, fn) {
  const server = app.listen(0);
  try {
    return await fn(`http://localhost:${server.address().port}`);
  } finally {
    server.close();
  }
}

const json = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// A tiny app that answers with the type of req.body: does it see the JSON or not?
async function bodyType(useJsonParser) {
  const app = express();
  if (useJsonParser) app.use(express.json());
  app.post("/echo", (req, res) => res.json({ type: typeof req.body }));
  return withServer(app, async (base) => (await (await fetch(base + "/echo", json({ a: 1 }))).json()).type);
}

// The same two handlers in two orders. Does the order change the answer?
async function statusFor(catchAllFirst) {
  const app = express();
  const route = (req, res) => res.json({ ok: true });
  const catchAll = (req, res) => res.status(404).json({ error: "no route" });
  if (catchAllFirst) {
    app.use(catchAll);
    app.get("/ping", route);
  } else {
    app.get("/ping", route);
    app.use(catchAll);
  }
  return withServer(app, async (base) => (await fetch(base + "/ping")).status);
}

export async function collect() {
  const attack = '<img src=x onerror="alert(1)">';
  const unsafeHtml = `<td>${attack}</td>`;
  const safeHtml = `<td>${escapeHtml(attack)}</td>`;

  const web = await withServer(createApp(), async (base) => {
    const missing = await fetch(base + "/api/venues/pool");
    const created = await fetch(base + "/api/requests", json({ title: "Quiz Night", date: "2027-03-04", venue: "lab-a", attendees: 30 }));
    const tooMany = await fetch(base + "/api/requests", json({ title: "Quiz Night", date: "2027-03-04", venue: "lab-a", attendees: 90 }));
    const before = await (await fetch(base + "/api/requests")).json();
    await fetch(base + "/api/venues"); // a GET
    const after = await (await fetch(base + "/api/requests")).json();
    return {
      missing: { status: missing.status, code: (await missing.json()).error.code },
      created: { status: created.status, location: created.headers.get("location") },
      tooMany: { status: tooMany.status, problems: (await tooMany.json()).error.problems },
      getChangedData: before.length !== after.length,
    };
  });

  return {
    ...web,
    jsonBodyWith: await bodyType(true),
    jsonBodyWithout: await bodyType(false),
    routeFirstStatus: await statusFor(false),
    catchAllFirstStatus: await statusFor(true),
    unsafeHasRealTag: unsafeHtml.includes("<img"),
    safeHasRealTag: safeHtml.includes("<img"),
  };
}
