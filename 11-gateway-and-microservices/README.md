# Campus Event Planner, episode 11: microservices, SOA and the API gateway

This folder is the application as it is at the end of episode 11 (Week 13, LO 2.2). New in this episode: one **API gateway** in front of the three REST services of episode 9, and a **weighted decision matrix** that compares a monolith, SOA with an ESB, and microservices behind a gateway.

## What is new

| File | What it does |
|---|---|
| `src/gateway/gateway.js` | `createGateway({ services, fetch, timeoutMs = 3000, extend, log })` returns an Express app. It forwards `/api/student-affairs/*`, `/api/finance/*` and `/api/facilities/*` (method, query, body, status; `Location` and `Content-Type` are copied back), adds or keeps an `X-Request-Id`, answers 504 when a service is slower than `timeoutMs` and 502 when it is unreachable, serves `GET /health`, and calls `extend(app)` before its JSON 404, so later episodes add routes without editing this file. |
| `src/gateway/logger.js` | `createAccessLog(write)`: one log line per request, with the request id. |
| `docs/decision-matrix.json` | Three options, six criteria with weights from the NFR categories, ratings 1 to 5 with a reason for each. |
| `src/matrix.js` | `weightedScores`, `ranking`, `explain`, `tradeOffs`, `sensitivity`, `checkMatrix`. |
| `decide.js` | Prints the real ranking, the trade-offs and what happens when one weight doubles. |
| `gateway-demo.js` | Starts the three services and the gateway on free ports, calls through the gateway (200, 201, 400), stops Finance (502), makes Facilities slow (504), and shows `/health`. |
| `review/gateway-facts.js`, `review/gateway-review.js` | The AI review: three findings and three claims about gateways, decided by running the real gateway. |
| `test/ep11-*.test.js` | Gateway routing, request id, 502 and 504 (`[NFR-02]`), create through the gateway (`[FR-01]`), the matrix, the review and the demo. |

## Run

```
npm run gateway-demo    # the real calls and failures
npm run decide          # the decision matrix
npm run review:gateway  # the AI review
npm test                # all tests of the folder
```

The tests start fake services with `app.listen(0)` and the real ones; nothing uses the internet.

## The idea in five lines

1. Clients know ONE address (the gateway, port 4000) and three path prefixes.
2. The gateway labels each request with `X-Request-Id`, so one call can be followed through the logs.
3. A service that does not answer in `timeoutMs` becomes 504; one that cannot be reached becomes 502. The others keep working.
4. The gateway never validates or decides. A service called directly still answers 400 to a bad body: the rules live in the services.
5. `GET /health` asks the three services at the same time and answers `ok` or `degraded`.

Note: the `Location` header is copied as the service wrote it (for example `/requests/EVT-0009`, a path of the service). Clients that follow it through the gateway add the prefix `/api/student-affairs`.

## The decision

`npm run decide` ranks microservices behind a gateway (55 of 80) just ahead of the monolith (54), far above SOA with an ESB (29). The margin is one point: doubling the weight of simplicity, performance, skills or cost makes the monolith win. The ranking is only as good as the weights, so the matrix shows the reasons and not only the numbers. What tips the choice for the planner is that the three systems already exist apart, with their own owners.

## Add your own routes (episode 13)

```js
createGateway({ services, extend: (app) => app.post("/api/requests", express.json(), handler) });
```

## Earlier episodes

Everything of episodes 2 to 10 stays: BPMN, documents, requirements, strategies, services, REST services, the queue.
