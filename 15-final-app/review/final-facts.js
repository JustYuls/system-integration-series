// Facts for the AI review: what an AI assistant said about testing an integrated system, decided by running code.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createExternal } from "../src/external.js";
import { createFakeExternal } from "../src/gateway/fakes.js";
import { planEvent } from "../src/gateway/plan.js";
import { createQueue } from "../src/queue.js";
import { createClients } from "../src/gateway/clients.js";
import { createFacilitiesApp } from "../src/services/facilities.js";
import { createFinanceApp } from "../src/services/finance.js";
import { createStudentAffairsApp } from "../src/services/student-affairs.js";
import { start } from "../src/serve.js";
import { verifyProject } from "../src/verify.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TODAY = "2027-02-20";
const CHRISTMAS = "2027-12-25";

// ---- Finding 1: a mock can be wrong in the same way as the code it tests ------------------------------------------
// The AI draft of a holiday check reads body.holidays. Its author also wrote the fake, with the same wrong idea.
const draftIsHoliday = async (date, fetch) => (await (await fetch("https://date.nager.at/api/v3/PublicHolidays/2027/PH")).json()).holidays.some((h) => h.date === date);
const fakeOfTheAuthor = async () => ({ ok: true, json: async () => ({ holidays: [{ date: CHRISTMAS }] }) });
// What Nager.Date really sends (the shape recorded in the tests of episode 12): a plain array.
const realShape = async () => ({ ok: true, status: 200, json: async () => [{ date: CHRISTMAS, localName: "Araw ng Pasko", name: "Christmas Day" }] });

async function mockHidesFailure() {
  const withFake = await draftIsHoliday(CHRISTMAS, fakeOfTheAuthor); // the test of the draft: green
  let withReal;
  try {
    withReal = await draftIsHoliday(CHRISTMAS, realShape);
  } catch (error) {
    withReal = `crash: ${error.constructor.name}`;
  }
  const ours = await createExternal({ fetch: realShape, sleep: async () => {} }).holiday(CHRISTMAS); // our adapter, tested with the real shape
  return { draftWithFake: withFake, draftWithReal: withReal, ourAdapter: ours.isHoliday };
}

// ---- Finding 2: a test that always passes proves nothing; a mutant shows it -------------------------------------
// The real decide() is taken from the source file, and broken in three small ways (mutants).
const planSource = readFileSync(path.join(root, "src/gateway/plan.js"), "utf8");
const decideSource = /export function decide\(checks\) \{([\s\S]*?)\n\}/.exec(planSource)[1];
const FAILED = 'if (all.some((c) => c.status === "failed")) return "returned";';
const UNKNOWN = 'if (all.some((c) => c.status === "unknown")) return "needs-review";';
const MUTANTS = {
  "failed check is ignored": decideSource.replace(FAILED, ""),
  "unknown counts as approved": decideSource.replace(UNKNOWN, 'if (all.some((c) => c.status === "unknown")) return "approved";'),
  "unknown is looked at before failed": decideSource.replace(FAILED, "").replace(UNKNOWN, `${UNKNOWN}\n  ${FAILED}`),
};
const check = (status) => ({ status, reasons: [] });
// The cases of a test suite for decide(): [name, checks, expected].
const CASES = [
  ["all passed", { a: check("passed"), b: check("passed") }, "approved"],
  ["one failed", { a: check("passed"), b: check("failed") }, "returned"],
  ["one unknown", { a: check("passed"), b: check("unknown") }, "needs-review"],
  ["failed and unknown", { a: check("unknown"), b: check("failed") }, "returned"],
];
const build = (body) => new Function("checks", body);
const passes = (decide, cases) => cases.every(([, checks, expected]) => decide(checks) === expected);

