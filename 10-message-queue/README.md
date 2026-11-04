# Campus Event Planner, episode 10: middleware, EAI and message queues

This folder is the application as it is at the end of episode 10 (Week 12, LO 2.2). New in this episode: a message queue that carries the "notify organizer" message (task T07, FR-12) so that a slow or broken e-mail server never stops an approval.

## What is new

| File | What it does |
|---|---|
| `src/queue.js` | `createQueue({ maxAttempts = 3, backoffMs = [100, 400, 1600], sleep })`: `subscribe`, `publish`, `drain`, `stats`, `deadLetters`. A failing handler is retried with growing waits, then the message goes to the dead letters. |
| `src/notifier.js` | `createNotifier({ send })`: the consumer of the topic `request.decided`. Builds the e-mail for approved, returned and needs-review, and sends each request and decision only once (idempotent). |
| `queue-demo.js` | Four decisions go through the queue; one send fails twice and then works, one always fails. Prints the timeline. |
| `docs/middleware-types.json` | Message-oriented middleware, ESB, API gateway, ETL and EAI hub: what each is for and where it fits the planner. |
| `review/queue-facts.js`, `review/queue-review.js` | The AI review: three findings and three claims about queues, decided by running the code. |
| `test/ep10-*.test.js` | Tests for the queue, the notifier (tag `[FR-12]`), the middleware table and the review. |

## Run

```
npm run queue-demo      # the timeline of the four e-mails
npm run review:queue    # the AI review
npm test                # all tests of the folder
```

The tests use a fake `sleep` that records the waits, so no test waits for real time.

## The idea in four lines

1. The producer calls `publish` and goes on; it never waits for the e-mail server.
2. `drain` gives each message to its consumer. If the consumer throws, the queue waits 100, then 400 ms and tries again.
3. After three attempts the message moves to `deadLetters` for a person to look at.
4. Delivery is at least once, so the consumer must be idempotent: the notifier remembers `requestNo:decision`.

## Earlier episodes

The BPMN model and its checker (episode 2) and the process documentation (episode 3) are unchanged; their scripts stay in `package.json`.
