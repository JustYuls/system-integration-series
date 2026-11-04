// The planner routes that the gateway of episode 11 gets through its `extend(app)` hook:
//   GET  /api/requests                         the requests, each with the decision of its last assessment
//   POST /api/requests                         create a request in Student Affairs, then plan it: 201 + assessment
//   GET  /api/requests/:requestNo/assessment   the last stored assessment, or 404
//   POST /api/requests/:requestNo/assessment   plan an existing request again
// and the web page in web/ as static files. Assessments are kept in memory.
import express from "express";
import { fileURLToPath } from "node:url";
import { sendError } from "../http.js";
import { ClientError } from "./clients.js";
import { planEvent } from "./plan.js";

export const WEB_DIR = fileURLToPath(new URL("../../web", import.meta.url));

// Today in Manila, as 2027-03-04, unless the caller fixes the date.
const manilaToday = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function plannerRoutes({ clients, external, queue, today, log = console.error }) {
  const assessments = new Map(); // requestNo -> the last assessment
  const todayNow = () => (typeof today === "function" ? today() : (today ?? manilaToday()));

  // Plan one request, keep the assessment, and let the queue deliver the notice without making the caller wait.
  async function assess(requestNo) {
    const assessment = await planEvent(requestNo, { clients, external, queue, today: todayNow() });
    assessments.set(requestNo, assessment);
    queue.drain().catch((error) => log(`queue: ${error.message}`));
    return assessment;
  }

  const router = express.Router();
  router.use(express.json());

  router.get("/", async (req, res) => {
    const requests = await clients.listRequests();
    res.json(requests.map((r) => ({ ...r, decision: assessments.get(r.requestNo)?.decision ?? null })));
  });

  router.post("/", async (req, res) => {
    const created = await clients.createRequest(req.body ?? {});
    if (created.status === 400) return res.status(400).json(created.body); // the service's own validation problems
    const assessment = await assess(created.body.requestNo);
    res.status(201).location(`/api/requests/${assessment.requestNo}/assessment`).json(assessment);
  });

  router.get("/:requestNo/assessment", (req, res) => {
    const found = assessments.get(req.params.requestNo);
    if (!found) return sendError(res, 404, "NOT_FOUND", `No assessment for ${req.params.requestNo} yet`);
    res.json(found);
  });

  router.post("/:requestNo/assessment", async (req, res) => {
    res.json(await assess(req.params.requestNo));
  });

  // Errors of this router: bad JSON is the caller's fault; an unreachable service is a 502 or 504.
  router.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return sendError(res, 400, "BAD_JSON", "The request body is not valid JSON");
    if (err instanceof ClientError) {
      const code = { TIMEOUT: "GATEWAY_TIMEOUT", UNREACHABLE: "BAD_GATEWAY", NOT_FOUND: "NOT_FOUND" }[err.code] ?? "BAD_GATEWAY";
      return sendError(res, err.status, code, err.message);
    }
    log(`500 ${req.method} ${req.originalUrl}: ${err.message}`);
    return sendError(res, 500, "INTERNAL_ERROR", "Something went wrong in the planner");
  });

  function extend(app) {
    app.use("/api/requests", router);
    app.use(express.static(WEB_DIR));
  }

  return { extend, assessments, assess };
}
