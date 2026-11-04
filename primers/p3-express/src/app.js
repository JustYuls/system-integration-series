import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateRequest } from "./validate.js";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));
const defaultVenues = JSON.parse(readFileSync(new URL("../data/venues.json", import.meta.url), "utf-8"));

// Middleware: runs for every request, then passes it on with next().
export function requestLogger(log) {
  return (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  };
}

export function notFound(code, message) {
  return { error: { code, message } };
}

export function createApp({ venues = defaultVenues, logger = () => {} } = {}) {
  const app = express();
  const requests = []; // kept in memory: gone when the server stops

  app.use(requestLogger(logger));
  app.use(express.json());
  app.use(express.static(publicDir));

  app.get("/api/venues", (req, res) => {
    const min = Number(req.query.minCapacity ?? 0);
    res.json(venues.filter((v) => v.capacity >= min));
  });

  app.get("/api/venues/:id", (req, res) => {
    const venue = venues.find((v) => v.id === req.params.id);
    if (!venue) {
      return res.status(404).json(notFound("NOT_FOUND", `No venue with id '${req.params.id}'`));
    }
    res.json(venue);
  });

  app.get("/api/requests", (req, res) => {
    res.json(requests);
  });

  app.get("/api/requests/:requestNo", (req, res) => {
    const found = requests.find((r) => r.requestNo === req.params.requestNo);
    if (!found) {
      return res.status(404).json(notFound("NOT_FOUND", `No request '${req.params.requestNo}'`));
    }
    res.json(found);
  });

  app.post("/api/requests", (req, res) => {
    const problems = validateRequest(req.body, venues);
    if (problems.length > 0) {
      return res.status(400).json({
        error: { code: "VALIDATION", message: "The request has problems", problems },
      });
    }
    const { title, date, venue, attendees } = req.body;
    const requestNo = "EVT-" + String(requests.length + 1).padStart(4, "0");
    const created = { requestNo, title: title.trim(), date, venue, attendees, status: "Pending" };
    requests.push(created);
    res.status(201).location(`/api/requests/${requestNo}`).json(created);
  });

  // Nothing above matched: 404. Four arguments mark the error handler. Both go last.
  app.use((req, res) => {
    res.status(404).json(notFound("NOT_FOUND", `No route for ${req.method} ${req.path}`));
  });

  app.use((err, req, res, next) => {
    const status = err.status ?? 500;
    const code = status === 400 ? "BAD_JSON" : "SERVER_ERROR";
    const message = status === 400 ? "The body is not valid JSON" : "Something went wrong";
    res.status(status).json({ error: { code, message } });
  });

  return app;
}
