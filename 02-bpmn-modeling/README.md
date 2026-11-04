# Episode 2: Business process modeling with BPMN (LO 1.2)

The second piece of the **Campus Event Planner**: the business process. The "Event request process" is drawn in BPMN 2.0 (`docs/process.bpmn`): an organizer submits a request, four checks run in parallel (holiday, venue, weather, deposit and budget), and a decision is sent back to the organizer. A small JavaScript reader checks the file against the modeling rules, a token simulator runs the process, and `layout.js` writes the picture (shapes and arrows) into the same file so Draw.io or bpmn.io can show it. A `review` folder verifies what an AI assistant said about gateways.

## Learning outcomes

- **CLO 1:** Analyze organizational business processes and integration requirements to determine appropriate systems integration solutions using business process models and requirements analysis techniques.
- **LO 1.2:** Describe enterprise systems and model organizational business processes using BPMN.

## What you need

Visual Studio Code and Node.js 20 or newer. There is nothing to install. To draw your own process, use Draw.io (diagrams.net) or the free modeler at bpmn.io.

## Run it

```bash
cd 02-bpmn-modeling
node bpmn-check.js
node simulate-demo.js
```

```
Event request process: 14 elements, 17 flows, 3 lanes
OK: no problems found
```

```
All checks passed? Yes
  Event idea ready  ->  Submit event request  ->  Run the checks  ->  Check date for holidays  ->  Check venue availability  ->  Check weather forecast  ->  Check deposit and budget  ->  All checks done  ->  All checks passed?  ->  Approve request  ->  Decision made  ->  Notify organizer  ->  Organizer notified
All checks passed? No
  Event idea ready  ->  Submit event request  ->  Run the checks  ->  Check date for holidays  ->  Check venue availability  ->  Check weather forecast  ->  Check deposit and budget  ->  All checks done  ->  All checks passed?  ->  Return request for revision  ->  Decision made  ->  Notify organizer  ->  Organizer notified
```

The four checks all run, and the join ("All checks done") runs once. Only one of "Approve request" and "Return request for revision" runs.

## Test it

```bash
npm test          # 30 tests, built-in node:test runner
```

## The AI review

```bash
node review/bpmn-review.js
```

```
FINDING 1  the weather check is a dead end                 T04 never reaches an end   confirmed
FINDING 2  the gateway after the checks has one exit       G3 must split or join      confirmed
FINDING 3  the budget check is not in any lane             T05 has no owner           confirmed
CLAIM 4    an exclusive gateway sends the token down every path   approve and return both ran: false   FALSE
CLAIM 5    a parallel gateway starts all its paths                all 4 checks ran: true              TRUE
CLAIM 6    the join continues after the first check finishes      join waited for all 4: true     FALSE
```

The AI answer used in the video was written with Claude (Anthropic), shortened, and verified with this code.

## What is in the folder

| Path | What it is |
|---|---|
| `docs/process.bpmn` | the Event request process: 3 lanes, 14 elements, 17 flows, with the diagram |
| `src/bpmn.js` | `parseBpmn`, `check` (the modeling rules), `simulate` (tokens, parallel split and join) |
| `src/layout.js` | places the elements on a grid and writes the diagram part of the file |
| `bpmn-check.js` | prints the checker result for `docs/process.bpmn` |
| `simulate-demo.js` | runs the process with the decision Yes and with No |
| `add-diagram.js` | writes the shapes and arrows into `docs/process.bpmn` |
| `review/` | the flawed draft, the facts, and the review script |
| `test/` | 30 tests |

## Where this goes next

BPMN is step 1 of the project. Episode 3 documents the process (actors, data, rules, exceptions) and checks it for gaps. From episode 4 on, each task of this diagram becomes requirements, then services, endpoints and tests. See [SERIES_PLAN.md](../SERIES_PLAN.md).

## Practice

1. Open `docs/process.bpmn` in bpmn.io. Which lane has the most elements?
2. In `docs/process.bpmn`, delete the flow `F10`. Which rule of `node bpmn-check.js` fails first?
3. Add a task "Check the sponsor" in parallel with the four checks. What must you add so the join still waits for all of them?
4. Draw the process "Return a library book" in Draw.io with one exclusive gateway. Name every task with a verb.
