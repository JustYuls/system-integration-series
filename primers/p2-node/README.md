# Primer 2 (Week 1): Node.js for the Campus Event Planner

Self-study primer. You know basic JavaScript from Primer 1. Here you run it outside the browser with Node.js, read the venue file of the Campus Event Planner, and test your code with the test runner that is built into Node.js. Every service of the planner is a Node program like this one.

## What you need

- Node.js 20 or newer (24 recommended). Check with `node --version` and `npm --version`.
- Visual Studio Code.
- This folder, `primers/p2-node`. There is **nothing to install**: the lab uses only built-in modules.

## What is in the folder

| File | What it does |
|---|---|
| `data/venues.csv` | The five campus venues: `id,name,capacity,outdoor,penaltyPhp` |
| `src/csv.js` | A small CSV reader: text in, array of objects out, numbers and booleans converted |
| `src/venues.js` | `loadVenues(file)` and `venuesFor(people, { outdoor })` |
| `src/args.js` | Reads the command-line arguments |
| `src/files.js` | Writes a JSON report with `fs/promises` and `path` |
| `venues-cli.js` | The command-line tool |
| `demo.js` | A tour: venues, built-in modules, a report file, the event loop |
| `review/` | The AI check: three findings and three claims, each decided by code |
| `test/` | The tests, written with `node:test` |

`package.json` has `"type": "module"`, so `import` and `export` work in every `.js` file.

## Run it

```
node demo.js
node venues-cli.js --capacity 100
node venues-cli.js --capacity 100 --outdoor
node venues-cli.js
```

The last command has no arguments: it prints `Error: missing --capacity` and the usage line, and exits with code 1. Set the environment variable `VENUE_FILE` to read another CSV file:

```
VENUE_FILE=my-venues.csv node venues-cli.js --capacity 20          (macOS, Linux, Git Bash)
$env:VENUE_FILE = "my-venues.csv"; node venues-cli.js --capacity 20  (PowerShell)
```

Real output of `node venues-cli.js --capacity 100`:

```
Venues for 100 people: 3 found
  gym       Gym         400  indoor   penalty 0 PHP
  atrium    Atrium      500  indoor   penalty 0 PHP
  field     Field      1000  outdoor  penalty 120 PHP
```

## Test it

```
node --test
```

Tests use `describe`, `test`, `before` and `after` from `node:test`, and `node:assert/strict`. Tests that need a file make a temporary folder with `fs.mkdtempSync(os.tmpdir())` and remove it afterwards. Start with `test/p2-csv.test.js`.

## The AI check

```
node review/node-review.js
```

An AI assistant gave three findings (all correct) and three claims (two false, one true). The code decides each one: a text comparison, a failed import, `Boolean("false")`, a script that calls `require` in an ES module, a timer race against `readFileSync`, and a child process that prints `typeof process.env.PORT`.

## Next

Primer 3 adds Express: `npm install express`, `GET /venues`, and a web page that shows the venues.
