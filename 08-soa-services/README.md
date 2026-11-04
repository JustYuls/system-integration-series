# Campus Event Planner: episode 8, service-oriented architecture (SOA)

This folder is the Campus Event Planner as it is at the end of episode 8 (Week 10, LO 2.1, CLO 2). Episode 8 finds the **services** in the BPMN process, writes a **contract** for each, checks the contracts against the **SOA principles**, and builds the first real service: **Open-Meteo wrapped as the weather service**.

## What is new in this episode

| File | What it does |
|---|---|
| `docs/services.json` | The service catalog: 7 services, each with id, name, description, version, owner, tasks, operations (input, output, errors), data owner, protocol (REST/JSON), outside API and an SLA hint |
| `src/soa.js` | `deriveServices(model, notes)` finds the services from the BPMN tasks and the `system` field of the notes; `checkContract(service)` checks the seven principles; `serviceForTask`, `catalogProblems`, `sharedData`, `principles` |
| `src/services/weather-service.js` | `getForecast({ date, latitude, longitude, today }, { fetch })` returns a normalized result; `ServiceError` with the code `BAD_INPUT` or `UPSTREAM` |
| `services-report.js` | Prints the services found in the process, the catalog and the contract checks |
| `weather-demo.js` | A **live** call of Open-Meteo: raw excerpt next to the normalized result (needs internet) |
| `review/soa-facts.js`, `review/soa-review.js` | The AI review: a flawed contract draft and three claims, decided by code |
| `test/ep08-*.test.js` | Tests (the weather tests inject `fetch` with a fixture: no network) |

## Run it

```
node services-report.js        # the services found in the BPMN, the catalog, the contract checks
node weather-demo.js           # live call of Open-Meteo (internet needed)
node review/soa-review.js      # the AI review: three findings, three claims
node --test                    # every test of the folder
```

## The seven principles, as code checks

| Principle | The check in `checkContract` |
|---|---|
| Loose coupling | No operation outputs an internal database field (`venue_row_id`, `tbl_penalty`) |
| Abstraction | No operation returns the raw answer of another system (`daily`, `rates`, `payload`) |
| Reusability | An operation name is not tied to one process (`checkEventWeather` fails, `getForecast` passes) |
| Statelessness | No input such as `sessionId` or `state` |
| Discoverability | The service has a name, description, version, owner; every operation has input, output and errors |
| Composability | The protocol is the shared `REST/JSON` |
| Autonomy | The service names the owner of its data (and `sharedData` finds two services with one owner) |

## From BPMN task to service

The notes name a `system` for every task. One system becomes one service. A task that uses an outside API *through an internal system* (T05: the Finance system and Frankfurter) needs two services: the deposit service and a wrapper for the outside API. The Planner web page (T01) is a client, not a service.

| Task | System in the notes | Service |
|---|---|---|
| T02 Check date for holidays | Holiday service | `holiday-service` (wraps Nager.Date) |
| T03 Check venue availability | Facilities system | `facilities-service` |
| T04 Check weather forecast | Weather service | `weather-service` (wraps Open-Meteo) |
| T05 Check deposit and budget | Finance system, Frankfurter | `finance-service`, `currency-service` (wraps Frankfurter) |
| T06, T08 Approve, return request | Student Affairs system | `student-affairs-service` |
| T07 Notify organizer | Notification service | `notification-service` |

## The weather service

```js
const result = await getForecast({ date: "2027-03-04" }, { fetch });
// { available: true, date, rainChancePercent: 10, maxTempC: 33.4, source: "open-meteo" }
// { available: false, date, reason: "beyond the 16 day forecast window" }   (no call is made)
```

- A bad date or place throws `ServiceError` with `.code === "BAD_INPUT"`; a failing Open-Meteo throws `ServiceError` with `.code === "UPSTREAM"`.
- A date before today or 16 days or more ahead is `available: false` (the forecast window is today and the next 15 days).
- Callers never see `daily`, `precipitation_probability_max` or any other Open-Meteo name.

## Decisions later episodes depend on

- The weather service is the one `external.forecast` reuses in episode 12.
- Episode 9 builds the Student Affairs, Finance and Facilities services with the operations named in the catalog; the catalog operation names (`getDeposit`, `getVenueAvailability`, ...) are the contract the REST routes implement.
