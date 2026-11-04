# Requirements specification: Campus Event Planner

## 1 Purpose and scope

Decide quickly and fairly whether a student organization may hold an event, using the rules of the campus and facts from the campus systems and free public APIs.

This document is the agreement between the people who need the system (organizers, Student Affairs, Facilities, Finance) and the people who build it. It says **what** the system must do and how well. It does not say how it is built: that is the recommendation.

Scope: 12 functional requirements (10 Must), 8 non-functional requirements, 8 business rules.

## 2 Process overview

The process is "Event request process". Lanes: Organizer, Planner System, Student Affairs Officer.

1. Submit event request (T01)
2. Check date for holidays (T02)
3. Check venue availability (T03)
4. Check weather forecast (T04)
5. Check deposit and budget (T05)
6. Approve request (T06)
7. Notify organizer (T07)

**G3 All checks passed?** Yes: every check result is ok. No: at least one check failed or is unknown.

## 3 Stakeholders

| ID | Stakeholder | Concern | How we asked |
|---|---|---|---|
| SH1 | Student organization officer | A fast answer, and clear reasons when the answer is no. | interview |
| SH2 | Student Affairs officer | Fair, consistent decisions with a record of why. | interview and observation |
| SH3 | Facilities staff | No double bookings and no damaged rooms left unpaid. | document analysis |
| SH4 | Finance clerk | Deposits are paid before the event, and sponsor money is recorded in pesos. | questionnaire |
| SH5 | IT administrator | Few moving parts, clear logs, and no secrets in the code. | workshop |

## 4 Functional requirements

### FR-01 (Must, T01, BR-06)

The system shall list the missing fields when an organizer submits a request without a title, date, venue, attendees or budget.

Acceptance criteria:
- Given a request without a venue, when the organizer submits it, then the system lists venue as missing and creates no request.
- Given a complete request, when the organizer submits it, then the system accepts it and gives it a request number.

### FR-02 (Must, T02, BR-01)

The system shall mark the date check as failed when the event date is a public holiday in the Philippines.

Acceptance criteria:
- Given the date 2027-12-25 is Christmas Day, when the date check runs, then the check fails and names the holiday.
- Given the date 2027-03-04 is not a holiday, when the date check runs, then the check passes.

### FR-03 (Must, T03, BR-03)

The system shall mark the venue check as failed when the venue is reserved on the date or holds fewer people than the attendees.

Acceptance criteria:
- Given Room 101 holds 60 people, when a request has 80 attendees, then the venue check fails with the reason capacity.
- Given the Gym is free on 2027-03-04, when a request has 120 attendees, then the venue check passes.

### FR-04 (Must, T03, BR-04)

The system shall mark the venue check as failed when the venue has an unpaid facility penalty.

Acceptance criteria:
- Given Room 101 has an unpaid penalty of 50 pesos, when a request asks for Room 101, then the venue check fails with the reason penalty.
- Given the Gym has no penalty, when a request asks for the Gym, then the penalty does not fail the check.

### FR-05 (Must, T04, BR-02)

The system shall mark the weather check as failed when an outdoor event has a rain chance of 60 percent or more on its date.

Acceptance criteria:
- Given an outdoor event and a rain chance of 70 percent, when the weather check runs, then the check fails.
- Given an indoor event, when the weather check runs, then the check is skipped and passes.

### FR-06 (Must, T05, BR-05)

The system shall mark the budget check as failed when the deposit of the request is not fully paid.

Acceptance criteria:
- Given request EVT-0004 has a balance of 320 pesos, when the budget check runs, then the check fails.
- Given request EVT-0001 has a balance of 0, when the budget check runs, then the deposit does not fail the check.

### FR-07 (Should, T05, BR-07)

The system shall convert a budget in another currency to Philippine pesos at the latest exchange rate.

Acceptance criteria:
- Given a budget of 500 USD and a rate of 63.46, when the budget check runs, then the budget is 31730 pesos.
- Given a budget of 15000 PHP, when the budget check runs, then the budget stays 15000 pesos.

### FR-08 (Must, G3, BR-08)

The system shall approve a request only when the holiday, venue, weather and budget checks all passed.

Acceptance criteria:
- Given all four checks passed, when the decision is made, then the decision is approved.
- Given the venue check failed and three checks passed, when the decision is made, then the decision is returned.

### FR-09 (Must, T06, BR-08)

The system shall set the status of a request to Approved when the officer approves it.

Acceptance criteria:
- Given a pending request whose checks all passed, when the officer approves it, then its status is Approved.
- Given a request that is already Approved, when the officer opens it, then the approve action is not offered.

### FR-10 (Must, T08, BR-08)

The system shall return a request to the organizer with the reason of every failed check.

Acceptance criteria:
- Given a request that failed the date check and the venue check, when the officer returns it, then the status is Returned and both reasons are listed.
- Given a request with no failed check, when the officer returns it, then the system asks for a written reason.

### FR-11 (Must, T07, no rule)

The system shall send the organizer a notice with the decision and its reasons.

Acceptance criteria:
- Given a returned request with the reason holiday, when the decision is made, then the organizer receives a notice that names the holiday.
- Given the e-mail cannot be sent, when the notice is sent, then the system tries again later and records the failure.

### FR-12 (Should, G3, no rule)

