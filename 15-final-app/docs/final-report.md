# Campus Event Planner: final report

Written by `node build-report.js` from the real files of this folder.

## 1. The process

The process "Event request process" has 8 tasks, 4 gateways and 3 lanes (Organizer, Planner System, Student Affairs Officer).
It is documented with 8 business rules (BR-01, BR-02, BR-03, BR-04, BR-05, BR-06, BR-07, BR-08). Purpose: Decide quickly and fairly whether a student organization may hold an event, using the rules of the campus and facts from the campus systems and free public APIs.

| Task | Name | Type |
|---|---|---|
| T01 | Submit event request | userTask |
| T02 | Check date for holidays | serviceTask |
| T03 | Check venue availability | serviceTask |
| T04 | Check weather forecast | serviceTask |
| T05 | Check deposit and budget | serviceTask |
| T06 | Approve request | userTask |
| T08 | Return request for revision | userTask |
| T07 | Notify organizer | sendTask |

## 2. Requirements

12 functional and 8 non-functional requirements.

| Id | Task | Priority | Statement |
|---|---|---|---|
| FR-01 | T01 | Must | The system shall list the missing fields when an organizer submits a request without a title, date, venue, attendees or budget. |
| FR-02 | T02 | Must | The system shall mark the date check as failed when the event date is a public holiday in the Philippines. |
| FR-03 | T03 | Must | The system shall mark the venue check as failed when the venue is reserved on the date or holds fewer people than the attendees. |
| FR-04 | T03 | Must | The system shall mark the venue check as failed when the venue has an unpaid facility penalty. |
| FR-05 | T04 | Must | The system shall mark the weather check as failed when an outdoor event has a rain chance of 60 percent or more on its date. |
| FR-06 | T05 | Must | The system shall mark the budget check as failed when the deposit of the request is not fully paid. |
| FR-07 | T05 | Should | The system shall convert a budget in another currency to Philippine pesos at the latest exchange rate. |
| FR-08 | G3 | Must | The system shall approve a request only when the holiday, venue, weather and budget checks all passed. |
| FR-09 | T06 | Must | The system shall set the status of a request to Approved when the officer approves it. |
| FR-10 | T08 | Must | The system shall return a request to the organizer with the reason of every failed check. |
| FR-11 | T07 | Must | The system shall send the organizer a notice with the decision and its reasons. |
| FR-12 | G3 | Should | The system shall mark a request as needs-review when an outside service does not answer and no other check failed. |

| Id | Category | Target | Statement |
|---|---|---|---|
| NFR-01 | performance | <= 3000 ms | The planner shall give a planning decision within 3000 ms for 95 percent of requests. |
| NFR-02 | availability | >= 100 percent | When an outside API is down, the planner shall still answer, and the decision shall be needs-review. |
| NFR-03 | reliability | <= 3 attempts | The planner shall retry a failed outside call up to 3 times before it gives up. |
| NFR-04 | security | = 0 findings | The repository shall hold no secrets or API keys, and the planner shall validate all input. |
| NFR-05 | usability | >= 100 percent | The planner shall give the organizer every reason for a decision in plain language. |
| NFR-06 | interoperability | >= 100 percent | The planner shall exchange JSON over HTTP, write dates in ISO 8601, and write currencies as ISO 4217 codes. |
| NFR-07 | maintainability | >= 100 percent | Every endpoint of the planner shall have at least one automated test. |
| NFR-08 | capacity | >= 20 requests per minute | The planner shall handle 20 planning requests per minute without errors. |

## 3. Results for the non-functional requirements

A real run of `node --test` (913 tests, 19 s).

| Id | Verified by | Tagged tests | Passing | Evidence |
|---|---|---|---|---|
| NFR-01 | measurement | 13 | 15 of 15 | measure-apis.js times the three outside APIs: the slowest p95 (1260 ms) plus 500 ms of our own work is 1760 ms. |
| NFR-02 | test | 31 | 38 of 38 | An integration test makes each outside API fail in turn and expects the decision needs-review. |
| NFR-03 | test | 8 | 8 of 8 | A unit test with a fake fetch that always fails counts the attempts: at most 3. |
| NFR-04 | test | 6 | 6 of 6 | A test scans the source files for key patterns; each endpoint test sends one bad input and expects 400. |
| NFR-05 | review | 9 | 9 of 9 | A test rejects codes such as BR-03 in the reasons, and the Student Affairs officer reads the reasons of the seven seed requests. |
| NFR-06 | test | 20 | 20 of 20 | A contract test checks the content type, the date format and the currency code of each response. |
| NFR-07 | inspection | 10 | 30 of 30 | verify.js lists the endpoints of the OpenAPI file and looks for a tagged test of each. |
| NFR-08 | measurement | 7 | 7 of 7 | A load test sends 20 requests in one minute to a planner with fake outside services. |

## 4. Strategy

The strategy was chosen by weighted scoring of the options with the weights taken from the non-functional requirements (episode 6).

