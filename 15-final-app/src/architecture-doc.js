// Write docs/architecture.md from the project data and the generated diagrams.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadNotes } from "./document.js";
import { buildDiagrams, isAdapter } from "./diagrams.js";
import { loadNfr } from "./nfr.js";
import { PORTS } from "./ports.js";
import { criteriaWeights, loadStrategyData, scoreOptions } from "./strategy.js";
import { loadCatalog } from "./soa.js";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
export const DOC_FILE = path.join(docs, "architecture.md");
export const loadKinds = () => JSON.parse(readFileSync(path.join(docs, "uml-kinds.json"), "utf8")).kinds;

// The strategy that episode 6 chose: { name, percent, total, max }, or null when the file is missing or broken.
export function chosenStrategy(file = path.join(docs, "strategy-options.json")) {
  try {
    if (!existsSync(file)) return null;
    const data = loadStrategyData(file);
    const [first, second] = scoreOptions(data.options, criteriaWeights(loadNfr(), data.priorities, data.constraints));
    return { id: first.id, name: first.name, total: first.total, max: first.max, percent: first.percent, secondName: second.name, secondTotal: second.total };
  } catch {
    return null;
  }
}

// How the architecture answers each kind of quality requirement (the key is the NFR category).
export const QUALITY_RESPONSES = {
  performance: "The four checks run at the same time (`Promise.all` in `planEvent`), and outside answers are cached.",
  availability: "An outside API that does not answer makes its check `unknown`, so the planner still answers with `needs-review`.",
  reliability: "Retry with backoff and a circuit breaker on every outside call; the queue retries a failing notification.",
  security: "One entry point (the gateway); every service validates its input; no keys are needed or stored.",
  usability: "The page shows a decision with a color and a word, and the reasons are full sentences.",
  interoperability: "Every service speaks REST and JSON and has an OpenAPI contract, so any client can call it.",
  maintainability: "Small services with one owner each, one gateway, and diagrams generated from the project data.",
  capacity: "The gateway and the services keep no session, so they can run several times; the in-memory queue is the first limit.",
};

const TARGET_SIGNS = { "<=": "at most", ">=": "at least", "=": "exactly" };
const targetText = (t) => `${TARGET_SIGNS[t.comparison] ?? t.comparison} ${t.value} ${t.unit}`;

function componentRows(catalog, ports) {
  const row = (name, does, where, tasks = "") => `| ${name} | ${does} | ${where} | ${tasks} |`;
  const rows = [
    row("Planner web page", "A form for the organizer and a card with the decision and the reasons (`web/`).", "served by the gateway", "T01"),
    row("Gateway and planner", "One entry point: routes calls, runs the process in `planEvent`, answers `POST /api/requests`.", `port ${ports.gateway}`, "T01 to T08"),
  ];
  const where = { "student-affairs-service": `port ${ports.studentAffairs}`, "finance-service": `port ${ports.finance}`, "facilities-service": `port ${ports.facilities}`, "notification-service": "in the gateway process (queue + notifier)" };
  for (const s of catalog.services) {
    const adapter = isAdapter(s);
    const place = where[s.id] ?? (adapter ? `adapter in the gateway, calls ${s.externalApi}` : "");
    rows.push(row(s.name, s.description, place, s.tasks.join(", ")));
  }
  rows.push(row("Queue", "Carries `request.decided` from the planner to the notifier; retries and keeps dead letters.", "in the gateway process", "T07"));
  const apis = [...new Set(catalog.services.map((s) => s.externalApi).filter(Boolean))];
  for (const api of apis) {
    const owner = catalog.services.find((s) => s.externalApi === api);
    rows.push(row(api, `Outside API behind the ${owner.name.toLowerCase()}.`, "internet, HTTPS", owner.tasks.join(", ")));
  }
  return rows;
}

