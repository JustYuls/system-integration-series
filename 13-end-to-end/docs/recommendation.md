# Integration recommendation: Campus Event Planner

## Executive summary

**We recommend: Gateway + queue for notifications.** A gateway answers the organizer at once; the notice about the decision goes through a message queue.

- **Evidence.** It scores 99 of 115 points (86 percent), 5 ahead of Hub-and-spoke (API gateway) (94).
- **Robust.** Doubling any one of the 9 weights never changes the winner.
- **Why it wins.** Against the runner-up it gains availability +6, reliability +3, capacity +1, and it gives up maintainability -2, cost -3.
- **Main risks.** An outside API answers slowly (NFR-01); An outside API is down (NFR-02). Each has a mitigation below.
- **Decision we ask for.** Approve this strategy and the plan below, so that the design phase can start.

## 1 Problem

Three internal systems (Student Affairs, Finance, Facilities) and three outside APIs (Open-Meteo, Nager.Date, Frankfurter) must work together to plan one event request. The organizer needs an answer within 3 seconds, even when an outside service is down, and the team is small.

## 2 Options considered

| Rank | Option | Points | Percent |
|---|---|---|---|
| 1 | Gateway + queue for notifications | 99 of 115 | 86 |
| 2 | Hub-and-spoke (API gateway) | 94 of 115 | 82 |
| 3 | Event-driven (message queue) | 81 of 115 | 70 |
| 4 | Enterprise service bus (ESB) | 77 of 115 | 67 |
| 5 | Batch file transfer (ETL) | 63 of 115 | 55 |
| 6 | Point-to-point | 59 of 115 | 51 |

## 3 Criteria and weights

The criteria are the eight non-functional categories plus cost. A Must is worth 3 points, a Should 2, a Could 1; cost is a project constraint of 3 points.

| Criterion | Weight | From |
|---|---|---|
| performance | 3 | NFR-01 (Must) |
| availability | 3 | NFR-02 (Must) |
| reliability | 3 | NFR-03 (Must) |
| security | 3 | NFR-04 (Must) |
| usability | 2 | NFR-05 (Should) |
| interoperability | 3 | NFR-06 (Must) |
| maintainability | 2 | NFR-07 (Should) |
| capacity | 1 | NFR-08 (Could) |
| cost | 3 | project constraint |

## 4 The decision and why

Gateway + queue for notifications ranks first with 99 of 115 points (86 percent). The next one, Hub-and-spoke (API gateway), has 94: the margin is 5 points. The biggest contribution comes from availability.

Compared with Hub-and-spoke (API gateway), the queue adds availability +6, reliability +3, capacity +1; the price is maintainability -2, cost -3. The numbers favor the combination, and the sensitivity check shows the result does not depend on one weight.

## 5 What we will not do

- **Hub-and-spoke (API gateway)** (94 points). Its weakest criterion is availability (3 of 5): the hub is a single point of failure.
- **Event-driven (message queue)** (81 points). Its weakest criterion is usability (2 of 5): the organizer gets no direct answer, only a later message.
- **Enterprise service bus (ESB)** (77 points). Its weakest criterion is cost (1 of 5): a product to buy or learn, and a lot of configuration.
- **Batch file transfer (ETL)** (63 points). Its weakest criterion is performance (1 of 5): an answer arrives with the next run, not within 3 seconds.
- **Point-to-point** (59 points). Its weakest criterion is maintainability (1 of 5): 6 systems need up to 15 links, and each one is code to maintain.

## 6 Risks and mitigations

| Risk | Likelihood | Impact | NFR | Mitigation |
|---|---|---|---|---|
| An outside API answers slowly | Medium | High | NFR-01 | Call the three outside APIs in parallel, give each a timeout of 800 ms, and keep our own work under 500 ms. |
| An outside API is down | Medium | High | NFR-02 | Return needs-review instead of an error, cache the last good answer, and open a circuit breaker after repeated failures. |
| A retry repeats a payment or a notice | Low | High | NFR-03 | Retry only safe calls, at most 3 attempts with growing waits, and key every notice by its request number. |
| A secret or bad input gets into the system | Low | High | NFR-04 | Keys come from environment variables, every endpoint validates input, and a test scans the source for key patterns. |
| A crowd of organizers asks on the same day | Medium | Medium | NFR-08 | Send the notice through the queue so the answer does not wait for e-mail, and run a load test of 20 requests a minute. |
| The systems disagree about formats | High | Medium | NFR-06 | One standard for the whole API: JSON, ISO 8601 dates and ISO 4217 currency codes, checked by a contract test. |

## 7 Plan by phase

| Phase | Status | Work |
|---|---|---|
| 1 Process and requirements | done | BPMN process, 12 functional and 8 non-functional requirements, strategy and standards. |
| 2 Design | next | Find the services in the process (SOA) and write a contract for each. |
| 3 Build | planned | REST services, the gateway, the message queue, integration patterns and the web page. |
| 4 Proof | planned | Tests for every requirement, architecture diagrams and documents. |
