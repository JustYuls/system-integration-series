# Episode 6: Integration Strategies and Standards (LO 1.4)

The non-functional requirements of episode 5 choose **how** the systems of the Campus Event Planner are connected. This folder holds everything from the earlier episodes (BPMN, documentation, functional and non-functional requirements) plus:

- `docs/strategy-options.json`: six options (point-to-point, hub-and-spoke with an API gateway, enterprise service bus, batch file transfer (ETL), event-driven with a message queue, and a gateway with a queue for notifications). Each is rated 1 to 5 on nine criteria: the eight NFR categories and cost. It also holds the priority (Must, Should, Could) of each NFR and the cost constraint.
- `src/strategy.js`: `criteriaWeights(nfrs, priorities, constraints)`, `scoreOptions(options, weights)`, `explain(ranking)`, `sensitivity(options, weights, criterion)`, `sensitivityAll`.
- `docs/standards.json`: the 12 standards and practices of the project (7 standards, 5 practices), each with the NFR it serves.
- `src/standards.js`: validators `isIsoDate`, `isCurrencyCode`, `isErrorBody`, `checkEnvelope`.
- `docs/openapi.json`: OpenAPI 3.0.3 file of the planned public API of the gateway. Every operation lists the functional requirements it satisfies in `x-requirements`.
- `src/openapi-check.js`: `checkOpenApi(doc)` (structure, status codes, Error schema, links to the requirements) and `coverageTable`.
- `choose-strategy.js`, `check-openapi.js`, `check-standards.js`: command line tools that print real output.
- `review/`: the AI review of an AI recommendation.

## Learning outcomes

- **CLO 1:** Analyze organizational business processes and integration requirements to determine appropriate systems integration solutions using business process models and requirements analysis techniques.
- **LO 1.4:** Analyze organizational integration requirements and recommend appropriate integration strategies using business process models.

## What you need

Visual Studio Code and Node.js 20 or newer. There is nothing to install.

## How the weights are made

The rule is in `criteriaWeights`:

- An NFR is worth **3 points** if its priority is Must, **2** if Should, **1** if Could (no priority counts as Must).
- The weight of a category is the sum of the points of its NFRs.
- **Cost** is not an NFR. It is a project constraint with a fixed weight of 3 (a small team, one semester).

Result: performance 3, availability 3, reliability 3, security 3, interoperability 3, cost 3, usability 2, maintainability 2, capacity 1. The score of an option is the sum of (rating x weight); the highest possible is 115.

## Choose the strategy

```bash
cd 06-strategies-and-standards
node choose-strategy.js
```

| Rank | Option | Points |
|---|---|---|
| 1 | Gateway + queue for notifications | 99 of 115 |
| 2 | Hub-and-spoke (API gateway) | 94 |
| 3 | Event-driven (message queue) | 81 |
| 4 | Enterprise service bus (ESB) | 77 |
| 5 | Batch file transfer (ETL) | 63 |
| 6 | Point-to-point | 59 |

The numbers decide: an **API gateway** for the answer, and a **message queue** for the notice to the organizer. The sensitivity check doubles one weight at a time: the winner never changes. Cost comes closest (margin 2), then maintainability (margin 3). The ratings are our judgment; change one and run again.

## The standards

```bash
node check-standards.js
```

JSON over HTTP, UTF-8, ISO 8601 dates (`2027-03-04`), ISO 4217 currency codes (`PHP`, `USD`), HTTP verbs and status codes, OpenAPI 3, one error format, timeouts (3 x 800 + 500 = 2900 ms), idempotent retries, the version in the URL, and no secrets in code.

## The OpenAPI file

```bash
node check-openapi.js
```

Four operations: `POST /api/requests` (201, 400), `GET /api/requests/{requestNo}` (200, 404), `GET /api/requests/{requestNo}/assessment` (200, 404), `GET /health` (200). All 10 Must requirements of `docs/requirements.json` are served by an operation or listed in `x-internal-requirements` (FR-11, the notice, goes through the queue).

## The AI review

```bash
node review/strategy-review.js
```

An AI recommends a strategy. Three findings are confirmed (the gateway with a queue ranks first, point-to-point needs 15 links for 6 systems, no doubled weight changes the winner). Two claims are false (an ESB is best for 3 services; dates as dd/mm/yyyy) and one is true (the API file covers every Must requirement).

## Tests

```bash
npm test
```

Tests tagged `[NFR-06]` check the interoperability conventions (ISO dates, currency codes, JSON), `[NFR-05]` the error format, `[NFR-07]` the OpenAPI file.
