# Primer 3 (Week 2): Express, HTML and CSS for the Campus Event Planner

Self-study primer, about 10 minutes of video. You know JavaScript (Primer 1) and Node.js basics (Primer 2). Here you build the web side of the Campus Event Planner: an Express API and an HTML and CSS page that talks to it with `fetch`. The services of episode 9 and the gateway of episode 11 use exactly these ideas.

## What you need

- Node.js 20 or newer (24 recommended) and Visual Studio Code.
- Express 5. In the course repository it is already installed at the root. On its own, run `npm install` in this folder.
- Optional: Thunder Client (VS Code extension) or Postman, to try the API by hand.

## Run it

```
npm start
```

Open http://localhost:3000. You see the venue table, a capacity filter, and the request form. The terminal prints one log line for every request.

```
node demo.js
```

Starts the app on a free port, calls it with `fetch` and prints the result. Real output:

```
GET /api/venues                      200  5 venues
GET /api/venues?minCapacity=400      200  gym, atrium, field
GET /api/venues/gym                  200  Gym, capacity 400
GET /api/venues/pool                 404  NOT_FOUND
POST /api/requests (good)            201  EVT-0001, Location /api/requests/EVT-0001
POST /api/requests (bad)             400  3 problems
  - title is required
  - date must be a real date like 2027-03-04
  - attendees (90) is more than the capacity of Lab A (40)
```

## The API

| Request | Answer |
|---|---|
| `GET /api/venues` (`?minCapacity=100`) | 200, a list of venues |
| `GET /api/venues/:id` | 200, one venue, or 404 `{ "error": { "code": "NOT_FOUND", "message": "..." } }` |
| `POST /api/requests` | 201 with the created request and a `Location` header, or 400 with `error.problems` |
| `GET /api/requests`, `GET /api/requests/:requestNo` | the requests kept in memory (gone when the server stops) |

Middleware, in order: request logger, `express.json()`, `express.static`, the routes, a 404 handler, the error handler. The order matters.

## The files

| File | What it is |
|---|---|
| `src/app.js` | `createApp({ venues, logger })` returns the Express app |
| `src/validate.js` | checks a new request and lists every problem |
| `src/escape.js` | `escapeHtml`, to show what "safe" means |
| `server.js` | starts the app on port 3000 |
| `public/index.html`, `styles.css`, `app.js` | the page: semantic HTML, plain CSS, browser JavaScript with `fetch` and `textContent` |
| `demo.js` | the real output above |
| `review/express-review.js` | checks an AI answer: 3 findings and 3 claims, each decided by code |

## The AI check

```
node review/express-review.js
```

Three findings are confirmed (404 error shape, 201 with Location, 400 above the capacity). Claim 4 ("`express.json()` is needed to read a JSON body") is TRUE. Claim 5 ("the order of middleware does not matter") is FALSE. Claim 6 ("`innerHTML` with user text is safe") is FALSE.

## Tests

```
node --test
```

Uses only `node:test`: each test starts the app with `listen(0)` and calls it with `fetch`. Result: **46 tests, 46 pass, 0 fail.**
