// The application: the gateway of the template plus the planner routes and the web page.
//   POST /api/requests                          check the body (400), plan the request, answer 201 + Location + the assessment
//   GET  /api/requests/:requestId/assessment    the stored assessment, or 404
// Requests are kept in memory here. In your project, decide which service OWNS the requests, and store them there.
import express from "express";
import { fileURLToPath } from "node:url";
import { checkFields, hasProblems, sendError, sendValidation } from "../http.js";
import { TYPES } from "../services/resource-app.js";
import { createClients } from "./clients.js";
import { createGateway } from "./gateway.js";
import { plan } from "./plan.js";

const WEB_DIR = fileURLToPath(new URL("../../web", import.meta.url));
// BR-05: what every request must name. Same type names as the services (see TYPES in resource-app.js).
const REQUIRED = { customerId: TYPES.text, itemId: TYPES.text, quantity: (v) => Number.isInteger(v) && v > 0, date: TYPES.date };

export function createApp({ services, external, queue, fetch = globalThis.fetch, timeoutMs }) {
  const clients = createClients(services, { fetch, timeoutMs });
  const assessments = new Map();
  let counter = 0;

  const router = express.Router();
  router.use(express.json());

  router.post("/", async (req, res) => {
    const problems = checkFields(req.body ?? {}, REQUIRED);
    if (hasProblems(problems)) return sendValidation(res, problems);
    const requestId = `R-${String(++counter).padStart(4, "0")}`;
    const { customerId, itemId, quantity, date } = req.body;
    const assessment = await plan(requestId, { customerId, itemId, quantity, date }, { clients, external, queue });
    assessments.set(requestId, assessment);
    queue.drain().catch((error) => console.error(`queue: ${error.message}`)); // deliver the notice without making the caller wait
    res.status(201).location(`/api/requests/${requestId}/assessment`).json(assessment);
  });

  router.get("/:requestId/assessment", (req, res) => {
    const found = assessments.get(req.params.requestId);
    if (!found) return sendError(res, 404, "NOT_FOUND", `No assessment for ${req.params.requestId}`);
    res.json(found);
  });

  router.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return sendError(res, 400, "BAD_JSON", "The request body is not valid JSON");
    if (err.name === "ClientError") return sendError(res, err.status, err.status === 504 ? "GATEWAY_TIMEOUT" : "BAD_GATEWAY", err.message);
    console.error(`500 ${req.method} ${req.originalUrl}: ${err.message}`);
    return sendError(res, 500, "INTERNAL_ERROR", "Something went wrong in the planner");
  });

  return createGateway({
    services,
    fetch,
    timeoutMs,
    extend(app) {
      app.use("/api/requests", router);
      app.use(express.static(WEB_DIR));
    },
  });
}
