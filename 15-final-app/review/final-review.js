// Check what an AI assistant said about testing an integrated system.   Run:  node review/final-review.js
import { collect } from "./final-facts.js";

const f = await collect();
const m = f.mutation;
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
const line = (label, text, evidence, end) => console.log(`${label.padEnd(10)} ${text.padEnd(44)} ${evidence}   ${end}`);

line("FINDING 1", "mocks hide failures: keep one live check", `draft+fake: ${f.draftWithFake}, real shape: ${f.draftWithReal}`,
  verdict(f.draftWithFake === true && String(f.draftWithReal).startsWith("crash") && f.ourAdapter === true));
line("FINDING 2", "an always-passing test proves nothing", `vacuous kills ${m.vacuousPassesMutants ? 0 : "some"} of ${m.mutants}, real cases kill ${m.fullKilled} of ${m.mutants}`,
  verdict(m.realPassesAll && m.vacuousPassesReal && m.vacuousPassesMutants && m.fullKilled === m.mutants && m.weakKilled < m.mutants));
line("FINDING 3", "tests must not need the real internet", `fakes: ${f.internet.fakeOutsideCalls} outside calls, ${f.internet.fakeDecision}; network down: ${f.internet.offlineDecision}`,
  verdict(f.internet.fakeOutsideCalls === 0 && f.internet.fakeDecision === "approved" && f.internet.offlineDecision === "needs-review"));
line("CLAIM 4", "if all tests pass, there are no bugs", `${f.toy.toyTestsPass ? "4 toy tests pass" : "a toy test fails"}, rainOk(60) = ${f.toy.toyBug} (must be false)`,
  f.toy.toyTestsPass && f.toy.toyBug ? "FALSE" : "TRUE");
line("CLAIM 5", "every requirement has a test", `verify.js: ${f.verify.withTest} of ${f.verify.requirements} have a tagged test`,
  f.verify.verifyOk && f.verify.withTest === f.verify.requirements ? "TRUE" : "FALSE");
line("CLAIM 6", "integration tests call real APIs every run", `network down: ${f.internet.offlineDecision}, blocked ${f.internet.offlineBlocked.join(", ")}`,
  f.internet.offlineDecision === "approved" ? "TRUE" : "FALSE");
