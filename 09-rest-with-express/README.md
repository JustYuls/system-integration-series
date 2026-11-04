# Episode 9: REST APIs with Express (LO 2.1)

The three campus systems of the **Campus Event Planner** (Student Affairs, Finance, Facilities) become three small **REST services** built with Express. Each one owns its data, speaks JSON over HTTP, uses resources and verbs, answers with the right status code, and reports errors in one format. A `review` folder checks an AI-drafted Express route, and the folder keeps everything of the earlier episodes (BPMN, documents, requirements, services).

## Learning outcomes

- **CLO 2:** Design scalable and interoperable systems integration solutions by applying integration architectures, reusable integration patterns, industry standards, and Service-Oriented Architecture (SOA) principles.
- **LO 2.1:** Explain Service-Oriented Architecture (SOA), APIs, middleware, and enterprise integration architectures.

## What you need

Visual Studio Code, Node.js 20 or newer, and Thunder Client (a VS Code extension) or Postman. Express is the only package, so run this once in the folder:

```bash
cd 09-rest-with-express
npm install
```

## Run it

```bash
npm run start:services
```

```
student-affairs  http://localhost:4001   (try /health)
finance          http://localhost:4002   (try /health)
facilities       http://localhost:4003   (try /health)
```

Open `http://localhost:4001/requests/EVT-0001` in a browser, or see the calls and responses without starting anything:

```bash
npm run demo:rest
```

```
GET    /requests/EVT-0001  ->  200
POST   /requests  ->  201
       Location: /requests/EVT-0009
POST   /requests  ->  400
       {"error":{"code":"VALIDATION_FAILED","message":"The request body has problems (missing: organization, venue, ...
GET    /requests/EVT-9999  ->  404
```

## The services

| Service | Port | Resources and calls |
|---|---|---|
| Student Affairs | 4001 | `GET /requests?status=`, `GET /requests/:requestNo`, `POST /requests`, `PATCH /requests/:requestNo` (status only), `DELETE /requests/:requestNo` |
| Finance | 4002 | `GET /deposits/:requestNo`, `POST /deposits/:requestNo/payments`, `GET /deposits/:requestNo/payments[/:id]` |
| Facilities | 4003 | `GET /venues?minCapacity=`, `GET /venues/:id`, `GET /venues/:id/availability?date=&attendees=`, `GET /reservations`, `GET /reservations/:requestNo`, `POST /reservations` |

Every service also answers `GET /health` with `{ "status": "ok", "service": "..." }`. Dates are ISO 8601 text, money is `{ "amount": 500, "currency": "USD" }`, and the deposits and penalties are in pesos (`balancePhp`, `penaltyPhp`).

### Status codes

| Code | Meaning here |
|---|---|
| 200 | A read or an update worked |
| 201 | A create worked; the `Location` header holds the address of the new resource |
| 204 | A delete worked; there is no body |
| 400 | The request is wrong: fields missing or invalid, bad JSON, unknown status |
| 404 | The resource or the route does not exist |
| 409 | The request conflicts with the current state (venue already reserved, deposit already paid) |
| 422 | Well formed but not acceptable (payment above the balance, unknown venue in the body) |
| 500 | A bug on the server; the client sees a short message, never the stack |

Every error has the same shape. Validation errors list the fields:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "...", "missing": ["venue"], "invalid": [] } }
```

### The code

- `src/services/student-affairs.js`, `finance.js`, `facilities.js`: each exports `createXApp(data)`, which copies the data (so every app and every test starts clean) and returns an Express app.
- `src/http.js`: the error helper `sendError`, the field checker `checkFields`, the app setup `createJsonApp`, and `finishApp` (the 404 handler and the error handler). Express 5 sends errors from async routes to the error handler, so no `try/catch` is needed.
- `src/validate.js`: small checks (ISO date, money, e-mail, pesos). `src/ports.js`: the ports. `src/seed.js`: reads `data/*.json`. `src/serve.js`: `start(app)` (listen on a free port) and `send(...)` (a call with `fetch`) for tests and demos.
- `data/requests.json`, `deposits.json`, `venues.json`, `reservations.json`: the seed data.

## Try the services with Thunder Client or Postman

Import `postman/campus-event-planner.postman_collection.json` (Thunder Client: Collections, menu, Import; Postman: Import). There is a folder for each service, and the variable `baseUrl` is `http://localhost`. Each request has a test that checks the status code. The contract of the services is in `docs/openapi-services.json` (OpenAPI 3).

## Test it

```bash
npm test
```

The tests of this episode start each app with `listen(0)` (a free port), call it with `fetch`, and close it in `after`. Tests that verify a requirement have its tag in the name, for example `[FR-01]`. Two tests read the OpenAPI file and the Postman collection and check that the services keep them.

## AI review

An AI assistant drafted a Student Affairs route in `review/flawed-app.js`. Run `npm run review:rest`: three findings are confirmed and two of three claims are false, each decided by starting the draft and the real service and calling both with `fetch`.

```
FINDING 1  a create must answer 201 and a Location    draft: 200, no Location        confirmed
FINDING 2  the draft accepts an empty body            stored, status 200             confirmed
FINDING 3  a GET must never change data               GET /approve: Approved         confirmed
CLAIM 4    the draft hides its insides on failure     500 body has a stack: true     FALSE
CLAIM 5    DELETE is safe: it changes nothing         GET after DELETE: 404          FALSE
CLAIM 6    the same POST twice makes two requests     two numbers: true              TRUE
```

## What comes next

Episode 10 adds a message queue for the "notify the organizer" step, and episode 11 puts a gateway in front of the three services (port 4000).