function decisions(strategy) {
  const hub = strategy
    ? `The strategy scored highest in episode 6 is **${strategy.name}** (${strategy.total} of ${strategy.max} points, ${strategy.percent} percent; next: ${strategy.secondName}, ${strategy.secondTotal}).`
    : "The strategy file `docs/strategy-options.json` was not found, so no scored choice is quoted here.";
  return [
    ["D1 One gateway in front of the services", `${hub} The gateway is the single place for routing, timeouts and the planner.`],
    ["D2 REST and JSON between all parts", "One style everywhere (see `docs/standards.json`), so a service can be replaced without changing its callers."],
    ["D3 A queue for the notice", "The organizer's e-mail is sent after the answer; a slow mail server never slows the decision (T07)."],
    ["D4 Adapters protect the outside APIs", "Cache, retry and a circuit breaker sit between the planner and Nager.Date, Open-Meteo and Frankfurter."],
    ["D5 Diagrams are text, generated from data", "`generate-diagrams.js` writes the diagrams from `services.json`, `process.bpmn`, `ports.js` and the service code, and the checkers fail when one drifts."],
  ];
}

export function renderArchitecture({ diagrams = buildDiagrams(), catalog = loadCatalog(), notes = loadNotes(), nfrs = loadNfr(), kinds = loadKinds(), strategy = chosenStrategy(), ports = PORTS } = {}) {
  const kind = (id) => kinds.find((k) => k.id === id);
  const diagram = (title, kindId, text) => [
    `### ${title}`, "", `Question it answers: *${kind(kindId).question}*`, "", "```mermaid", text, "```", "",
  ];
  const lines = [
    "# Architecture of the Campus Event Planner", "",
    "> Generated by `node generate-diagrams.js` from the project data. Do not edit by hand: change the data and generate again.", "",
    "## 1. Purpose", "", notes.purpose, "",
    "This document is a map: it tells the team, and the next person who joins, which parts exist, how they talk to each other, and why they were chosen.", "",
    "## 2. Context", "",
    "- **Users:** an organizer submits an event request in a web page; a Student Affairs officer handles the cases the planner cannot decide.",
    `- **Campus systems:** ${catalog.services.filter((s) => !s.externalApi).map((s) => s.name).join(", ")}.`,
    `- **Outside systems:** ${[...new Set(catalog.services.map((s) => s.externalApi).filter(Boolean))].join(", ")} (free, no key).`,
    "- **Process:** the BPMN process `docs/process.bpmn`, tasks T01 to T08; every diagram below uses its task ids.", "",
    "## 3. Views", "",
    ...diagram("3.1 Components", "component", diagrams.component),
    ...diagram("3.2 One request, step by step", "sequence", diagrams.sequence),
    ...diagram("3.3 The life of a request", "state", diagrams.state),
    ...diagram("3.4 Where it runs", "deployment", diagrams.deployment),
    "## 4. Components", "",
    "| Component | Responsibility | Port or place | Tasks |", "|---|---|---|---|",
    ...componentRows(catalog, ports), "",
    "## 5. Decisions", "",
    ...decisions(strategy).flatMap(([title, why]) => [`**${title}.** ${why}`, ""]),
    "## 6. Quality attributes", "",
    "| NFR | Quality | Target | How the architecture meets it |", "|---|---|---|---|",
    ...nfrs.map((n) => `| ${n.id} | ${n.category} | ${targetText(n.target)} | ${QUALITY_RESPONSES[n.category] ?? "not yet answered"} |`), "",
    "## 7. How to view the diagrams", "",
    "- **GitHub** draws every ```` ```mermaid ```` block when you open this file.",
    "- **Visual Studio Code:** install a Mermaid extension (for example *Markdown Preview Mermaid Support*) and open the Markdown preview.",
    "- **mermaid.live:** paste the text of one diagram into the editor to see it and export a PNG or SVG.", "",
    "## 8. Which diagram answers which question", "",
    "| Diagram | Question | In this project |", "|---|---|---|",
    ...kinds.map((k) => `| ${k.name} | ${k.question} | ${k.useInProject} |`), "",
  ];
  return lines.join("\n");
}
