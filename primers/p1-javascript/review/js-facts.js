// Facts for the AI review: what JavaScript really does. Each answer comes from running code.
import http from "node:http";
import { checkRequest } from "../src/check-request.js";

const base = {
  requestNo: "EVT-0001", title: "Orientation Day", date: "2027-03-04", venue: "Gym",
  attendees: 120, budget: { amount: 15000, currency: "PHP" }, outdoor: false, contactEmail: "cs@campus.example",
};
const mentions = (request, field) => checkRequest(request).some((p) => p.startsWith(field));

// Does fetch reject when the server answers 404? Ask a tiny local server (no internet needed).
async function fetchOn404() {
  const server = http.createServer((req, res) => { res.statusCode = 404; res.end("not found"); });
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://localhost:${server.address().port}/missing`;
  const result = { rejected: false, status: null, ok: null };
  try {
    const response = await fetch(url);
    result.status = response.status;
    result.ok = response.ok;
  } catch {
    result.rejected = true;
  }
  server.close();
  return result;
}

export async function collect() {
  const sum = 0.1 + 0.2;
  const config = { name: "planner", limit: 5 };      // const: the name cannot point to another object
  config.limit = 10;                                 // but the object inside can change
  let reassignFails = false;
  try { eval("const k = 1; k = 2;"); } catch { reassignFails = true; }
  const fetch404 = await fetchOn404();
  return {
    sum,
    sumIsPointThree: sum === 0.3,
    cents: Math.round(sum * 100) / 100,
    stringAttendeesFound: mentions({ ...base, attendees: "120" }, "attendees"),
    impossibleDateFound: mentions({ ...base, date: "2027-02-30" }, "date"),
    impossibleDateLooksFine: /^\d{4}-\d{2}-\d{2}$/.test("2027-02-30"),
    looseEqual: "5" == 5,
    strictEqual: "5" === 5,
    constObjectChanged: config.limit === 10,
    constReassignFails: reassignFails,
    fetch404,
  };
}
