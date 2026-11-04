# Presenting the Campus Event Planner: an 8 minute talk

A script for a technical project talk. It is the pattern for your own final project: swap the story, keep the structure. Speaking speed: about 130 words a minute, so 8 minutes is about 1,000 spoken words. Every demo line comes from `npm run demo` (fake outside APIs, a fixed date), so the output is the same on every computer.

## The plan at a glance

| Time | Part | Show | Goal |
|---|---|---|---|
| 0:00 to 0:45 | 1. The problem | One slide: three silos | The audience cares |
| 0:45 to 1:45 | 2. The process | `docs/process.bpmn` image | They see the business story |
| 1:45 to 3:00 | 3. The design | Component diagram (`docs/architecture.md`) | They see the parts and why |
| 3:00 to 5:30 | 4. Live demo | Terminal: `npm run demo` | They see it work, and fail safely |
| 5:30 to 6:30 | 5. The proof | `node verify.js` output | They trust it |
| 6:30 to 7:15 | 6. Limits and next steps | One slide | They see honesty |
| 7:15 to 8:00 | 7. Close and questions | One slide | They remember one sentence |

Rule of thumb: one slide for each minute, a picture instead of a paragraph, and never read the slide aloud.

## 1. The problem (0:00 to 0:45)

**Show:** the three silos: Student Affairs (CSV), Finance (JSON), Facilities (XML).

**Say:** "A student organization wants to hold an event. Today an officer opens three systems, and checks a holiday calendar and a weather site by hand. It takes days, and the answer depends on who is on duty. We built a planner that asks all of them at the same time and answers with a decision and the reasons, in a few seconds."

## 2. The process (0:45 to 1:45)

**Show:** the BPMN diagram, with your finger (or the mouse) on the path: request, four checks in parallel, decision, notice.

**Say:** "This is the business process before any code. Four checks: the date is not a holiday, the venue is free and has no penalty, the weather is good for an outdoor event, the deposit is paid. If all pass, the request is approved. If one fails, it is returned with the reason. If a service does not answer, a person decides. Every requirement in this project, twelve functional and eight non-functional, comes from this picture."

## 3. The design (1:45 to 3:00)

**Show:** the component diagram: page, gateway, three services, three outside APIs, queue.

**Say:** "One gateway is the only door. Behind it, three REST services, each one owns its data. Three free outside APIs: Nager.Date for holidays, Open-Meteo for weather, Frankfurter for exchange rates. A queue carries the notice to the organizer, so the page does not wait for the mail. Each outside call has a cache, a retry, and a circuit breaker, so a broken API cannot break the planner. We chose this hub design by scoring the options with weights taken from our non-functional requirements."

## 4. Live demo (3:00 to 5:30)

**Show:** the terminal, large font. Run `npm run demo` once, then scroll through the output with the four stories. Do not type live: the script is the demo.

| Story | Point to | Say |
|---|---|---|
| EVT-0001 approved | the four `passed` lines, the status `Approved`, the e-mail line | "Everything passed, so it is approved, the status changed in Student Affairs, and the organizer got a mail." |
| EVT-0002 returned | the penalty line and the deposit line | "Two problems, two sentences, in plain language. The organizer knows exactly what to fix." |
| EVT-0008 returned | the Christmas line, and the `unknown` weather line | "Christmas Day. The weather is unknown, because the forecast does not reach December, but one failed check is enough." |
| Outage | the `needs-review` decision, status `Pending` | "The holiday API is down. The planner still answers: needs review. It never guesses, and it never crashes." |

**Optional, if time allows:** open `http://localhost:4000` (after `node start-all.js`), send one request in the page, show the decision card.

## 5. The proof (5:30 to 6:30)

**Show:** the output of `node verify.js`: the table with one row for every requirement.

**Say:** "We wrote the requirements first, and every one has a tag. The tests carry the tags in their names. This script reads all of them: every one of the twenty requirements has at least one test, and every endpoint has a test. Here we also kill a service, slow one down, and make the mail server fail twice, to see what the system does. It degrades, it does not fall over."

## 6. Limits and next steps (6:30 to 7:15)

**Show:** one slide, five bullets from `docs/final-report.md`.

**Say:** "Honest limits: no login, no rate limiting, no database, one process, no deployment. Next steps in this order: authentication, rate limits at the gateway, a database for each service, then deployment. We also keep one live check against the real APIs outside the test suite, because fakes can be wrong."

## 7. Close (7:15 to 8:00)

**Say:** "One sentence to remember: integration is not connecting systems, it is deciding what happens when one of them fails. Thank you. Questions?"

**Prepared answers for likely questions:**

- "Why fake APIs in the demo?" Stability: the internet in the room is not part of the project. The live run (`npm run plan-live`) exists and was run before the talk.
- "Why a gateway?" One door: one place for the time limit, the request id, and later for login and rate limits.
- "What if two requests come at the same moment?" The load test sends 20 at once, and each answer is correct.
- "Is the queue real?" It is in memory, to teach the idea. A real system would use a broker, and the handler code stays the same.

## Demo rules

1. **Script it.** Run the same commands, in the same order, every time. The demo is `npm run demo`; do not improvise.
2. **Use fakes for stability.** No internet, no keys, a fixed date. The story is repeatable.
3. **Have a plan B.** A screenshot or a recording of the demo output, in the slides, and the output saved in a text file.
4. **Show failure on purpose.** A demo where nothing can go wrong shows nothing. The outage story is the best minute of the talk.
5. **Big font.** The back row must read the terminal: at least 20 points, light text on a dark background.
6. **Time it twice.** Rehearse with a timer, once alone and once in front of a friend. Cut, do not speed up.

## Checklist for the demo day

Before the talk (the day before and one hour before):

- [ ] `node --test` is green in the project folder.
- [ ] `node verify.js` ends with OK.
- [ ] `npm run demo` prints the four stories (save the output in `demo-output.txt` for plan B).
- [ ] The laptop is charged and plugged in; notifications are off; the font of the terminal is large.
- [ ] No other program uses the ports 4000 to 4003 (`node start-all.js` needs them for the page).
- [ ] The slides are open and the images exist: BPMN, component diagram, the coverage table.
- [ ] A copy of everything is on a USB drive, and the repository is on GitHub.
- [ ] You know the answer to "what happens when a service is down?" by heart.

During the talk:

- [ ] Look at the audience, not at the screen.
- [ ] Say the requirement id when you show a result (FR-12, NFR-02): the audience learns the trace.
- [ ] If the demo breaks, say "plan B", show the saved output, and keep talking. Do not debug in front of the room.