The system shall mark a request as needs-review when an outside service does not answer and no other check failed.

Acceptance criteria:
- Given the holiday service is down and the other checks passed, when the decision is made, then the decision is needs-review with the reason holiday service.
- Given the weather service is down and the venue check failed, when the decision is made, then the decision is returned.

## 5 Non-functional requirements

| ID | Category | Target | Measured | Status |
|---|---|---|---|---|
| NFR-01 | performance | <= 3000 ms | 1760 ms | pass |
| NFR-02 | availability | >= 100 percent | not measured yet | not measured |
| NFR-03 | reliability | <= 3 attempts | not measured yet | not measured |
| NFR-04 | security | = 0 findings | not measured yet | not measured |
| NFR-05 | usability | >= 100 percent | not measured yet | not measured |
| NFR-06 | interoperability | >= 100 percent | not measured yet | not measured |
| NFR-07 | maintainability | >= 100 percent | not measured yet | not measured |
| NFR-08 | capacity | >= 20 requests per minute | not measured yet | not measured |

The measured value of NFR-01 comes from the three outside APIs (2026-11-04): the slowest p95 plus 500 ms of our own work. The others are proved by tests later.

## 6 Business rules

| Rule | Statement | Requirements |
|---|---|---|
| BR-01 | An event cannot be approved on a public holiday. | FR-02 |
| BR-02 | An outdoor event needs a rain chance below 60 percent on its date. | FR-05 |
| BR-03 | The venue must be free at the requested time and hold at least as many people as the attendees. | FR-03 |
| BR-04 | A venue with an unpaid facility penalty cannot be reserved. | FR-04 |
| BR-05 | The deposit must be paid before approval. | FR-06 |
| BR-06 | Every request names a title, a date, a venue, the number of attendees and a budget. | FR-01 |
| BR-07 | Money in another currency is converted to Philippine pesos at the latest rate. | FR-07 |
| BR-08 | A request is approved only when every check passed. | FR-08, FR-09, FR-10 |

## 7 Standards and constraints

| ID | Kind | Name | Rule | Serves |
|---|---|---|---|---|
| STD-01 | standard | HTTP and REST verbs | GET reads, POST creates, PATCH changes part of a resource; the URL names a thing, not an action. | NFR-06 |
| STD-02 | standard | HTTP status codes | 200 read, 201 created, 400 bad input, 404 not found, 502 a service is unreachable, 504 a service is too slow. | NFR-06 |
| STD-03 | standard | JSON bodies | Requests and responses are JSON with the content type application/json. | NFR-06 |
| STD-04 | standard | UTF-8 text | All text is UTF-8. | NFR-06 |
| STD-05 | standard | ISO 8601 dates | Dates are written year-month-day with a four digit year. | NFR-06 |
| STD-06 | standard | ISO 4217 currency codes | A currency is a three-letter code next to the amount. | NFR-06 |
| STD-07 | standard | OpenAPI 3 | The API is described in an OpenAPI 3 file, and every operation lists the requirements it satisfies. | NFR-07 |
| STD-08 | practice | One error format | Every error has the body { "error": { "code": "...", "message": "..." } }. | NFR-05 |
| STD-09 | practice | Timeouts | Every call to another system has a timeout of 800 ms, so 3 tries and our own work fit in 3000 ms. | NFR-01 |
| STD-10 | practice | Idempotent retries | Retry only calls that are safe to repeat (GET, or a POST with a request number); at most 3 attempts. | NFR-03 |
| STD-11 | practice | Version in the URL | The plain /api is version 1. A change that breaks callers appears under /api/v2, and the old one stays for a while. | NFR-07 |
| STD-12 | practice | No secrets in code | Keys and passwords come from environment variables, never from a file in the repository. | NFR-04 |

## 8 Traceability summary

12 rows link each requirement to its task, rule, service, endpoint and test tag (see traceability.md).
The completeness check found no problems: every task, rule, FR and NFR is linked.

## 9 Risks and assumptions

| Risk | Likelihood | Impact | NFR | Mitigation |
|---|---|---|---|---|
| An outside API answers slowly | Medium | High | NFR-01 | Call the three outside APIs in parallel, give each a timeout of 800 ms, and keep our own work under 500 ms. |
| An outside API is down | Medium | High | NFR-02 | Return needs-review instead of an error, cache the last good answer, and open a circuit breaker after repeated failures. |
| A retry repeats a payment or a notice | Low | High | NFR-03 | Retry only safe calls, at most 3 attempts with growing waits, and key every notice by its request number. |
| A secret or bad input gets into the system | Low | High | NFR-04 | Keys come from environment variables, every endpoint validates input, and a test scans the source for key patterns. |
| A crowd of organizers asks on the same day | Medium | Medium | NFR-08 | Send the notice through the queue so the answer does not wait for e-mail, and run a load test of 20 requests a minute. |
| The systems disagree about formats | High | Medium | NFR-06 | One standard for the whole API: JSON, ISO 8601 dates and ISO 4217 currency codes, checked by a contract test. |

Assumptions:
- The three outside APIs stay free and keep their current format.
- The three campus systems can offer a REST interface without a new product.
- The team is a small student team with one semester to build.
- The ratings of the options are our judgment, and every weight can be changed and scored again.
