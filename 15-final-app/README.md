# Campus Event Planner, episode 15: integration testing, documentation, and presenting the project

Week 17, LO 2.4, CLO 3. This is the last episode and the last folder: `15-final-app` is the whole application, all its documents, all its tests, a script that proves that every requirement has a test, a final demo, a report, and a template that you adapt for your own final project.

## Run it

```
node start-all.js        # from this folder: three services, queue, gateway and page; open http://localhost:4000
npm run demo             # the final demo with FAKE outside APIs and a fixed date: the same story every time
npm test                 # every test of every episode (about a minute); needs no internet
npm run verify           # does EVERY requirement have a test?  (exit code 1 when something is missing)
npm run build-report     # writes docs/final-report.md from the real files and a real test run
npm run review:testing   # the AI review of this episode
```

`npm start` is the same as `node start-all.js` and uses the real outside APIs (Open-Meteo, Nager.Date, Frankfurter), so it needs internet. `node plan-live.js` is the one live check; it is not part of the test suite on purpose.

## What is new in this episode

| File | What it does |
|---|---|
| `test/ep15-integration.test.js` | The WHOLE application (real services, real gateway, real queue and notifier, real planner, all on `listen(0)`) with fake outside APIs: one test or more for each of FR-01 to FR-12, and an outage test for each outside API. |
| `test/ep15-dependencies.test.js` | Failing dependencies: Finance off (needs-review, 502), Facilities off, Student Affairs slow (504), a queue handler that fails twice and then works (the notice is delivered once), one that never works (dead letter), the real `createExternal` with a fake fetch: a retry that succeeds on the third attempt, exactly 3 attempts, the cache, the circuit breaker. |
| `test/ep15-contract.test.js` | Invalid input (400 with the problems), no secrets in the source, plain-language reasons, JSON, ISO 8601 dates and ISO 4217 currency codes, a load test (20 planning requests at the same moment, each answer correct, within the time budget). |
| `test/ep15-endpoints.test.js` | Walks EVERY operation of `docs/openapi.json` and `docs/openapi-services.json` and calls it (NFR-07). |
| `test/ep15-verify.test.js`, `test/ep15-final.test.js` | Tests of `verify.js` and its scanner, of the demo, the report, the presentation script, the template and the AI review. |
| `test/ep15-support.js` | Helpers: `startApp`, `startCampus`, `createFakeWeb`, `until`. |
| `src/tags.js`, `src/verify.js`, `verify.js` | The scanner of requirement tags in test names, the check against `docs/requirements.json`, `docs/nfr.json`, `docs/trace-links.json` and `completeness()` of episode 7, and the command. |
| `scripts/demo.js` | The final demo: EVT-0001 approved, EVT-0002 returned (unpaid deposit and penalty), EVT-0008 returned (Christmas), EVT-0003 needs-review (the holiday API is down). |
| `src/report.js`, `build-report.js`, `docs/final-report.md` | The final report of the project, written from the real data: process, requirements, results, strategy, architecture, test counts, traceability, limits, next steps. |
| `docs/presentation.md` | A script for an 8 minute talk with timings, what to show and what to say, the demo rules and a checklist. |
| `project-template/` | The application cleaned up as a starting point for YOUR project (see below). |
| `src/gateway/routes.js` | Replaces the file of episode 13: adds `GET /api/requests/{requestNo}`. `docs/openapi.json` has promised this operation since episode 6 (FR-09), and the endpoint walk was the first test that called it. Nothing else changed. |
| `review/final-facts.js`, `review/final-review.js` | The AI review: an AI answer about testing, 3 findings and 3 claims, each decided by code. |

## How verify.js works, and what it proves

`node verify.js` scans the names of all `test/*.test.js` files for tags such as `[FR-03]` and `[NFR-02]`, and then checks:

1. every requirement of `docs/requirements.json` (FR-01 to FR-12) and `docs/nfr.json` (NFR-01 to NFR-08) has at least one tagged test;
2. every requirement has at least one BEHAVIOUR test of this episode (a test in a file `ep15-*`);
3. every operation of the two OpenAPI files is named in a test, and (in `ep15-endpoints.test.js`) really called;
4. `docs/trace-links.json` promises the right tag for each requirement, and `completeness()` of episode 7 finds no gap;
5. no tag names a requirement that does not exist (a typo such as `[FR-13]`).

It prints a table (one row for each requirement), and ends with `OK`, or with the list of problems and exit code 1.

**Why "behaviour tests of episode 15"?** The tests of earlier episodes carry the same tags, and they count in the table, but many of them check the quality of a document (a requirement is well written, an OpenAPI file is complete), not the behaviour of the running system. Passing such a test does not show that the system does what the requirement says. Episode 15 therefore adds tests that run the whole application, so that each id has at least one behaviour test.

