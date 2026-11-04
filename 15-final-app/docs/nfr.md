# Non-functional requirements

How well the Campus Event Planner must do its job. Each one has a number and a way to check it.

| ID | Category | Target | Metric |
|---|---|---|---|
| NFR-01 | performance | <= 3000 ms | 95th percentile of the time from request to decision |
| NFR-02 | availability | >= 100 percent | share of planning requests answered while one outside API is down |
| NFR-03 | reliability | <= 3 attempts | attempts made for one failing outside call |
| NFR-04 | security | = 0 findings | secrets found in the repository, plus inputs accepted without validation |
| NFR-05 | usability | >= 100 percent | share of decisions whose reasons are full sentences without codes |
| NFR-06 | interoperability | >= 100 percent | share of responses that follow all three conventions |
| NFR-07 | maintainability | >= 100 percent | share of endpoints with an automated test |
| NFR-08 | capacity | >= 20 requests per minute | planning requests handled per minute without an error |

## NFR-01 performance

The planner shall give a planning decision within 3000 ms for 95 percent of requests.

- **Metric:** 95th percentile of the time from request to decision
- **Target:** <= 3000 ms
- **Measure:** measure-apis.js times the three outside calls; the slowest p95 plus 500 ms of our own work must fit.

## NFR-02 availability

When an outside API is down, the planner shall still answer, and the decision shall be needs-review.

- **Metric:** share of planning requests answered while one outside API is down
- **Target:** >= 100 percent
- **Measure:** An integration test makes each outside API fail in turn and checks for a needs-review answer.

## NFR-03 reliability

The planner shall retry a failed outside call up to 3 times before it gives up.

- **Metric:** attempts made for one failing outside call
- **Target:** <= 3 attempts
- **Measure:** A unit test with a fake fetch that always fails counts the attempts.

## NFR-04 security

The repository shall hold no secrets or API keys, and the planner shall validate all input.

- **Metric:** secrets found in the repository, plus inputs accepted without validation
- **Target:** = 0 findings
- **Measure:** A test scans the source files for key patterns; each endpoint test sends one bad input and expects 400.

## NFR-05 usability

The planner shall give the organizer every reason for a decision in plain language.

- **Metric:** share of decisions whose reasons are full sentences without codes
- **Target:** >= 100 percent
- **Measure:** A test reads the reasons of the seven seed requests and rejects codes such as BR-03.

## NFR-06 interoperability

The planner shall exchange JSON over HTTP, write dates in ISO 8601, and write currencies as ISO 4217 codes.

- **Metric:** share of responses that follow all three conventions
- **Target:** >= 100 percent
- **Measure:** A contract test checks the content type, the date format, and the currency code of each response.

## NFR-07 maintainability

Every endpoint of the planner shall have at least one automated test.

- **Metric:** share of endpoints with an automated test
- **Target:** >= 100 percent
- **Measure:** verify.js lists the endpoints of the OpenAPI file and looks for a tagged test of each.

## NFR-08 capacity

The planner shall handle 20 planning requests per minute without errors.

- **Metric:** planning requests handled per minute without an error
- **Target:** >= 20 requests per minute
- **Measure:** A load test sends 20 requests in one minute to a planner with fake outside services.
