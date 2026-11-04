# Series plan: System Integration and Architecture 1 (CSPI101)

A weekly video series for the course CSPI101 System Integration and Architecture 1 (BSIT): **3 primer videos** (JavaScript, Node.js, Express with HTML and CSS) and **15 weekly episodes** (Week 2 to Week 17, no episode in Weeks 9 and 18). Every episode adds one piece to the **same application**, so at the end of the course there is a working system that students use as the pattern for their own final project.

Same pattern as the Django series: an animated presenter ("Sir Yuls"), a synthetic narrator, slides with real code and real terminal output, a code folder with tests for every episode, a YouTube kit, and a quiz. New here: elements animate on the narrator's words, keywords get a gold highlighter, "REMEMBER" notes hold the sentence worth writing down, and a "Key terms" review closes every episode.

## Rules for every episode

- States the Course Learning Outcome (CLO) and the Learning Outcome (LO), word for word from the syllabus.
- Never mentions exam periods, grades, or requirements for passing.
- Adds one piece to the Campus Event Planner (code, tests, and a document), with a hands-on lab and an "AI check": an AI answer is split into findings and claims, and a script proves which are true.
- Ends with a "Check yourself" slide (3 questions). Every episode has a `quiz.md` with best-time stamps. Answers are at most 80 characters.
- Discloses the synthetic voice and cartoon presenter. On-screen "AI answers" are written with Claude, shortened, and verified in code.

## Tools and technology (decided)

- **Editor and API testing:** Visual Studio Code, with Thunder Client (or Postman).
- **Languages:** JavaScript, HTML and CSS. **Node.js** (20 or newer) and **Express** for the server. Tests use the built-in `node:test` runner. No other framework.
- **Focus:** REST APIs: resources, verbs, status codes, JSON, errors, timeouts, and how services are combined.
- **Free APIs with no key** (checked on 2026-11-04): Open-Meteo (weather), Nager.Date (public holidays), Frankfurter (exchange rates). Also available for practice: JSONPlaceholder, Open Library. REST Countries redirected during the check, so it is optional.

## The thread: one application, "Campus Event Planner"

A student organization asks to hold an event. The planner decides if the request can be approved. The same business story runs through the whole course:

1. **The business process (BPMN, Ep 2 and 3):** submit request, check the date (holiday?), check the venue, check the weather (outdoor events), check the budget (deposit paid, foreign sponsor money converted to pesos), decide, notify the organizer.
2. **The requirements (Ep 4 and 5):** functional requirements (FR-01, FR-02, ...) taken from the BPMN tasks, and non-functional requirements (NFR-01, ...) with measurable numbers.
3. **The design (Ep 6 to 8):** strategies and standards chosen *because of* the requirements, a written recommendation, and the services found in the BPMN tasks (SOA).
4. **The build (Ep 9 to 13):** three internal systems become REST services (Student Affairs, Finance, Facilities), a gateway combines them with three free outside APIs, a queue sends notifications, patterns keep it safe, and an HTML and CSS page shows the result.
5. **The proof (Ep 14 and 15):** UML and architecture documents, integration tests, and a demo.

A **traceability matrix** links every piece: BPMN task, then requirement (FR/NFR), then endpoint, then test. The pilot episode starts with the three "silos" of this story: Student Affairs (event requests, CSV), Finance (deposits, JSON) and Facilities (venue reservations, XML).

## Course learning outcomes (CLO)

1. **CLO 1:** Analyze organizational business processes and integration requirements to determine appropriate systems integration solutions using business process models and requirements analysis techniques.
2. **CLO 2:** Design scalable and interoperable systems integration solutions by applying integration architectures, reusable integration patterns, industry standards, and Service-Oriented Architecture (SOA) principles.
3. **CLO 3:** Develop, test, and evaluate service-oriented integration solutions using appropriate development tools, documentation standards, and professional practices while working collaboratively.

## Primer videos (new to JavaScript, Node.js and Express)

For students who are new to the language. About 10 minutes each, released in Week 1 and Week 2 (self-study, no course outcome). Each one builds a small, real piece of the Campus Event Planner, so nothing is wasted.