| Rank | Option | Score |
|---|---|---|
| 1 | Gateway + queue for notifications | 99 of 115 (86%) |
| 2 | Hub-and-spoke (API gateway) | 94 of 115 (82%) |
| 3 | Event-driven (message queue) | 81 of 115 (70%) |
| 4 | Enterprise service bus (ESB) | 77 of 115 (67%) |
| 5 | Batch file transfer (ETL) | 63 of 115 (55%) |
| 6 | Point-to-point | 59 of 115 (51%) |

The winner is **Gateway + queue for notifications**. The application is built this way: one API gateway in front of three REST services, a message queue for notices, and protected outside calls.

## 5. Architecture

| Service | Tasks | Protocol | Data owner |
|---|---|---|---|
| Holiday service | T02 | REST/JSON | Nager.Date (outside) |
| Facilities service | T03 | REST/JSON | Facilities Office |
| Weather service | T04 | REST/JSON | Open-Meteo (outside) |
| Finance service | T05 | REST/JSON | Finance Office |
| Currency conversion service | T05 | REST/JSON | Frankfurter (outside) |
| Notification service | T07 | REST/JSON | Student Affairs IT |
| Student Affairs service | T06, T08 | REST/JSON | Student Affairs Office |

Ports: gateway 4000, Student Affairs 4001, Finance 4002, Facilities 4003. Patterns around the outside APIs: translator, cache, retry with backoff, circuit breaker, aggregator, router.
The diagrams (component, sequence, state) are in `docs/architecture.md`.

## 6. Tests

830 tests in 55 files (counted from the test names); 180 of them carry a requirement tag.

| Episode | Tests | With a requirement tag |
|---|---|---|
| 02 | 30 | 0 |
| 03 | 27 | 0 |
| 04 | 29 | 0 |
| 05 | 47 | 14 |
| 06 | 71 | 17 |
| 07 | 47 | 0 |
| 08 | 46 | 0 |
| 09 | 85 | 17 |
| 10 | 39 | 8 |
| 11 | 78 | 9 |
| 12 | 80 | 19 |
| 13 | 102 | 41 |
| 14 | 63 | 5 |
| 15 | 86 | 50 |

The count is made from the test names, because a folder holds the tests of all earlier episodes.

## 7. Traceability

Requirements with a tagged test: 20 of 20. With a behaviour test of episode 15: 20 of 20.
Endpoints named in a test: 20 of 20. Problems in the trace links: 0.
`node verify.js` ends with OK.

| Requirement | Tests | Behaviour tests (episode 15) | Earlier tests |
|---|---|---|---|
| FR-01 | 11 | 2 | 9 |
| FR-02 | 7 | 2 | 5 |
| FR-03 | 10 | 1 | 9 |
| FR-04 | 6 | 1 | 5 |
| FR-05 | 5 | 2 | 3 |
| FR-06 | 7 | 1 | 6 |
| FR-07 | 4 | 1 | 3 |
| FR-08 | 4 | 2 | 2 |
| FR-09 | 4 | 1 | 3 |
| FR-10 | 4 | 1 | 3 |
| FR-11 | 6 | 4 | 2 |
| FR-12 | 16 | 3 | 13 |
| NFR-01 | 13 | 2 | 11 |
| NFR-02 | 31 | 5 | 26 |
| NFR-03 | 8 | 4 | 4 |
| NFR-04 | 6 | 4 | 2 |
| NFR-05 | 9 | 2 | 7 |
| NFR-06 | 20 | 5 | 15 |
| NFR-07 | 10 | 8 | 2 |
| NFR-08 | 7 | 3 | 4 |

## 8. Known limitations

- **No login.** Anyone who can reach the gateway can plan requests and change a status. Student Affairs officers and organizers are not told apart.
- **No rate limiting.** One client can send thousands of requests. The load test shows 20 requests per minute, not what happens at 2000.
- **No database.** The three services, the assessments and the queue keep their data in memory. A restart loses every change, and the queue loses its messages.
- **One process.** There is one copy of each service and no deployment (no container, no server, no certificate).
- **Finance cannot create a deposit record.** A request made through the web page has no deposit, so it is returned until someone creates one.
- **The outside APIs are free and keyless.** They have fair-use limits and no promise of availability; the planner survives them being down, but cannot make them faster.
- **The tests use fakes for the outside APIs.** A fake can be wrong about the real API. One live check (`node plan-live.js`) is kept outside the test suite on purpose.

## 9. What to do next

1. **Authentication and roles:** sign in, then let only an officer approve or return, and only the owner see a request.
2. **Rate limiting** at the gateway: a limit per client, and `429 Too Many Requests` with `Retry-After`.
3. **A database** for each service (each service owns its data), and a durable queue, so that a restart loses nothing.
4. **Deployment:** containers, configuration from environment variables, a health check in the platform, logs and metrics.
5. **Contract tests** against the real APIs on a schedule, so a change in an outside API is found before a student is.
