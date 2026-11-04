# Primer 1: JavaScript basics for the Campus Event Planner

You are new to JavaScript. This folder holds the first real pieces of the Campus Event Planner: a function that checks one event request, a few venue helpers, and a call to the free Open-Meteo weather service. No packages to install.

You need Visual Studio Code and Node.js 20 or newer (check with `node --version` in the VS Code terminal).

## Run it

```
node demo.js
node review/js-review.js
node --test
```

`demo.js` checks a valid and an invalid request, lists the venues that fit 100 people, and asks Open-Meteo for the chance of rain 3 days from now (this part needs the internet).

## Files

| File | What it teaches |
|---|---|
| `src/check-request.js` | `checkRequest(request)`: objects, conditionals, strings, numbers, a list of problems |
| `src/venues.js` | arrays: `filter`, `find`, `map` (arrow functions) |
| `src/weather.js` | `async`/`await`, `fetch`, `try`/`catch`, JSON |
| `demo.js` | template strings, `console.log`, using the three modules together |
| `review/js-facts.js`, `review/js-review.js` | the AI check: three findings and three claims, each decided by running code |
| `test/*.test.js` | tests with `node:test`; `fetch` is replaced by a fake, so the tests never use the internet |

## Try these

1. Add a rule to `checkRequest`: `venue` is required. Add a test first and watch it fail.
2. Add `venuesThatAreOutdoor()` to `venues.js` with `filter`.
3. Change `rainChance` to return `{ date, percent }` and fix the tests.

Next: Primer 2, Node.js.
