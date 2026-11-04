# Integration project template

A starting point for YOUR final project. It is the application of the course (a planner that checks a request against three internal services and one outside API, decides, and sends a notice), with the campus story taken out and placeholders put in. It runs, its tests pass, and its documents pass the same quality checkers that you used in the course. Your job is to replace the placeholders with your own process.

```
browser page -> gateway (5000) -> customers (5001), items (5002), accounts (5003)   <- placeholders: replace
                              -> Nager.Date, Open-Meteo, Frankfurter (src/external.js)   <- examples: replace or keep
                              -> queue -> notifier
```

## What is in the folder

```
docs/            process.bpmn (skeleton), process-notes.json, requirements.json (2 examples), nfr.json (2 examples),
                 trace-links.json, openapi.json
src/services/    resource-app.js: createResourceApp({ name, resource, fields, seed }), and three placeholder services
src/gateway/     gateway.js (one door, 502 and 504), clients.js, plan.js (the rules as a TABLE), server.js (the routes)
src/             external.js (three free APIs, retry, never throws), queue.js, notifier.js, http.js, serve.js, ports.js
                 bpmn.js, document.js, requirements.js, nfr.js  (the quality checkers of the course)
                 tags.js, verify.js                              (every requirement has a tagged test)
web/             index.html, app.js, styles.css (a form and a decision card)
test/            tests with requirement tags in their names, like [FR-01]
start-all.js     starts everything on http://localhost:5000      check-docs.js   checks your documents      verify.js   checks your tests
```

## Run it

```
npm install          # only Express; inside the course repository it is found one folder up
npm start            # http://localhost:5000  (needs internet for the real outside APIs)
npm test             # the tests use fake outside APIs and need no internet
npm run check-docs   # the BPMN file, the notes, the requirements
npm run verify       # does every requirement have a test?
```

## How to adapt this template to your project

Work in this order. After every step run `npm test`, `npm run check-docs` and `npm run verify`: they must stay green.

1. **Choose your process and draw it in BPMN.** One business process with a start, a few tasks, one decision, and an end. Use lanes for the actors. Draw it in Draw.io (diagrams.net) and export it as BPMN. Replace `docs/process.bpmn`. Keep the ids `T01`, `T02`, ... for tasks, and give the decision gateway the id `G3` with the flow labels `Yes` and `No` (the checkers look for them).
2. **Document it.** Fill `docs/process-notes.json`: the purpose, the business rules (`BR-01`, ...), and for every task the actor, the system, the inputs, the outputs, the rules and the exceptions ("what if the service is down?"). Run `npm run check-docs`: "Process notes" must say OK.
3. **Write the functional and the non-functional requirements.** One functional requirement for each task, in the form "The system shall ..." with acceptance criteria "Given ..., when ..., then ...". Non-functional requirements need a number: "within 3000 ms for 95 percent of requests". Edit `docs/requirements.json` and `docs/nfr.json` (two examples are in each). The checkers name the weak words; the TODO lines list the tasks without a requirement.
4. **Choose a strategy.** Why a gateway and services, and not point-to-point? Write down your options and score them against your non-functional requirements (the method of episode 6), and keep the result in `docs/`.
5. **Name your services.** Look at your tasks: each service task is one service with one owner of the data. Write down its operations and its errors.
6. **Replace the three campus services.** The placeholders are `src/services/customers.js`, `items.js` and `accounts.js`, each one a few lines of `createResourceApp({ name, resource, fields, seed })`. Change the names, the fields (`text`, `email`, `number`, `integer`, `boolean`, `date`) and the seed data. Then change `ROUTES` in `src/gateway/gateway.js`, `PORTS` in `src/ports.js`, and `start-all.js`. When a service needs more than create, read and update, write it by hand like the services of the course.
7. **Replace the outside APIs.** Keep the ones you need in `src/external.js` and delete the others. Free APIs with no key to consider: **Open-Meteo** (weather), **Nager.Date** (public holidays), **Frankfurter** (exchange rates), **REST Countries** (facts about countries; it may redirect, so follow redirects), **Open Library** (books), **JSONPlaceholder** (fake users, posts and todos for practice). Whatever you choose, an outside API must never crash your planner: return `{ available: false, reason }`, and let the planner decide `needs-review`.
8. **Write your rules in the table of `src/gateway/plan.js`.** One row for each check, with the business rule id and the task id. A check returns `passed`, `failed` or `unknown`, with a sentence in plain language. Keep `decide()`: any failed check returns the request, an unknown one asks a person, all passed approves.
9. **Adapt the page.** Change the fields in `web/index.html` and `web/app.js`. Keep `textContent` (never `innerHTML`) for anything a user typed.
10. **Keep the tests and the traceability green.** Tag every test with the requirement it proves: `test("[FR-03] ...")`. Update `docs/trace-links.json` and `docs/openapi.json`. Add tests with failing dependencies: a service that is off, an outside API that is down, a mail server that fails twice. `npm run verify` must end with OK.
11. **Document and present it.** Write a short report (the process, the requirements, the results, the limits and the next steps) and plan an 8 minute talk with a scripted demo: see `docs/presentation.md` and `docs/final-report.md` of the course folder.

## Things to know

- `node --test` inside the course folder also runs these tests (they pass from either place). Inside a copy of this template, it runs only these.
- Requests are kept in memory in `src/gateway/server.js`. Decide which service should own them.
- The placeholders have no login, no rate limit and no database. The course report lists what a real system adds.
