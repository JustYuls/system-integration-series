// The final deliverables: the demo, the report, the presentation script, the project template, and the AI review.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { collect } from "../review/final-facts.js";
import { buildReport, parseJunit, testsPerEpisode } from "../src/report.js";
import { scanTests } from "../src/tags.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const node = (cwd, ...args) => execFileSync("node", args, { cwd, encoding: "utf8" });

describe("the final demo (scripts/demo.js)", () => {
  const out = node(root, "scripts/demo.js");

  test("[FR-08] it tells the four stories: approved, returned, returned (Christmas), needs-review (outage)", () => {
    assert.match(out, /EVT-0001 Orientation Day[\s\S]*decision APPROVED {3}\(status in Student Affairs: Approved\)/);
    assert.match(out, /EVT-0002 General Assembly[\s\S]*decision RETURNED {3}\(status in Student Affairs: Returned\)/);
    assert.match(out, /EVT-0008 Christmas Cleanup[\s\S]*decision RETURNED/);
    assert.match(out, /EVT-0003 Coding Contest[\s\S]*decision NEEDS-REVIEW {3}\(status in Student Affairs: Pending\)/);
  });

  test("[NFR-05] the reasons in the demo are plain sentences (unpaid penalty, unpaid deposit, Christmas Day)", () => {
    assert.match(out, /Room 101 has an unpaid penalty of 50 pesos, so it cannot be reserved\./);
    assert.match(out, /The deposit is not fully paid: 1,500\.5 pesos are still due\./);
    assert.match(out, /The date is a public holiday: Christmas Day\./);
    assert.doesNotMatch(out, /BR-\d\d/);
  });

  test("[FR-11] every story ends with an e-mail line, and the queue lost nothing", () => {
    assert.equal(out.match(/e-mail to /g).length, 4);
    assert.match(out, /queue: \{"delivered":4,"retried":0,"dead":0\} {3}e-mails sent: 4/);
  });

  test("the output is the same every time (fake outside APIs, a fixed date)", () => {
    assert.equal(node(root, "scripts/demo.js"), out);
  });
});

describe("the report (build-report.js)", () => {
  const report = buildReport({ root, run: null });

  test("it has the nine sections, written from the real files", () => {
    for (const heading of ["1. The process", "2. Requirements", "3. Results for the non-functional requirements", "4. Strategy", "5. Architecture", "6. Tests", "7. Traceability", "8. Known limitations", "9. What to do next"]) {
      assert.ok(report.includes(`## ${heading}`), heading);
    }
    assert.match(report, /\| FR-12 \| G3 \|/);
    assert.match(report, /\| NFR-08 \| capacity \|/);
    assert.match(report, /Requirements with a tagged test: 20 of 20/);
    assert.match(report, /Endpoints named in a test: \d+ of \d+/);
  });

  test("it names the limitations and the next steps: rate limiting, authentication, a database, deployment", () => {
    for (const word of [/rate limit/i, /authentication/i, /database/i, /deployment/i]) assert.match(report, word);
  });

  test("the test counts per episode come from the test names (tags), one row for each episode of the folder", () => {
    const rows = testsPerEpisode(scanTests(path.join(root, "test")));
    assert.ok(rows.find((r) => r.episode === "15").tests >= 60);
    assert.ok(rows.length >= 12);
    assert.ok(report.includes("| 15 |"));
  });

  test("a real test run is read from the JUnit output of node --test", () => {
    const xml = '<testsuite><testcase name="[FR-01] a &amp; b" time="0.1" file="x"/><testcase name="[FR-02] broken" time="0.2"><failure message="boom"/></testcase></testsuite>';
    assert.deepEqual(parseJunit(xml), [{ name: "[FR-01] a & b", ok: true }, { name: "[FR-02] broken", ok: false }]);
    const withRun = buildReport({ root, run: { seconds: 5, results: [{ name: "[NFR-02] x", ok: true }, { name: "[NFR-02] y", ok: false }] } });
    assert.match(withRun, /\| NFR-02 \| test \| \d+ \| 1 of 2 \|/);
  });

  test("docs/final-report.md exists and was written by build-report.js", () => {
    const file = read("docs/final-report.md");
    assert.match(file, /^# Campus Event Planner: final report/);
    assert.match(file, /## 8\. Known limitations/);
  });
});

describe("the presentation script (docs/presentation.md)", () => {
  const text = read("docs/presentation.md");

  test("it plans 8 minutes: seven parts, the last one ends at 8:00", () => {
    const times = [...text.matchAll(/^\| (\d:\d\d) to (\d:\d\d) \| (\d)\. /gm)];
    assert.equal(times.length, 7);
    assert.equal(times[0][1], "0:00");
    assert.equal(times.at(-1)[2], "8:00");
    for (let i = 1; i < times.length; i++) assert.equal(times[i][1], times[i - 1][2], "the parts follow each other");
  });

  test("it says what to show and what to say in each part, and has the demo rules and a checklist", () => {
    assert.ok((text.match(/\*\*Show:\*\*/g) ?? []).length >= 6);
    assert.ok((text.match(/\*\*Say:\*\*/g) ?? []).length >= 6);
    assert.match(text, /## Demo rules/);
    assert.match(text, /plan B/i);
    assert.ok((text.match(/- \[ \]/g) ?? []).length >= 10);
  });

  test("the spoken text is about 8 minutes at 130 words a minute", () => {
    const spoken = [...text.matchAll(/\*\*Say:\*\*\s*"([^"]+(?:"[^"]*")?[^"]*)"/g)].map((m) => m[1]).join(" ");
    const words = spoken.split(/\s+/).length;
    assert.ok(words >= 450 && words <= 1100, `${words} spoken words`);
  });
});

describe("the project template", () => {
  const template = path.join(root, "project-template");
  const files = (dir, found = []) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files(full, found);
      else found.push(path.relative(template, full).replaceAll("\\", "/"));
    }
    return found;
  };
  const tree = files(template);

  test("it has the same structure as the application: docs, three services, gateway, queue, adapters, planner, page, tests", () => {
    for (const file of ["README.md", "package.json", "start-all.js", "verify.js", "check-docs.js", "docs/process.bpmn", "docs/process-notes.json", "docs/requirements.json", "docs/nfr.json", "docs/trace-links.json", "docs/openapi.json",
      "src/services/resource-app.js", "src/services/customers.js", "src/services/items.js", "src/services/accounts.js", "src/gateway/gateway.js", "src/gateway/plan.js", "src/gateway/server.js", "src/queue.js", "src/notifier.js",
      "src/external.js", "src/tags.js", "src/verify.js", "src/bpmn.js", "src/requirements.js", "src/nfr.js", "web/index.html", "web/app.js", "web/styles.css"]) {
      assert.ok(tree.includes(file), file);
    }
    assert.ok(tree.filter((f) => f.startsWith("test/")).length >= 5);
  });

  test("it holds no trace of the campus domain in its code (only the README may explain where it came from)", () => {
    for (const file of tree.filter((f) => /\.(js|json|html|css|bpmn)$/.test(f) && !f.startsWith("test/"))) {
      assert.doesNotMatch(readFileSync(path.join(template, file), "utf8"), /Campus|campus|Student Affairs|EVT-|Facilities|Orientation/, file);
    }
  });

  test("the tag scanner in the template is the same file as src/tags.js of the application", () => {
    assert.equal(readFileSync(path.join(template, "src/tags.js"), "utf8"), read("src/tags.js"));
  });

  test("the quality checkers work on the example documents, and node verify.js is green in the template", () => {
    assert.match(node(template, "check-docs.js"), /Non-functional requirements: OK/);
    assert.match(node(template, "verify.js"), /OK: every requirement has a tagged test/);
  });

  test("the README is a numbered how-to with the free APIs to consider", () => {
    const readme = readFileSync(path.join(template, "README.md"), "utf8");
    assert.match(readme, /How to adapt this template to your project/);
    assert.ok((readme.match(/^\d+\. /gm) ?? []).length >= 8);
    for (const api of ["Open-Meteo", "Nager.Date", "Frankfurter", "REST Countries", "Open Library", "JSONPlaceholder"]) assert.ok(readme.includes(api), api);
  });

  test("the template tests live in project-template/test (the application's test folder does not hold them)", () => {
    assert.ok(tree.some((f) => f === "test/app.test.js"));
    assert.ok(!existsSync(path.join(root, "test", "app.test.js")));
  });
});

