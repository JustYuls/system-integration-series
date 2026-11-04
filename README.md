# System Integration and Architecture 1: From Silos to Services

A weekly video series and code for the course CSPI101 System Integration and Architecture 1 (BSIT), open for anyone learning. There are 3 primer videos (for students who are new to JavaScript, Node.js and Express) and 15 episodes of about 10 minutes, one for each teaching week from Week 2 to Week 17. Every episode adds one piece to the same application, the **Campus Event Planner**, so at the end of the course there is a working system that students can use as the pattern for their own final project. See [SERIES_PLAN.md](SERIES_PLAN.md) for the week-by-week plan.

The Campus Event Planner decides whether a student organization may hold an event. It combines three campus systems (Student Affairs, Finance, Facilities) and three free outside APIs that need no key (Open-Meteo for weather, Nager.Date for public holidays, Frankfurter for exchange rates), behind an Express REST gateway, with a message queue and an HTML, CSS and JavaScript page.

## Primers (Week 1 and 2)

| Primer | Folder | What you build |
|---|---|---|
| P1 | [`primers/p1-javascript`](primers/p1-javascript) | JavaScript basics: a request checker and a weather call with `fetch` |
| P2 | [`primers/p2-node`](primers/p2-node) | Node.js: modules, files, command-line arguments, `node:test` |
| P3 | [`primers/p3-express`](primers/p3-express) | Express, HTML and CSS: a venues API and a styled page |

## Episodes

| Ep | Week | Folder | Learning outcome | The piece you add |
|---|---|---|---|---|
| 1 | 2 | [`01-fundamentals`](01-fundamentals) | LO 1.1 | Three silos (CSV, JSON, XML) combined by adapters |
| 2 | 3 | [`02-bpmn-modeling`](02-bpmn-modeling) | LO 1.2 | The event request process in BPMN, with a checker and a simulator |
| 3 | 4 | [`03-bpmn-documentation`](03-bpmn-documentation) | LO 1.2, 1.3 | Process documentation and requirements gathering |
| 4 | 5 | [`04-functional-requirements`](04-functional-requirements) | LO 1.3 | Functional requirements FR-01 to FR-12 |
| 5 | 6 | [`05-non-functional-requirements`](05-non-functional-requirements) | LO 1.3 | Non-functional requirements NFR-01 to NFR-08, with measured API speeds |
| 6 | 7 | [`06-strategies-and-standards`](06-strategies-and-standards) | LO 1.4 | Integration strategy chosen by weighted scores, standards, OpenAPI |
| 7 | 8 | [`07-recommendation`](07-recommendation) | LO 1.4 | Requirements specification, recommendation, traceability matrix |
| 8 | 10 | [`08-soa-services`](08-soa-services) | LO 2.1 | The service catalog and the weather service |
| 9 | 11 | [`09-rest-with-express`](09-rest-with-express) | LO 2.1 | Three Express REST services, OpenAPI, Postman collection |
| 10 | 12 | [`10-message-queue`](10-message-queue) | LO 2.2 | A message queue with retry and dead letters |
| 11 | 13 | [`11-gateway-and-microservices`](11-gateway-and-microservices) | LO 2.2 | The API gateway and the decision matrix |
| 12 | 14 | [`12-integration-patterns`](12-integration-patterns) | LO 2.3 | Cache, retry, circuit breaker, aggregator, translator |
| 13 | 15 | [`13-end-to-end`](13-end-to-end) | LO 2.3 | The planner: the whole process, REST API and web page |
| 14 | 16 | [`14-uml-architecture`](14-uml-architecture) | LO 2.4 | UML diagrams generated from the project |
| 15 | 17 | [`15-final-app`](15-final-app) | LO 2.4 | Integration tests, traceability proof, the project template |

Each episode folder contains the whole application as it is at that point (the folder of episode N includes the work of the earlier episodes). Episode 1 is a stand-alone lab; Episode 2 starts the Campus Event Planner. The finished application is in `15-final-app`, and `15-final-app/project-template` is a clean starting point for your own project.

## What you need

Visual Studio Code, Node.js 20 or newer, and Thunder Client (or Postman) to try the APIs. From Episode 9 run `npm install` once in the folder you use (it installs Express). The labs call free APIs that need no key, but all tests run offline.

```bash
cd 15-final-app
npm install
node --test           # all tests, no internet needed
node verify.js        # every requirement has a tagged test
node start-all.js     # then open http://localhost:4000
```

The narration in the videos is a synthetic (text-to-speech) voice and the presenter is an animated cartoon. AI assistant answers shown in the videos were written with Claude (Anthropic), shortened, and verified with the code in the `review` folders.

## License

MIT, see [LICENSE](LICENSE).
