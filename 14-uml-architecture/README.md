# Campus Event Planner, episode 14: enterprise integration architecture with UML and SOA

Week 16, LO 2.4, CLO 3. The planner is built. This episode documents its architecture so that the team, and the next person who joins, can read it: four UML diagrams and an architecture document, all **generated from the real project data** so they cannot drift from the code.

```
docs/services.json  src/ports.js  docs/process.bpmn  student-affairs.js (statuses)
        |
        v
src/diagrams.js  ->  component, sequence, state, deployment (Mermaid text)
        |                         |
        v                         v
src/diagram-check.js        generate-diagrams.js  ->  docs/architecture.md
```

## What is new

| File | What it does |
|---|---|
| `src/diagrams.js` | `componentDiagram`, `sequenceDiagram`, `stateDiagram`, `deploymentDiagram`, `buildDiagrams`. The component and deployment diagrams come from `services.json` and `ports.js`; the sequence diagram follows the BPMN graph (`processShape` reads the tasks, the parallel checks, the decision); the state diagram uses the real `STATUSES`. |
| `src/diagram-check.js` | Small parsers and checkers. Component: every service and outside API is there, the page talks only to the gateway, an outside API is called only by its adapter. Sequence: every task T01..T08 appears in process order, no unknown participant, balanced `par`/`and`/`end`. State: every status is a state, every state can be left and reached. Deployment: every port. |
| `src/architecture-doc.js` | Writes the text of `docs/architecture.md`: purpose, context, the four diagrams, a component table with ports, decisions (quotes the strategy that episode 6 chose, read defensively), quality attributes tied to NFR-01..08, how to view the diagrams. |
| `generate-diagrams.js` | Builds and checks the diagrams, then writes `docs/architecture.md`. `node generate-diagrams.js --print sequence` prints one diagram. |
| `docs/uml-kinds.json` | The seven UML kinds this course names: the question each answers, structure or behavior, whether it shows order, and its use in this project. |
| `docs/architecture.md` | The generated architecture document (GitHub draws the diagrams). |
| `review/uml-facts.js`, `uml-review.js`, `draft-diagrams.js` | The AI review: an AI draft of the diagrams with three mistakes, and three claims about UML. |
| `test/ep14-*.test.js` | Tests, including one that fails when `docs/architecture.md` is older than the data. |

## The four diagrams

| Diagram | Question | Mermaid |
|---|---|---|
| Component | Which parts exist, and which is connected to which? | `flowchart LR` with subgraphs |
| Sequence | In which order do the parts talk (one `POST /api/requests`)? | `sequenceDiagram`, `par ... and ... end` for the four checks, `alt` for the decision |
| State | Which states does a request go through? | `stateDiagram-v2` |
| Deployment | Which process runs where, on which port? | `flowchart TB` with nested subgraphs |

The state diagram is honest about who moves a request: `planEvent` sets `Approved` (T06) or `Returned` (T08); a `needs-review` decision leaves the request `Pending`; an officer puts a request `On hold` and decides it later (the service accepts any status in a `PATCH`); `DELETE` withdraws a `Pending` request. `test/ep14-behavior.test.js` proves each arrow.

## Run it

```
npm run diagrams            # check the diagrams and write docs/architecture.md
npm run review:uml          # the AI review
npm test
```

To change a diagram, change the data it comes from (a service in `docs/services.json`, a task in `docs/process.bpmn`), run `npm run diagrams`, and commit the new `docs/architecture.md`.

## View the diagrams

- GitHub draws the Mermaid blocks of `docs/architecture.md`.
- Visual Studio Code: a Mermaid extension, then the Markdown preview.
- mermaid.live: paste the text of one diagram.
