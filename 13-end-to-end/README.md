# Campus Event Planner, episode 13: RESTful service integration, end to end

Week 15, LO 2.3, CLO 3. The Campus Event Planner now works as a whole: a web page sends a request to the gateway, `planEvent` walks the BPMN process (holiday, venue, weather, budget, decision), and the organizer gets a decision with plain-language reasons.

```
browser page -> gateway (4000) -> Student Affairs (4001), Finance (4002), Facilities (4003)
                              -> Nager.Date, Open-Meteo, Frankfurter (through createExternal)
                              -> queue -> notifier (e-mail)
```

## What is new

| File | What it does |
|---|---|
| `src/gateway/plan.js` | `planEvent(requestNo, { clients, external, queue, today })`: T02 holiday (BR-01), T03 venue (BR-03, BR-04), T04 weather (BR-02, outdoor only), T05 budget (BR-05, BR-07) run with `Promise.all`; G3 `decide` (BR-08, FR-12); T06 Approved or T08 Returned through PATCH; T07 publishes `request.decided`. Returns `{ requestNo, decision, checks: { holiday, venue, weather, budget }, reasons, status }`. |
| `src/gateway/clients.js` | `createClients(services, { fetch, timeoutMs })`: `listRequests`, `getRequest`, `createRequest`, `setStatus`, `availability`, `deposit`. Failures become `ClientError` (`UNREACHABLE` 502, `TIMEOUT` 504, `NOT_FOUND`, `BAD_STATUS`). |
| `src/gateway/routes.js` | `plannerRoutes(...)`: the routes for the gateway's `extend(app)` hook, and the `web/` folder as static files. |
| `src/gateway/server.js` | `createPlannerApp({ services, external, queue, fetch, today })`: the gateway of episode 11 with the planner routes. |
| `src/gateway/fakes.js` | `createFakeExternal`, `createFakeClients`, `createInFlight`: fakes for tests and demos. |
| `web/index.html`, `styles.css`, `app.js`, `render.js` | The page: form, decision card, list of requests. No libraries. `render.js` holds `escapeHtml`, `decisionLabel`, `renderChecks` (pure, tested). |
| `start-all.js` | Starts the three services, the queue with the notifier (console "e-mail"), and the gateway on port 4000 with the real outside APIs. |
| `plan-demo.js`, `plan-live.js` | Demo with fake outside services and fixed date; live variant with the real APIs and dates a few days ahead. |
| `postman/campus-event-planner.gateway.postman_collection.json` | The "Gateway" folder for Postman or Thunder Client (the collection of episode 9 is unchanged). |
| `review/plan-facts.js`, `plan-review.js` (+ `draft-plan.js`, `draft-render.js`) | The AI review: an AI-drafted planner and card, 3 findings, 3 claims. |
| `test/ep13-*.test.js` | Tests, with requirement tags such as `[FR-02]`, `[NFR-01]`, `[NFR-05]`. |

## Routes added to the gateway

| Call | Answer |
|---|---|
| `POST /api/requests` | Creates the request in Student Affairs, plans it: `201`, header `Location: /api/requests/:requestNo/assessment`, body = the assessment. `400` passes the service's validation problems through. |
| `GET /api/requests/:requestNo/assessment` | The last stored assessment (kept in memory), or `404`. |
| `POST /api/requests/:requestNo/assessment` | Plans an existing request again (used by "Check now" on the page). |
| `GET /api/requests` | The requests, each with the decision of its last assessment (`null` if none). |

## Decision rules

A failed check gives `returned`. A check that could not run (`unknown`: an outside service did not answer) gives `needs-review`, unless another check already failed (then `returned`). All passed gives `approved`. `needs-review` leaves the status unchanged. Indoor events skip the weather check (`{ needed: false }`).

Known decision: Finance has no call to create a deposit record, so a request created through the page has no deposit and is returned with "No deposit has been recorded for this request." The seed requests (EVT-0001, EVT-0003) show `approved`.

## Run it

```
npm start            # http://localhost:4000 (needs internet for the outside APIs)
npm run plan-demo    # fake outside services, fixed date, same output every time
npm run plan-live    # real outside APIs
npm run review:plan  # the AI review
npm test
```
