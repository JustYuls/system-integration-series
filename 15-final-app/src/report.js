// The final report of the project, written from the real files of the folder (nothing is typed by hand except the
// "known limitations" and "next steps"). build-report.js calls buildReport() and writes docs/final-report.md.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { readBpmn } from "./bpmn.js";
import { criteriaWeights, loadStrategyData, scoreOptions } from "./strategy.js";
import { scanTests } from "./tags.js";
import { verifyProject } from "./verify.js";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const table = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)];

// The tests of a real run: node --test --test-reporter=junit writes one <testcase> for each test.
// Returns [{ name, ok }]. A test that failed has a <failure> inside its <testcase>.
export function parseJunit(xml) {
  const unescape = (t) => t.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return [...xml.matchAll(/<testcase name="([^"]*)"[^>]*?(?:\/>|>([\s\S]*?)<\/testcase>)/g)].map((m) => ({ name: unescape(m[1]), ok: !/<failure/.test(m[2] ?? "") }));
}

// Tests per episode: the file names start with epNN-, so the count per episode is a count per prefix.
export function testsPerEpisode(tests) {
  const byEpisode = new Map();
  for (const t of tests) {
    const episode = /^ep(\d\d)-/.exec(t.file)?.[1] ?? "??";
    const row = byEpisode.get(episode) ?? { episode, tests: 0, tagged: 0 };
    row.tests++;
    if (t.tags.length) row.tagged++;
    byEpisode.set(episode, row);
  }
  return [...byEpisode.values()].sort((a, b) => a.episode.localeCompare(b.episode));
}

