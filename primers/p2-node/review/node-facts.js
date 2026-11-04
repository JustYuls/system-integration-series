// Facts for the AI review: what an AI assistant said about reading the venue file in Node.js, decided by running code.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadVenues } from "../src/venues.js";

// The three small scripts that the checks run (each one is a whole ES module file)
const REQUIRE_SCRIPT = 'const fs = require("node:fs");';
const IMPORT_SCRIPT = 'await import("./helper");';
const ENV_SCRIPT = "console.log(typeof process.env.PORT);";

// Runs a small script file in a temporary folder and returns what it printed.
function runScript(dir, name, source, env = {}) {
  const file = path.join(dir, name);
  writeFileSync(file, source);
  const r = spawnSync(process.execPath, [file, "first", "second"], { encoding: "utf8", env: { ...process.env, ...env } });
  return { out: r.stdout.trim(), err: r.stderr, status: r.status };
}

// Which comes first: a 1 ms timer, or the end of reading a big file?
async function readOrder(dir, sync) {
  const big = path.join(dir, "big.txt");
  writeFileSync(big, "x".repeat(8_000_000));
  const order = [];
  setTimeout(() => order.push("timer"), 1);
  if (sync) readFileSync(big);
  else await readFile(big);
  order.push("read done");
  await new Promise((resolve) => setTimeout(resolve, 30)); // let the timer fire
  return order;
}

export async function collect() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "p2-review-"));
  try {
    const venues = loadVenues();
    // The same ES module run three ways: require, a missing extension, and the environment
    const needRequire = runScript(dir, "req.mjs", REQUIRE_SCRIPT);
    writeFileSync(path.join(dir, "helper.mjs"), "export const x = 1;");
    const noExtension = runScript(dir, "ext.mjs", IMPORT_SCRIPT);
    const argv = runScript(dir, "argv.mjs", "console.log(process.argv[2], process.argv.length);");
    const port = runScript(dir, "env.mjs", ENV_SCRIPT, { PORT: "3000" });
    return {
      // Finding 1: CSV cells are text, and text compares letter by letter
      textCompare: "60" > "400",
      capacityIsNumber: venues.every((v) => typeof v.capacity === "number"),
      // Finding 2: in an ES module a relative import needs the file extension
      noExtensionFails: noExtension.status !== 0 && noExtension.err.includes("ERR_MODULE_NOT_FOUND"),
      // Finding 3: the text "false" is truthy
      falseTextIsTruthy: Boolean("false"),
      outdoorIsBoolean: venues.every((v) => typeof v.outdoor === "boolean"),
      // Claim 4: require works in an ES module
      requireWorks: needRequire.status === 0,
      requireMessage: needRequire.err.includes("require is not defined"),
      // Claim 5: readFileSync blocks the event loop (the timer waits for it, but not for the async read)
      syncOrder: await readOrder(dir, true),
      asyncOrder: await readOrder(dir, false),
      // process.argv: [node, script, first argument, ...]
      firstArgument: argv.out.split(" ")[0],
      argvLength: Number(argv.out.split(" ")[1]),
      // Claim 6: environment variables are numbers when they look like numbers
      envType: port.out,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