function mutationFacts() {
  const real = build(decideSource);
  const names = Object.keys(MUTANTS);
  const killedBy = (cases) => names.filter((name) => !passes(build(MUTANTS[name]), cases));
  const vacuous = () => true; // assert.ok(true): it passes for every implementation
  return {
    realPassesAll: passes(real, CASES),
    vacuousPassesReal: vacuous(real),
    vacuousPassesMutants: names.every((n) => vacuous(build(MUTANTS[n]))),
    weakKilled: killedBy(CASES.slice(0, 1)).length, // a suite with only the "all passed" case
    fullKilled: killedBy(CASES).length,
    mutants: names.length,
  };
}

// ---- Claim 4: "if all tests pass, the system has no bugs" ----------------------------------------------------------
// A tiny module with a bug on the border, and tests that all pass. FR-05: 60 percent or more fails the check.
const rainOk = (chance) => chance <= 60; // the bug: the requirement says below 60
const toyTests = [[20, true], [45, true], [70, false], [95, false]];
const toyFacts = () => ({
  toyTestsPass: toyTests.every(([chance, expected]) => rainOk(chance) === expected),
  toyBug: rainOk(60) === true, // 60 percent must fail
  borderTestCatchesIt: rainOk(60) !== false,
});

// ---- Claim 5: "every requirement has a test": verify.js decides -----------------------------------------------
const verifyFacts = () => {
  const result = verifyProject(root);
  return { requirements: result.rows.length, withTest: result.rows.filter((r) => r.total > 0).length, verifyOk: result.ok };
};

// ---- Finding 3 and claim 6: the real internet in the tests --------------------------------------------------------
// A guard around fetch: calls to this computer pass, every other host is counted and refused (the network is "down").
function guardedFetch() {
  const blocked = [];
  const guarded = async (url, init) => {
    const host = new URL(url).hostname;
    if (host === "127.0.0.1" || host === "localhost") return globalThis.fetch(url, init);
    blocked.push(host);
    throw new TypeError(`fetch failed: ${host} is not reachable`);
  };
  return { guarded, blocked };
}

async function withCampus(run) {
  const apps = { studentAffairs: await start(createStudentAffairsApp()), finance: await start(createFinanceApp()), facilities: await start(createFacilitiesApp()) };
  const services = Object.fromEntries(Object.entries(apps).map(([name, app]) => [name, app.url]));
  try {
    return await run(createClients(services));
  } finally {
    await Promise.all(Object.values(apps).map((a) => a.close()));
  }
}

async function internetFacts() {
  const queue = () => createQueue({ sleep: async () => {} });
  return withCampus(async (clients) => {
    // 1. Planner with fake outside APIs: no call leaves this computer, and the answer is the expected one.
    const fakes = guardedFetch();
    const withFakes = await planEvent("EVT-0001", { clients, external: createFakeExternal({ today: TODAY }), queue: queue(), today: TODAY });
    // 2. Planner whose outside calls use the real fetch, with the network down: the same test would now fail.
    const offline = guardedFetch();
    const real = createExternal({ fetch: offline.guarded, sleep: async () => {} });
    const withRealApis = await planEvent("EVT-0001", { clients, external: real, queue: queue(), today: TODAY });
    // 3. The real weather window moves with the real day: a fixed date in the test is "too far" for the real API.
    const outdoor = { date: "2028-02-14", today: TODAY };
    const fixed = await createFakeExternal({ today: "2028-02-10" }).forecast({ date: outdoor.date, today: "2028-02-10" });
    const todayReal = await createExternal({ fetch: offline.guarded, sleep: async () => {} }).forecast({ date: outdoor.date }); // today = the real today
    return {
      fakeDecision: withFakes.decision,
      fakeOutsideCalls: fakes.blocked.length,
      offlineDecision: withRealApis.decision,
      offlineBlocked: [...new Set(offline.blocked)].sort(),
      fixedForecast: fixed.available,
      realDayReason: todayReal.reason,
    };
  });
}

export async function collect() {
  return { ...(await mockHidesFailure()), mutation: mutationFacts(), toy: toyFacts(), verify: verifyFacts(), internet: await internetFacts(), cases: CASES.length, mutantNames: Object.keys(MUTANTS) };
}
