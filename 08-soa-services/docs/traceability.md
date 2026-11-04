# Traceability matrix

Every row follows one requirement from the business process to the proof: task, business rule, requirement, service, endpoint, test tag.

## Functional requirements

| Task | Rule | FR | Priority | Service | Endpoint | Test tag |
|---|---|---|---|---|---|---|
| T01 | BR-06 | FR-01 | Must | student-affairs-service | `POST /api/requests` | FR-01 |
| T02 | BR-01 | FR-02 | Must | holiday-service | `GET /api/requests/{requestNo}/assessment` | FR-02 |
| T03 | BR-03 | FR-03 | Must | facilities-service | `GET /api/requests/{requestNo}/assessment` | FR-03 |
| T03 | BR-04 | FR-04 | Must | facilities-service | `GET /api/requests/{requestNo}/assessment` | FR-04 |
| T04 | BR-02 | FR-05 | Must | weather-service | `GET /api/requests/{requestNo}/assessment` | FR-05 |
| T05 | BR-05 | FR-06 | Must | finance-service | `GET /api/requests/{requestNo}/assessment` | FR-06 |
| T05 | BR-07 | FR-07 | Should | currency-service | `GET /api/requests/{requestNo}/assessment` | FR-07 |
| G3 | BR-08 | FR-08 | Must | gateway | `POST /api/requests` | FR-08 |
| T06 | BR-08 | FR-09 | Must | student-affairs-service | `GET /api/requests/{requestNo}` | FR-09 |
| T08 | BR-08 | FR-10 | Must | student-affairs-service | `GET /api/requests/{requestNo}/assessment` | FR-10 |
| T07 | none | FR-11 | Must | notification-service | `internal: sendNotice` | FR-11 |
| G3 | none | FR-12 | Should | gateway | `GET /api/requests/{requestNo}/assessment` | FR-12 |

## Non-functional requirements

| NFR | Category | Verified by | Evidence | Test tag |
|---|---|---|---|---|
| NFR-01 | performance | measurement | measure-apis.js times the three outside APIs: the slowest p95 (1260 ms) plus 500 ms of our own work is 1760 ms. | NFR-01 |
| NFR-02 | availability | test | An integration test makes each outside API fail in turn and expects the decision needs-review. | NFR-02 |
| NFR-03 | reliability | test | A unit test with a fake fetch that always fails counts the attempts: at most 3. | NFR-03 |
| NFR-04 | security | test | A test scans the source files for key patterns; each endpoint test sends one bad input and expects 400. | NFR-04 |
| NFR-05 | usability | review | A test rejects codes such as BR-03 in the reasons, and the Student Affairs officer reads the reasons of the seven seed requests. | NFR-05 |
| NFR-06 | interoperability | test | A contract test checks the content type, the date format and the currency code of each response. | NFR-06 |
| NFR-07 | maintainability | inspection | verify.js lists the endpoints of the OpenAPI file and looks for a tagged test of each. | NFR-07 |
| NFR-08 | capacity | measurement | A load test sends 20 requests in one minute to a planner with fake outside services. | NFR-08 |
