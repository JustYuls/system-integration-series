# Episode 1: What Is Systems Integration? (LO 1.1)

The first piece of the **Campus Event Planner**. Three campus systems keep the same event requests in three different formats: Student Affairs in CSV, Finance in JSON, Facilities in XML. An adapter turns each one into a shared (canonical) record, and `integrate()` combines them into one view of each request. A request can be approved only when the three systems agree. A `review` folder verifies what an AI assistant said about the job.

## Learning outcomes

- **CLO 1:** Analyze organizational business processes and integration requirements to determine appropriate systems integration solutions using business process models and requirements analysis techniques.
- **LO 1.1:** Explain the concepts and importance of Systems Integration.

## What you need

Visual Studio Code and Node.js 20 or newer. There is nothing to install.

## Run it

```bash
cd 01-fundamentals
node run-demo.js
```

```
request    title            status    balance hours penalty  approval
EVT-0001   Orientation Day  Pending      0.00     3       0  OK
EVT-0002   General Assembly Pending   1500.50     4      50  blocked: deposit unpaid, facility penalty
EVT-0003   Coding Contest   Pending      0.00     2       0  OK
EVT-0004   Job Fair         Pending    320.00     6       0  blocked: deposit unpaid
EVT-0005   Fun Run          On hold         -     5     120  blocked: on hold, no finance record, facility penalty
EVT-0007   General Assembly Pending      0.00     2       0  OK

3 data issues:
  - EVT-0003: duplicate record in facilities (kept the first)
  - EVT-0005: no finance record
  - EVT-0009: only in finance (not a registered request)
```

Notice the two events titled "General Assembly": different events, different request numbers.

## Test it

```bash
npm test          # 30 tests, built-in node:test runner
```

## The AI review

```bash
node review/review.js
```

```
FINDING 1  joining on the title merges two requests      5 records for 6 requests   confirmed
FINDING 2  '03/04/2027' is 04 Mar or 03 Apr                wrong order: 4 errors, 2 wrong dates   confirmed
FINDING 3  normalize the id first, then join             5 of 6 match (was 0)   confirmed
CLAIM 4    point-to-point needs n links for n systems    for 6 systems: 15 links          FALSE
CLAIM 5    a hub needs n links for n systems             for 6 systems: 6 links           TRUE
CLAIM 6    the view stays complete if finance is down    complete: 0 of 6        FALSE
```

The AI answer used in the video was written with Claude (Anthropic), shortened, and verified with this code.

## What is in the folder

| Path | What it is |
|---|---|
| `src/data/` | the three silos: `student-affairs.csv`, `finance.json`, `facilities.xml` |
| `src/adapters.js` | one reader per format, plus `normalizeId`, `normalizeTitle`, `parseDate` |
| `src/integrate.js` | `integrate()`, the approval rule (`blockReasons`, `canApprove`) |
| `src/connections.js` | links needed by point-to-point (`n(n-1)/2`) and by a hub (`n`) |
| `review/` | the flawed title-join draft, the facts, and the review script |
| `test/` | 30 tests |

## Where this goes next

In later episodes the three silos become REST services, and the Campus Event Planner adds three free APIs with no key: Open-Meteo (weather), Nager.Date (holidays) and Frankfurter (exchange rates). See [SERIES_PLAN.md](../SERIES_PLAN.md).

## Practice

1. Change a date in `facilities.xml`. Which issue does `integrate()` report?
2. Add a fourth silo (a registrar that stores organizations in a plain text file). What do you have to write, and what stays the same?
3. For 10 systems, how many links does point-to-point need? How many does a hub need?
