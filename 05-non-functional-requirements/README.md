# Episode 5: Writing Non-Functional Requirements and Case Analysis (LO 1.3)

Functional requirements say **what** the Campus Event Planner does. Non-functional requirements (NFRs) say **how well**: how fast, how available, how safe, how easy. This folder holds everything from the earlier episodes (the BPMN process, its documentation) plus:

- `docs/nfr.json`: eight NFRs, one for each category: performance, availability, reliability, security, usability, interoperability, maintainability, capacity. Each one has a statement, a metric, a numeric target (value, unit, comparison) and a measure (how we verify it).
- `src/nfr.js`: loads the list, checks the quality of each NFR (`checkNfr`: category from the list, a number, a unit, a metric, a measure, and no vague words such as fast, user-friendly, robust, scalable or secure without a number), `categoriesCovered`, and `evaluate` (target against measured value).
- `src/measure.js`: `measureApi(call, { runs, now })` times a call (the clock and the call are parameters, so tests use fakes), `percentile`, and `feasibility`: can the planner meet its time limit, given the measured outside APIs?
- `measure-apis.js`: live demo. Calls Open-Meteo, Nager.Date and Frankfurter 10 times each and writes `docs/measurements.sample.json`. The tests read that saved file and never use the network.
- `check-nfr.js`: prints the problems of the list and writes `docs/nfr.md`.
- `review/`: the AI review of an AI-written NFR list.

## Learning outcomes

- **CLO 1:** Analyze organizational business processes and integration requirements to determine appropriate systems integration solutions using business process models and requirements analysis techniques.
- **LO 1.3:** Differentiate functional and non-functional integration requirements through case analysis.

## What you need

Visual Studio Code and Node.js 20 or newer. There is nothing to install.

## The NFRs

| ID | Category | Target |
|---|---|---|
| NFR-01 | performance | 95 percent of planning decisions within 3000 ms |
| NFR-02 | availability | an outside API is down: still answer, needs-review (100 percent) |
| NFR-03 | reliability | an outside call is retried up to 3 times |
| NFR-04 | security | 0 secrets in the repository, 0 inputs without validation |
| NFR-05 | usability | 100 percent of reasons in plain language |
| NFR-06 | interoperability | JSON over HTTP, ISO 8601 dates, ISO 4217 currency codes |
| NFR-07 | maintainability | 100 percent of endpoints have an automated test |
| NFR-08 | capacity | 20 planning requests per minute |

A case shows where a number comes from. On Foundation Day, 2,000 students see the announcement, and about 1 percent of them (20) want to plan an activity in the same minute: that is NFR-08.

## Check the list

```bash
cd 05-non-functional-requirements
node check-nfr.js
```

```
8 non-functional requirements, 8 of 8 categories covered
OK: every requirement has a category, a number, a metric and a measure
NFR-01 feasibility: slowest outside p95 1260 ms + 500 ms = 1760 ms (limit 3000 ms)
  NFR-01  <= 3000 ms                    1760  pass
  NFR-02  >= 100 percent                   -  not measured
  ...
written docs\nfr.md
```

A requirement with no measured value is "not measured", never a pass. `node check-nfr.js --draft` checks the AI-written draft list (three vague items fail).

## Measure the free APIs (live)

```bash
node measure-apis.js
```

```
API          runs fails   min   avg   p95   max   (ms)
Open-Meteo     10     0   250   358  1260  1260
Nager.Date     10     0    87   166   762   762
Frankfurter    10     0    93   181   915   915
```

These are the numbers of one laptop on one afternoon (2026-11-04); yours will differ. With 10 runs the p95 is the slowest run, so use more runs for a firm number. The three calls run in parallel, so the slowest one counts: 1260 + 500 ms of our own work = 1760 ms, inside the 3000 ms of NFR-01. One after another they would need 3437 ms, and three tries of the slowest call 4280 ms: reliability (NFR-03) and speed (NFR-01) pull against each other, and a decision has to be made (for example a shorter timeout for each try).

## Test it

```bash
npm test
```

Tests that verify a requirement carry its tag in the name, for example `[NFR-01]`. Episode 15 scans for these tags.

## The AI review

```bash
node review/nfr-review.js
```

```
FINDING 1  three of the five requirements are vague words      3 of 5 fail the rules          confirmed
FINDING 2  the list has no reliability or interoperability     missing: 4 of 8 categories  confirmed
FINDING 3  500 ms for every request cannot be met              needs 1760 ms at least        confirmed
CLAIM 4    calling the three APIs one after another still fits   3437 ms against 3000   FALSE
CLAIM 5    three tries of the slowest call still fit            4280 ms against 3000   FALSE
CLAIM 6    the real list covers all eight categories             8 of 8 covered           TRUE
```

The AI answer used in the video was written with Claude (Anthropic), shortened, and verified with this code.
