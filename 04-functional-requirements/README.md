# Episode 4: Writing Functional Requirements (LO 1.3)

The fourth piece of the **Campus Event Planner**. Episodes 2 and 3 drew and documented the event request process (BPMN). This episode turns each task of that process into **functional requirements**: statements of what the system does, written as "The system shall ...", each with an actor, a priority (Must, Should, Could), the business rules it applies, and acceptance criteria in the form Given, when, then. A checker tests the quality of every requirement and proves that the list covers the whole process.

## Learning outcomes

- **CLO 1:** Analyze organizational business processes and integration requirements to determine appropriate systems integration solutions using business process models and requirements analysis techniques.
- **LO 1.3:** Differentiate functional and non-functional integration requirements through case analysis.

## What you need

Visual Studio Code and Node.js 20 or newer. There is nothing to install.

## What is in this folder

| Path | What it is |
|---|---|
| `docs/process.bpmn` | The event request process (episode 2) |
| `docs/process-notes.json`, `docs/process.md`, `docs/stakeholders.json` | The process documentation (episode 3) |
| `docs/requirements.json` | **New.** FR-01 to FR-12: id, statement, task, actor, priority, rules, acceptance |
| `docs/requirements.md` | **New.** The same list as a readable document, grouped by BPMN task |
| `src/requirements.js` | **New.** Quality rules, coverage check, document writer |
| `check-requirements.js` | **New.** Prints the problems and writes `docs/requirements.md` |
| `review/fr-facts.js`, `review/fr-review.js` | **New.** Checks what an AI assistant said about a requirement list |
| `src/bpmn.js`, `src/document.js`, `src/layout.js` | Code of the earlier episodes |

## The requirements

| Id | Task | Priority | In short |
|---|---|---|---|
| FR-01 | T01 Submit event request | Must | List the missing fields (BR-06) |
| FR-02 | T02 Check date for holidays | Must | Fail on a public holiday (BR-01) |
| FR-03 | T03 Check venue availability | Must | Fail when reserved or too small (BR-03) |
| FR-04 | T03 Check venue availability | Must | Fail on an unpaid penalty (BR-04) |
| FR-05 | T04 Check weather forecast | Must | Fail when an outdoor event has 60 percent rain or more (BR-02) |
| FR-06 | T05 Check deposit and budget | Must | Fail when the deposit is unpaid (BR-05) |
| FR-07 | T05 Check deposit and budget | Should | Convert the budget to pesos (BR-07) |
| FR-08 | G3 All checks passed? | Must | Approve only when all four checks passed (BR-08) |
| FR-09 | T06 Approve request | Must | Set the status to Approved (BR-08) |
| FR-10 | T08 Return request for revision | Must | Return with the reason of every failed check (BR-08) |
| FR-11 | T07 Notify organizer | Must | Send the decision and the reasons |
| FR-12 | G3 All checks passed? | Should | Mark needs-review when an outside service does not answer |

## Run it

```bash
cd 04-functional-requirements
node check-requirements.js
```

```
12 functional requirements
OK: every requirement meets the quality rules
Coverage: 8 of 8 tasks have a requirement
  T01  Submit event request           FR-01
  T02  Check date for holidays        FR-02
  T03  Check venue availability       FR-03, FR-04
  T04  Check weather forecast         FR-05
  T05  Check deposit and budget       FR-06, FR-07
  T06  Approve request                FR-09
  T07  Notify organizer               FR-11
  T08  Return request for revision    FR-10
OK: every business rule is used by a requirement
written docs\requirements.md
```

The quality rules (`checkRequirement` in `src/requirements.js`):

- the statement starts with "The system shall" and has exactly one "shall";
- no vague words (fast, easy, user-friendly, flexible, etc., approximately, as appropriate ...) and no "and/or";
- at least one acceptance criterion, each one in the form Given, when, then;
- the id has the form FR-NN and is unique, the priority is Must, Should or Could;
- the task exists in the BPMN, the actor is the lane of that task, and every rule exists in `process-notes.json`.

To check another file, pass it as an argument: `node check-requirements.js my-draft.json`.

## The AI check

```bash
node review/fr-review.js
```

An AI-drafted requirement list has four defects (vague, compound, no acceptance criteria, an orphan task) and forgot one task. Three findings are confirmed by the quality rules, two claims are false and one is true, each decided by code.

## Test it

```bash
node --test
```

The whole suite passes (the tests of episodes 2 and 3 as well). Tests whose name starts with `[FR-nn]` verify one requirement; episode 15 follows these tags for the traceability proof.

## Next

Episode 5 adds the non-functional requirements (NFR-01 to NFR-08): how well the system does its job, with numbers you can measure.
