# Event request process

**Purpose.** Decide quickly and fairly whether a student organization may hold an event, using the rules of the campus and facts from the campus systems and free public APIs.

## Who takes part

- **Organizer**: Submit event request
- **Planner System**: Check date for holidays, Check venue availability, Check weather forecast, Check deposit and budget, Notify organizer
- **Student Affairs Officer**: Approve request, Return request for revision

## The process at a glance

1. Submit event request (T01)
2. Check date for holidays (T02)
3. Check venue availability (T03)
4. Check weather forecast (T04)
5. Check deposit and budget (T05)
6. Approve request (T06)
7. Notify organizer (T07)

## Tasks

### T01 Submit event request

| | |
|---|---|
| Actor | Organizer |
| Type | userTask |
| System | Planner web page |
| Inputs | title; date; venue; attendees; budget; outdoor or indoor |
| Outputs | event request |
| Rules | BR-06 |
| If it goes wrong | The form is incomplete: show the missing fields and keep what was typed. |

### T02 Check date for holidays

| | |
|---|---|
| Actor | Planner System |
| Type | serviceTask |
| System | Holiday service (Nager.Date) |
| Inputs | event date |
| Outputs | holiday check: ok, or the name of the holiday |
| Rules | BR-01 |
| If it goes wrong | The service does not answer: mark the check unknown and ask the officer to decide. |

### T03 Check venue availability

| | |
|---|---|
| Actor | Planner System |
| Type | serviceTask |
| System | Facilities system |
| Inputs | venue; date; attendees |
| Outputs | venue check: free or not, capacity, unpaid penalty |
| Rules | BR-03; BR-04 |
| If it goes wrong | The venue does not exist: return a clear error to the organizer. |

### T04 Check weather forecast

| | |
|---|---|
| Actor | Planner System |
| Type | serviceTask |
| System | Weather service (Open-Meteo) |
| Inputs | event date; venue location; outdoor or indoor |
| Outputs | weather check: rain chance in percent, or not needed for indoor events |
| Rules | BR-02 |
| If it goes wrong | The date is too far ahead for a forecast: mark the check unknown. |

### T05 Check deposit and budget

| | |
|---|---|
| Actor | Planner System |
| Type | serviceTask |
| System | Finance system (Frankfurter) |
| Inputs | request number; budget and currency |
| Outputs | budget check: deposit paid or not, budget in pesos |
| Rules | BR-05; BR-07 |
| If it goes wrong | The exchange rate is not available: use the last known rate and say so. |

### T06 Approve request

| | |
|---|---|
| Actor | Student Affairs Officer |
| Type | userTask |
| System | Student Affairs system |
| Inputs | request; results of the four checks |
| Outputs | approved request |
| Rules | BR-08 |
| If it goes wrong | The officer disagrees with the checks: the request is returned with a written reason. |

### T07 Notify organizer

| | |
|---|---|
| Actor | Planner System |
| Type | sendTask |
| System | Notification service |
| Inputs | decision; reasons; organizer e-mail |
| Outputs | notice sent to the organizer |
| Rules | none |
| If it goes wrong | The e-mail cannot be sent: try again later, then record the failure. |

### T08 Return request for revision

| | |
|---|---|
| Actor | Student Affairs Officer |
| Type | userTask |
| System | Student Affairs system |
| Inputs | request; list of failed checks |
| Outputs | revision notice with the reasons |
| Rules | BR-08 |
| If it goes wrong | none |

## Decisions

- **G3 All checks passed?** Yes: every check result is ok. No: at least one check failed or is unknown.

## Business rules

| Rule | Statement | Used by |
|---|---|---|
| BR-01 | An event cannot be approved on a public holiday. | T02 |
| BR-02 | An outdoor event needs a rain chance below 60 percent on its date. | T04 |
| BR-03 | The venue must be free at the requested time and hold at least as many people as the attendees. | T03 |
| BR-04 | A venue with an unpaid facility penalty cannot be reserved. | T03 |
| BR-05 | The deposit must be paid before approval. | T05 |
| BR-06 | Every request names a title, a date, a venue, the number of attendees and a budget. | T01 |
| BR-07 | Money in another currency is converted to Philippine pesos at the latest rate. | T05 |
| BR-08 | A request is approved only when every check passed. | T06; T08 |
