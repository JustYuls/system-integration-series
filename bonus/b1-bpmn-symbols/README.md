# Bonus 1: BPMN symbols, a visual guide, how to draw a process, and examples

A companion to Episode 2. Episode 2 models our event request process; this bonus tours every BPMN symbol the course uses and gives a seven-step method for drawing a process. Supports LO 1.2 and CLO 1. Plain Node.js, no dependencies.

## What is here

- `docs/symbols.json`: the catalog of 25 symbols (events, activities, gateways, flows, swimlanes, artifacts), each with shape, marker, meaning, when to use it, a campus example and a common mistake.
- `examples/`: `library-borrowing.bpmn`, `online-order.bpmn`, `event-request.bpmn` (copy of the Episode 2 process) and `broken-order.bpmn` (flawed on purpose). All have a diagram, so Draw.io or bpmn.io can open them.
- `src/bpmn.js`, `src/layout.js`: copied from Episode 2 (reader, checker, token simulator, layout). `src/symbols.js`: catalog helpers (`bySymbol`, `byCategory`, `checkCatalog`, `symbolOf`).
- `review/`: facts and review of an AI explanation of the symbols (3 findings, 3 claims, decided by code).

## Run it

```bash
cd bonus/b1-bpmn-symbols
node check-examples.js            # the three examples: OK, counts, symbols used
node check-examples.js --broken   # the flawed order: lists its problems (exit code 1)
node walk-through.js              # a token through every example (or: node walk-through.js online-order)
node review/symbols-review.js     # the AI review
node --test                       # 46 tests
```

The seven steps: 1 scope (start and end), 2 main tasks (verb and object), 3 lanes, 4 decisions with labelled gateways, 5 parallel work with joins, 6 exceptions, 7 review with the checklist.