// run: { results: [{ name, ok }], seconds } from a real run of node --test, or null when no run was made.
export function buildReport({ root, run = null, date = "" }) {
  const docs = path.join(root, "docs");
  const model = readBpmn(path.join(docs, "process.bpmn"));
  const notes = readJson(path.join(docs, "process-notes.json"));
  const requirements = readJson(path.join(docs, "requirements.json")).functional;
  const nfrs = readJson(path.join(docs, "nfr.json")).nonFunctional;
  const links = readJson(path.join(docs, "trace-links.json"));
  const strategy = loadStrategyData(path.join(docs, "strategy-options.json"));
  const ranking = scoreOptions(strategy.options, criteriaWeights(nfrs, strategy.priorities, strategy.constraints));
  const catalog = readJson(path.join(docs, "services.json")).services;
  const tests = scanTests(path.join(root, "test"));
  const verified = verifyProject(root);
  const tasks = Object.values(model.nodes).filter((n) => n.type.endsWith("Task"));
  const passes = (tag) => run?.results.filter((r) => r.name.includes(`[${tag}]`));

  const out = [`# Campus Event Planner: final report${date ? ` (${date})` : ""}`, "", "Written by `node build-report.js` from the real files of this folder.", ""];

  out.push("## 1. The process", "",
    `The process "${model.name}" has ${tasks.length} tasks, ${Object.values(model.nodes).filter((n) => n.type.endsWith("Gateway")).length} gateways and ${model.lanes.length} lanes (${model.lanes.map((l) => l.name).join(", ")}).`,
    `It is documented with ${Object.keys(notes.rules).length} business rules (${Object.keys(notes.rules).join(", ")}). Purpose: ${notes.purpose}`, "",
    ...table(["Task", "Name", "Type"], tasks.map((t) => [t.id, t.name, t.type])), "");

  out.push("## 2. Requirements", "", `${requirements.length} functional and ${nfrs.length} non-functional requirements.`, "",
    ...table(["Id", "Task", "Priority", "Statement"], requirements.map((r) => [r.id, r.task, r.priority, r.statement])), "",
    ...table(["Id", "Category", "Target", "Statement"], nfrs.map((n) => [n.id, n.category, `${n.target.comparison} ${n.target.value} ${n.target.unit}`, n.statement])), "");

  out.push("## 3. Results for the non-functional requirements", "",
    run ? `A real run of \`node --test\` (${run.results.length} tests, ${run.seconds} s).` : "No test run was made for this report (run `node build-report.js` without `--no-run`).", "",
    ...table(["Id", "Verified by", "Tagged tests", "Passing", "Evidence"], nfrs.map((n) => {
      const mine = verified.rows.find((r) => r.id === n.id);
      const ran = passes(n.id);
      return [n.id, links.nonFunctional[n.id].verification, mine.total, ran ? `${ran.filter((r) => r.ok).length} of ${ran.length}` : "not run", links.nonFunctional[n.id].evidence];
    })), "");

  out.push("## 4. Strategy", "", `The strategy was chosen by weighted scoring of the options with the weights taken from the non-functional requirements (episode 6).`, "",
    ...table(["Rank", "Option", "Score"], ranking.map((r) => [r.rank, r.name, `${r.total} of ${r.max} (${r.percent}%)`])), "",
    `The winner is **${ranking[0].name}**. The application is built this way: one API gateway in front of three REST services, a message queue for notices, and protected outside calls.`, "");

  out.push("## 5. Architecture", "", ...table(["Service", "Tasks", "Protocol", "Data owner"], catalog.map((s) => [s.name, s.tasks.join(", "), s.protocol, s.dataOwner])), "",
    "Ports: gateway 4000, Student Affairs 4001, Finance 4002, Facilities 4003. Patterns around the outside APIs: translator, cache, retry with backoff, circuit breaker, aggregator, router.",
    existsSync(path.join(docs, "architecture.md")) ? "The diagrams (component, sequence, state) are in `docs/architecture.md`." : "", "");

  out.push("## 6. Tests", "", `${verified.counts.total} tests in ${new Set(tests.map((t) => t.file)).size} files (counted from the test names); ${verified.counts.tagged} of them carry a requirement tag.`, "",
    ...table(["Episode", "Tests", "With a requirement tag"], testsPerEpisode(tests).map((r) => [r.episode, r.tests, r.tagged])), "",
    "The count is made from the test names, because a folder holds the tests of all earlier episodes.", "");

  out.push("## 7. Traceability", "",
    `Requirements with a tagged test: ${verified.rows.filter((r) => r.total > 0).length} of ${verified.rows.length}. With a behaviour test of episode 15: ${verified.rows.filter((r) => r.newTests > 0).length} of ${verified.rows.length}.`,
    `Endpoints named in a test: ${verified.endpoints.filter((e) => e.tested).length} of ${verified.endpoints.length}. Problems in the trace links: ${verified.trace.length}.`,
    verified.ok ? "`node verify.js` ends with OK." : `\`node verify.js\` finds ${verified.problems.length} problems.`, "",
    ...table(["Requirement", "Tests", "Behaviour tests (episode 15)", "Earlier tests"], verified.rows.map((r) => [r.id, r.total, r.newTests, r.earlier])), "");

  out.push("## 8. Known limitations", "",
    "- **No login.** Anyone who can reach the gateway can plan requests and change a status. Student Affairs officers and organizers are not told apart.",
    "- **No rate limiting.** One client can send thousands of requests. The load test shows 20 requests per minute, not what happens at 2000.",
    "- **No database.** The three services, the assessments and the queue keep their data in memory. A restart loses every change, and the queue loses its messages.",
    "- **One process.** There is one copy of each service and no deployment (no container, no server, no certificate).",
    "- **Finance cannot create a deposit record.** A request made through the web page has no deposit, so it is returned until someone creates one.",
    "- **The outside APIs are free and keyless.** They have fair-use limits and no promise of availability; the planner survives them being down, but cannot make them faster.",
    "- **The tests use fakes for the outside APIs.** A fake can be wrong about the real API. One live check (`node plan-live.js`) is kept outside the test suite on purpose.", "");

  out.push("## 9. What to do next", "",
    "1. **Authentication and roles:** sign in, then let only an officer approve or return, and only the owner see a request.",
    "2. **Rate limiting** at the gateway: a limit per client, and `429 Too Many Requests` with `Retry-After`.",
    "3. **A database** for each service (each service owns its data), and a durable queue, so that a restart loses nothing.",
    "4. **Deployment:** containers, configuration from environment variables, a health check in the platform, logs and metrics.",
    "5. **Contract tests** against the real APIs on a schedule, so a change in an outside API is found before a student is.", "");
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}
