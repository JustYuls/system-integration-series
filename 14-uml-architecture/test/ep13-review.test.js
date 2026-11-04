import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { collect } from "../review/plan-facts.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const f = await collect();

describe("the AI review of the planner and its web page", () => {
  test("finding 1: the draft card keeps the <img> tag, escapeHtml does not", () => {
    assert.ok(f.draftKeepsTag);
    assert.ok(!f.safeKeepsTag);
    assert.ok(f.safeEscaped);
  });
  test("finding 2: with the holiday service down the draft approves and planEvent asks for a review", () => {
    assert.equal(f.draftDecision, "approved");
    assert.equal(f.realDecision, "needs-review");
  });
  test("finding 3: the draft runs one call at a time, planEvent runs several together", () => {
    assert.equal(f.draftMaxInFlight, 1);
    assert.ok(f.realMaxInFlight >= 4);
  });
  test("claim 4 is false: Student Affairs stores a <script> title (201)", () => {
    assert.equal(f.createdStatus, 201);
    assert.equal(f.storedTitle, "<script>alert(1)</script>");
  });
  test("claim 5 is false: Promise.all rejects, allSettled keeps the other result", () => {
    assert.ok(f.allRejected);
    assert.equal(f.allSettledCount, 1);
  });
  test("claim 6 is true: parallel planning is much faster than the sum of the delays", () => {
    assert.ok(f.parallelMs < f.sumDelaysMs * 0.75, `${f.parallelMs} ms`);
    assert.ok(f.sequentialMs >= f.sumDelaysMs * 0.9, `${f.sequentialMs} ms`);
  });
});

describe("the scripts and the Postman collection", () => {
  test("plan-demo.js prints the decisions of EVT-0001, EVT-0002 and EVT-0008", () => {
    const out = execFileSync("node", ["plan-demo.js"], { cwd: root, encoding: "utf8" });
    assert.match(out, /EVT-0001  APPROVED/);
    assert.match(out, /EVT-0002  RETURNED/);
    assert.match(out, /EVT-0008  RETURNED/);
    assert.match(out, /The date is a public holiday: Christmas Day\./);
    assert.match(out, /EVT-0003  NEEDS-REVIEW/);
    assert.match(out, /POST \/api\/requests {2}-> {2}201/);
  });
  test("the Gateway collection has POST /api/requests with an example body and GET assessment", () => {
    const file = "postman/campus-event-planner.gateway.postman_collection.json";
    const collection = JSON.parse(readFileSync(root + file, "utf8"));
    const folder = collection.item.find((i) => i.name.startsWith("Gateway"));
    const post = folder.item.find((i) => i.request.method === "POST");
    const body = JSON.parse(post.request.body.raw);
    for (const key of ["title", "organization", "date", "venue", "attendees", "budget", "contactEmail"]) assert.ok(key in body, key);
    assert.ok(folder.item.some((i) => i.request.method === "GET" && i.request.url.raw.endsWith("/assessment")));
  });
});