| Primer | Topic | What students build |
|---|---|---|
| P1 | JavaScript basics: variables, functions, arrays and objects, JSON, `async` and `fetch` | A function that checks one event request, and a `fetch` call to Open-Meteo |
| P2 | Node.js: running scripts, modules (`import`), `npm`, reading files, `node:test` | A script that reads the venue file and a test for it |
| P3 | Express, HTML and CSS: routes, JSON responses, a static page, `fetch` from the browser | `GET /venues` and an HTML page styled with CSS that lists the venues |

## Episodes

| Ep | Week | LO (CLO) | Topic | Piece of the application |
|---|---|---|---|---|
| 1 | 2 | 1.1 (CLO 1) | What is systems integration? Enterprise systems, silos, challenges | **Pilot, built.** Three silos (CSV, JSON, XML) combined by adapters into one view of each event request |
| 2 | 3 | 1.2 (CLO 1) | Business process modeling with BPMN: events, tasks, gateways, lanes, flows | The "event request" process drawn in Draw.io |
| 3 | 4 | 1.2 and 1.3 (CLO 1) | BPMN documentation and requirements gathering: process description, actors, data, rules, exceptions | The process document, stakeholder questions, and a script that checks the BPMN for gaps |
| 4 | 5 | 1.3 (CLO 1) | Writing functional requirements: "The system shall...", one requirement per BPMN task | FR-01 to FR-12 with acceptance criteria, and a requirement-quality checker |
| 5 | 6 | 1.3 (CLO 1) | Writing non-functional requirements and case analysis: performance, availability, security, usability, measurable | NFR-01 to NFR-08, with the real response times of the free APIs measured |
| 6 | 7 | 1.4 (CLO 1) | Integration strategies and standards: point-to-point, hub, bus, batch, real time, JSON, HTTP, OpenAPI | The strategy chosen from the NFRs, and the OpenAPI file of the planned API |
| 7 | 8 | 1.4 (CLO 1) | From analysis to recommendation: the requirements specification and the integration recommendation | The written specification and recommendation, with the traceability matrix |
| 8 | 10 | 2.1 (CLO 2) | Service-oriented architecture (SOA): services found in the BPMN tasks, contracts | The service list and contracts; Open-Meteo wrapped as the weather service |
| 9 | 11 | 2.1 (CLO 2) | REST APIs with Express: resources, verbs, status codes, errors | The three internal systems as Express REST services, tested with Thunder Client |
| 10 | 12 | 2.2 (CLO 2) | Integration technologies: middleware, EAI, message queues | An in-memory queue that sends the "notify organizer" message, with retry |
| 11 | 13 | 2.2 (CLO 2) | Microservices and SOA: comparison matrix, the API gateway | The gateway in front of the services, and the decision matrix |
| 12 | 14 | 2.3 (CLO 3) | Integration patterns: translator, aggregator, router, cache, circuit breaker | The patterns applied to Open-Meteo, Nager.Date and Frankfurter |
| 13 | 15 | 2.3 (CLO 3) | RESTful service integration end to end | `POST /requests` runs the whole process; the HTML and CSS request page; Thunder Client collection |
| 14 | 16 | 2.4 (CLO 3) | Enterprise integration architecture with UML and SOA | Component and sequence diagrams (Mermaid) generated for the project |
| 15 | 17 | 2.4 (CLO 3) | Integration testing, documentation, and presenting the project | `node:test` integration tests with a failing dependency, final demo, and how to reuse the application as the pattern for your own final project |

Publishing: one episode at the start of its class week. Primers P1 and P2 in Week 1, P3 in Week 2.

Why FR and NFR have an episode each (weeks 5 and 6): they are the part students most often get wrong, so they get a full episode each. This moves "integration strategies and standards" into one episode (week 7) and keeps the recommendation in week 8. The syllabus topics are all still covered.

## Repository layout

```
01-fundamentals/ ... 15-final-app/   code, tests, README, docs for each episode (each one contains the application as it is at that point)
primers/                             the three primer labs
project-template/                    (Ep 15) the application cleaned up as a starting point for the final project
videos/  kits/                       rendered videos and YouTube kits (not committed)
```

Documents that grow through the episodes (in each folder's `docs/`): `process.bpmn` and `process.md` (BPMN and its documentation), `requirements.md` (FR and NFR), `recommendation.md`, `traceability.md`, `architecture.md`.
