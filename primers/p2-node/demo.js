// A tour of the primer.   node demo.js
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { writeReport } from "./src/files.js";
import { loadVenues, venuesFor } from "./src/venues.js";

// 1. Read the CSV file and use it
const venues = loadVenues();
console.log(`${venues.length} venues loaded. The first one:`);
console.log(JSON.stringify(venues[0]));
const names = venuesFor(100).map((v) => v.name);
console.log("Venues for 100 people:", names.join(", "));
console.log("Outdoor, 100 people:  ", venuesFor(100, { outdoor: true }).map((v) => v.name).join(", "));

// 2. The built-in modules
console.log(`Node ${process.version} on ${os.platform()}; file name: ${path.basename(import.meta.url)}`);

// 3. Write a JSON report with fs/promises
const file = await writeReport("out", "venues-for-100", { people: 100, venues: venuesFor(100) });
console.log("Report written to", path.relative(process.cwd(), file));

// 4. The event loop: a timer must wait until the running code is finished
function blockFor(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* busy: nothing else can run */ }
}
const t0 = Date.now();
function report() {
  console.log(`4 timer wanted 10 ms, ran after ${Date.now() - t0} ms`);
}
console.log("1 start");
setTimeout(report, 10);
blockFor(50); // pretend this is a slow readFileSync
console.log("2 blocked for 50 ms");
console.log("3 end of the script");
