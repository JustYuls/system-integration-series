# Episode 7: From Analysis to Recommendation (LO 1.4)

This folder holds everything from the earlier episodes (BPMN, process documentation, functional and non-functional requirements, strategy, standards, OpenAPI) plus the two documents that close the analysis phase: the **requirements specification** and the **integration recommendation**, joined by a **traceability matrix**.

## What is new in this episode

| File | What it does |
|---|---|
| `docs/trace-links.json` | Links every FR to `{ service, endpoint, testTag }` and every NFR to `{ verification, evidence, testTag }`. An endpoint is `VERB /path` of `docs/openapi.json`, or it is marked `internal` (FR-11, the notice, goes through the queue) |
| `docs/risks.json` | Six risks with likelihood, impact, mitigation and the NFR each one threatens; the assumptions |
| `src/trace.js` | `buildMatrix`, `completeness`, `renderTraceability`, `counts`, `impactOf`, `loadServiceIds` |
| `src/spec.js` | `renderSpec` (the nine sections), `renderRecommendation`, `differences`, `riskProblems`, `measuredValues`, `PLAN` |
| `build-docs.js` | Writes `docs/requirements-spec.md`, `docs/recommendation.md`, `docs/traceability.md` and prints the completeness report |
| `docs/requirements-spec.md`, `docs/recommendation.md`, `docs/traceability.md` | The generated documents (run `node build-docs.js` to write them again) |
| `gap-demo.js` | Breaks three links on purpose and shows the problems that `completeness` reports |
| `review/trace-facts.js`, `review/trace-review.js` | The AI review: a recommendation draft with flaws, decided by code |
| `test/ep07-*.test.js` | 47 tests for the trace, the documents, the risks and the review |

## Run it

```
node build-docs.js              # write the three documents, print the completeness report
node gap-demo.js                # three broken links, three problems
node review/trace-review.js     # the AI review: three findings, three claims
node --test                     # every test of the folder
```

## The requirements specification

Nine numbered sections: 1 Purpose and scope, 2 Process overview (from the BPMN), 3 Stakeholders, 4 Functional requirements with acceptance criteria, 5 Non-functional requirements with targets and measured values, 6 Business rules, 7 Standards and constraints, 8 Traceability summary, 9 Risks and assumptions. It says **what** the system must do, not how it is built.

## The recommendation

An executive summary on one page, then: problem, options considered with the real weighted scores of `src/strategy.js`, criteria and weights, the decision and why, what we will not do, risks and mitigations (each tied to an NFR), and the plan by phase. The decision: an **API gateway with a message queue for notifications**, 99 of 115 points (86 percent), 5 ahead of the gateway alone.

## The traceability matrix

Each row: task, business rule, FR, service, endpoint, test tag. `completeness` reports a problem when a task, rule, FR or NFR is not linked, when an endpoint is not in `docs/openapi.json` (and not internal), when an endpoint does not list the FR in its `x-requirements`, when a requirement has no test tag, or when `trace-links.json` holds an orphan. When `docs/services.json` exists (episode 8), the service ids are checked against it too; without it the check is skipped.

The test tags (`FR-04`, `NFR-02`) are promises: the tests of the later episodes carry them in their names, and episode 15 follows each tag to a test.

## Learning outcomes

- **CLO 1:** Analyze organizational business processes and integration requirements to determine appropriate systems integration solutions using business process models and requirements analysis techniques.
- **LO 1.4:** Analyze organizational integration requirements and recommend appropriate integration strategies using business process models.
