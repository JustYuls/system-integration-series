// Student Affairs service: event requests as a REST resource.
//   GET    /requests?status=       the collection (or only one status)
//   GET    /requests/:requestNo    one request, or 404
//   POST   /requests               create: 201 + Location, or 400 with the missing fields
//   PATCH  /requests/:requestNo    change the status only
//   DELETE /requests/:requestNo    withdraw a Pending request: 204
import { checkFields, createJsonApp, finishApp, hasProblems, sendError, sendValidation } from "../http.js";
import { seedData } from "../seed.js";
import { isEmail, isIsoDate, isMoney, isPositiveInt, isText } from "../validate.js";

export const STATUSES = ["Pending", "On hold", "Approved", "Returned"];

const REQUIRED = { title: isText, organization: isText, date: isIsoDate, venue: isText, attendees: isPositiveInt, budget: isMoney, contactEmail: isEmail };

const nextNumber = (requests) => {
  const last = Math.max(0, ...requests.map((r) => Number(r.requestNo.slice(4))));
  return `EVT-${String(last + 1).padStart(4, "0")}`;
};

export function createStudentAffairsApp(data = seedData(), { log } = {}) {
  const requests = structuredClone(data.requests); // our own copy: no test leaks state into another
  const find = (requestNo) => requests.find((r) => r.requestNo === requestNo);
  const notFound = (res, requestNo) => sendError(res, 404, "NOT_FOUND", `No request ${requestNo}`);
  const app = createJsonApp("student-affairs");

  app.get("/requests", (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !STATUSES.includes(status)) {
      return sendError(res, 400, "INVALID_STATUS", `status must be one of: ${STATUSES.join(", ")}`);
    }
    res.json(status ? requests.filter((r) => r.status === status) : requests);
  });

  app.get("/requests/:requestNo", (req, res) => {
    const found = find(req.params.requestNo);
    if (!found) return notFound(res, req.params.requestNo);
    res.json(found);
  });

  app.post("/requests", (req, res) => {
    const body = req.body ?? {};
    const problems = checkFields(body, REQUIRED);
    if (body.outdoor !== undefined && typeof body.outdoor !== "boolean") problems.invalid.push("outdoor");
    if (hasProblems(problems)) return sendValidation(res, problems);
    const created = {
      requestNo: nextNumber(requests),
      title: body.title,
      organization: body.organization,
      date: body.date,
      status: "Pending",
      venue: body.venue,
      attendees: body.attendees,
      budget: { amount: body.budget.amount, currency: body.budget.currency },
      outdoor: body.outdoor === true,
      contactEmail: body.contactEmail,
    };
    requests.push(created);
    res.status(201).location(`/requests/${created.requestNo}`).json(created);
  });

  app.patch("/requests/:requestNo", (req, res) => {
    const found = find(req.params.requestNo);
    if (!found) return notFound(res, req.params.requestNo);
    const body = req.body ?? {};
    const others = Object.keys(body).filter((key) => key !== "status");
    if (others.length) return sendError(res, 400, "UNKNOWN_FIELDS", `Only status can be changed, not: ${others.join(", ")}`, { invalid: others });
    const problems = checkFields(body, { status: (v) => STATUSES.includes(v) });
    if (hasProblems(problems)) return sendValidation(res, problems);
    found.status = body.status;
    res.json(found);
  });

  app.delete("/requests/:requestNo", (req, res) => {
    const found = find(req.params.requestNo);
    if (!found) return notFound(res, req.params.requestNo);
    if (found.status !== "Pending") return sendError(res, 409, "NOT_PENDING", `Only a Pending request can be withdrawn, this one is ${found.status}`);
    requests.splice(requests.indexOf(found), 1);
    res.status(204).end();
  });

  return finishApp(app, log);
}