describe("the AI review of the testing answer", () => {
  let f;
  test("finding 1: a mock written with the code hides a wrong shape; the real shape crashes the draft", async () => {
    f = await collect();
    assert.equal(f.draftWithFake, true);
    assert.equal(f.draftWithReal, "crash: TypeError");
    assert.equal(f.ourAdapter, true);
    assert.ok(existsSync(path.join(root, "plan-live.js")), "the live check exists outside the test suite");
  });

  test("finding 2: a test that always passes kills no mutant, the real cases kill all three", () => {
    const m = f.mutation;
    assert.ok(m.realPassesAll && m.vacuousPassesReal && m.vacuousPassesMutants);
    assert.equal(m.mutants, 3);
    assert.equal(m.fullKilled, 3);
    assert.equal(m.weakKilled, 0);
  });

  test("finding 3: with fake outside APIs no call leaves the computer; with the network down the decision changes", () => {
    assert.equal(f.internet.fakeOutsideCalls, 0);
    assert.equal(f.internet.fakeDecision, "approved");
    assert.equal(f.internet.offlineDecision, "needs-review");
    assert.deepEqual(f.internet.offlineBlocked, ["date.nager.at"]);
  });

  test("claim 4 is false: four toy tests pass, and the code still has a bug on the border (60 percent)", () => {
    assert.equal(f.toy.toyTestsPass, true);
    assert.equal(f.toy.toyBug, true);
  });

  test("claim 5 is true: verify.js finds a tagged test for all 20 requirements", () => {
    assert.deepEqual(f.verify, { requirements: 20, withTest: 20, verifyOk: true });
  });

  test("claim 6 is false: an integration test that calls the real APIs changes its result when the network is down, and with the day", () => {
    assert.equal(f.internet.offlineDecision, "needs-review");
    assert.equal(f.internet.fixedForecast, true);
    assert.match(f.internet.realDayReason, /beyond the 16 day forecast window/);
  });

  test("the review prints three FINDING and three CLAIM lines, each decided by code", () => {
    const out = node(root, "review/final-review.js");
    assert.equal((out.match(/^FINDING/gm) ?? []).length, 3);
    assert.equal((out.match(/^CLAIM/gm) ?? []).length, 3);
    assert.equal((out.match(/ confirmed$/gm) ?? []).length, 3);
    assert.equal((out.match(/ FALSE$/gm) ?? []).length, 2);
    assert.equal((out.match(/ TRUE$/gm) ?? []).length, 1);
  });
});
