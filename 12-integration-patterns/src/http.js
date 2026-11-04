// Shared HTTP helpers for the three services: one app setup, one error format, one 404, one error handler.
import express from "express";

// Every error answers with the same JSON:  { "error": { "code": "NOT_FOUND", "message": "..." } }
export function sendError(res, status, code, message, extra = {}) {
  return res.status(status).json({ error: { code, message, ...extra } });
}

// A request body with missing or invalid fields: 400 and the list of fields.
export function sendValidation(res, { missing, invalid }) {
  const parts = [];
  if (missing.length) parts.push(`missing: ${missing.join(", ")}`);
  if (invalid.length) parts.push(`invalid: ${invalid.join(", ")}`);
  return sendError(res, 400, "VALIDATION_FAILED", `The request body has problems (${parts.join("; ")})`, { missing, invalid });
}

// rules = { field: (value) => true when the value is acceptable }
export function checkFields(body, rules) {
  const missing = [];
  const invalid = [];
  for (const [field, isValid] of Object.entries(rules)) {
    const value = body[field];
    if (value === undefined || value === null || value === "") missing.push(field);
    else if (!isValid(value)) invalid.push(field);
  }
  return { missing, invalid };
}

export const hasProblems = ({ missing, invalid }) => missing.length + invalid.length > 0;

// An Express app that reads JSON bodies and answers GET /health.
export function createJsonApp(service) {
  const app = express();
  app.use(express.json());
  app.get("/health", (req, res) => res.json({ status: "ok", service }));
  return app;
}

// Call this LAST: the 404 for unknown routes, then the handler for errors.
// Express 5 sends a rejected promise or a thrown error from a route to the handler, so no try/catch is needed.
export function finishApp(app, log = console.error) {
  app.use((req, res) => sendError(res, 404, "NOT_FOUND", `No route for ${req.method} ${req.path}`));
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return sendError(res, 400, "BAD_JSON", "The request body is not valid JSON");
    if (err.status >= 400 && err.status < 500 && err.expose) return sendError(res, err.status, "BAD_REQUEST", err.message);
    log(`500 ${req.method} ${req.path}: ${err.message}`);
    // Never send err.stack to the client: it shows file names and lines to anyone.
    return sendError(res, 500, "INTERNAL_ERROR", "Something went wrong on the server");
  });
  return app;
}