## The process and the documents

Everything starts from the BPMN process `docs/process.bpmn`. The documents grow through the episodes and all of them are in `docs/`:

| Document | Episode | What it is |
|---|---|---|
| `process.bpmn`, `process-notes.json`, `process.md`, `stakeholders.json` | 2, 3 | The process, its rules, tasks, exceptions |
| `requirements.json` (12), `nfr.json` (8), `nfr.md` | 4, 5 | The requirements, with numbers for the non-functional ones |
| `strategy-options.json`, `standards.json`, `openapi.json` | 6 | The strategy, the standards, the planned API |
| `trace-links.json`, `requirements-spec.md`, `recommendation.md`, `traceability.md` | 7 | The specification, the recommendation, the traceability matrix |
| `services.json`, `openapi-services.json` | 8, 9 | The service catalog and the API of the three services |
| `decision-matrix.json` | 11 | Microservices or SOA: the matrix |
| `architecture.md` | 14 | The UML diagrams (component, sequence, state) |
| `final-report.md`, `presentation.md` | 15 | The final report and the talk |

## The tests

`node --test` runs every test of every episode. Tests that verify a requirement carry its tag in the name: `[FR-02]`, `[NFR-03]`. Tests count by tag, because a folder holds the tests of all earlier episodes: `npm run build-report` prints the numbers. A run of `node --test` in this folder also runs the tests of `project-template/test` (they pass from either place), so the total is higher than the count of this folder's `test/`.

What the integration tests teach:

- **Real parts, fake outside world.** Services, gateway, queue and planner are real and run on free ports; the outside APIs are fakes with the same shapes (`createFakeExternal`), or the real `createExternal` over a fake `fetch`. The tests need no internet and give the same result every time.
- **Fail on purpose.** A good integration test switches a dependency off (`stop("finance")`), makes it slow, or makes it fail twice, and asserts what the system does.
- **A test must be able to fail.** The AI review shows a mutant of `decide()` that a weak test does not catch.
- **A mock can be wrong.** Keep one live check outside the test suite (`plan-live.js`).

## The project template

`project-template/` is the application with the campus domain taken out: three placeholder services made with `createResourceApp({ name, resource, fields, seed })`, the gateway, the queue, the adapters for the three free APIs, the planner skeleton with the rules as a table, a web page skeleton, the quality checkers of episodes 2 to 5, `verify.js`, and its own tests in `project-template/test`. Read `project-template/README.md`: "How to adapt this template to your project" is a numbered list of eleven steps.

```
cd project-template
node --test        # 39 tests
node verify.js     # OK
node check-docs.js # the BPMN file, the notes and the requirements pass the checkers
```

## The folders of all episodes

```
01-fundamentals              three silos (CSV, JSON, XML) and adapters
02-bpmn-modeling             BPMN reader, checker, simulator
03-bpmn-documentation        process notes, stakeholders, process.md
04-functional-requirements   FR-01 to FR-12, quality checker
05-non-functional-requirements  NFR-01 to NFR-08, measurements
06-strategies-and-standards  strategy scoring, standards, OpenAPI
07-recommendation            trace links, specification, recommendation, traceability matrix
08-soa-services              service catalog, the weather service
09-rest-with-express         three REST services (4001 to 4003), seeds, Postman
10-message-queue             queue with retry and dead letters, notifier
11-gateway-and-microservices the gateway (4000), decision matrix
12-integration-patterns      translator, aggregator, router, cache, retry, circuit breaker, adapters
13-end-to-end                planEvent, the routes, the web page, start-all.js
14-uml-architecture          Mermaid diagrams generated from the project, architecture.md
15-final-app                 this folder: integration tests, verify, demo, report, template
```

## The AI review

`npm run review:testing` checks an AI answer about testing an integrated system:

- Finding 1: mocks hide real failures, so keep one live check outside the test suite (a draft written with its own wrong fake passes, and crashes on the real shape).
- Finding 2: a test that always passes proves nothing (it kills 0 of 3 mutants of `decide()`; the real cases kill 3 of 3).
- Finding 3: tests must not depend on the real internet (with fakes no call leaves the computer; with the network down the decision changes).
- Claim 4 is false: "if all tests pass, the system has no bugs" (four toy tests pass and the border value 60 is wrong).
- Claim 5 is true: "every requirement has a test" (`verify.js`).
- Claim 6 is false: "integration tests should call the real APIs in every run".

## Known limitations

No login, no rate limiting, no database, one process, no deployment, and Finance cannot create a deposit record. `docs/final-report.md` lists them with the next steps.
