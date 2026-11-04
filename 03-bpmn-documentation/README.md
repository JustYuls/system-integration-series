# Episode 3 (Week 4): BPMN documentation and requirements gathering

A diagram shows the flow. It does not say who does a task, what goes in and out, which rule applies, or what happens when something fails. This episode writes that down, checks it with a script, and prepares the questions to ask the people who know the process.

**Course Learning Outcome 1 (CLO 1):** Analyze organizational business processes and integration requirements to determine appropriate systems integration solutions using business process models and requirements analysis techniques.

**Learning Outcome 1.2 (LO 1.2), completed here:** Describe enterprise systems and model organizational business processes using BPMN.

**Learning Outcome 1.3 (LO 1.3), begins here:** Differentiate functional and non-functional integration requirements through case analysis.

## What you need

- Node.js 20 or newer (24 recommended). No `npm install` is needed: the folder uses only built-in modules and Express from the course folder.
- Visual Studio Code.
- The folder `03-bpmn-documentation` (it contains everything from episode 2, too).

## Run it

```
node document-process.js
```

Real output:

```
8 tasks documented, 8 business rules
OK: every task is documented
OK: every stakeholder has good questions
written docs\process.md
```

The script checks `docs/process-notes.json` against `docs/process.bpmn`, then writes `docs/process.md`. If a gap is found it prints it, writes nothing, and exits with code 1.

The tests (the whole folder, episodes 2 and 3):

```
node --test
```

Result: **57 tests, 57 pass, 0 fail.**

The AI review:

```
node review/docs-review.js
```

```
FINDING 1  the weather check is given to the wrong actor        T04 is in another lane     confirmed
FINDING 2  the budget check says nothing about failures         T05 has no exception       confirmed
FINDING 3  the currency rule is never used by a task            BR-07 is orphaned          confirmed
CLAIM 4    the process runs two checks in parallel              the gateway starts 4            FALSE
CLAIM 5    the rain rule applies to every event                 BR-02 is outdoor only: true   FALSE
CLAIM 6    every service task calls an outside API              3 of 4 do                FALSE
```

The three findings are true, so keep them. Claims 4, 5 and 6 are false, so reject them.

## What is in the folder

| File | What it is |
|---|---|
| `docs/process.bpmn` | The event request process (episode 2) |
| `docs/process-notes.json` | New. Purpose, business rules BR-01 to BR-08, and for each task T01 to T08: actor, system, outside API, inputs, outputs, rules, exceptions. Also the decision G3 |
| `docs/stakeholders.json` | New. Five stakeholders (SH1 to SH5), the technique for each, and three open questions each |
| `docs/process.md` | New, generated. The process document: purpose, who takes part, steps, a table for each task, decisions, business rules |
| `src/document.js` | New. `gaps()` finds what is missing, `renderProcessDoc()` writes the document, `questionProblems()` checks the questions |
| `document-process.js` | New. Runs the checks and writes `docs/process.md` |
| `review/docs-facts.js`, `review/docs-review.js` | New. The AI review: three findings and three claims, each decided by code |
| `test/ep03-*.test.js` | New. The tests for this episode |

Everything from episode 2 is still here: `src/bpmn.js`, `src/layout.js`, `bpmn-check.js`, `simulate-demo.js`, `add-diagram.js`.

## What the gap checker looks for

- A task with no notes, no actor, no inputs or no outputs.
- An actor in the notes that is not the lane of the task in the diagram.
- A service task with no system, or with no exception ("what if the service is down?").
- A rule that a task uses but that does not exist, or a rule that no task uses.
- Notes for a task that is not in the process.

The question checker rejects a question that can be answered with yes or no, for example `Is the form slow?`, and a lane that nobody is asked about.

## Practice

1. Open `docs/process-notes.json`. Remove the `exceptions` of `T03` and run `node document-process.js`. Read the gap, then put it back.
2. Change the actor of `T06` to `Organizer`. What does the checker say, and why?
3. Add a rule `BR-09` that no task uses. Which gap appears? Link it to a task to fix it.
4. In `docs/stakeholders.json` change one question into a yes or no question. Which message do you get? Rewrite it as an open question.
5. Write three open questions for a new stakeholder: the campus security office.
6. Read `docs/process.md`. For `T05`, can you tell what to build from the table alone? What is still missing?

## Where this goes next

Episode 4 (Week 5, LO 1.3), "Writing functional requirements": each BPMN task, with its inputs, outputs, rules and exceptions from these notes, becomes functional requirements written as "The system shall...", with a requirement-quality checker.
