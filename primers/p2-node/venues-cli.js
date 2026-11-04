// Lists the venues that fit a group.   node venues-cli.js --capacity 100 [--outdoor]
// Optional: set the environment variable VENUE_FILE to read another CSV file.
import { parseArgs, USAGE } from "./src/args.js";
import { loadVenues, venuesFor } from "./src/venues.js";

function fail(message) {
  console.error(`Error: ${message}`);
  console.error(USAGE);
  process.exit(1);
}

let options;
try {
  options = parseArgs(process.argv.slice(2)); // argv[0] is node, argv[1] is this file
} catch (error) {
  fail(error.message);
}

let venues;
try {
  venues = loadVenues(process.env.VENUE_FILE || undefined);
} catch (error) {
  fail(`cannot read the venue file (${error.code ?? error.message})`);
}

const found = venuesFor(options.capacity, { outdoor: options.outdoor, venues });
const kind = options.outdoor ? " (outdoor only)" : "";
if (found.length === 0) {
  console.log(`No venue holds ${options.capacity} people${kind}.`);
} else {
  console.log(`Venues for ${options.capacity} people${kind}: ${found.length} found`);
  for (const v of found) {
    const place = v.outdoor ? "outdoor" : "indoor";
    console.log(`  ${v.id.padEnd(9)} ${v.name.padEnd(9)} ${String(v.capacity).padStart(5)}  ${place.padEnd(7)}  penalty ${v.penaltyPhp} PHP`);
  }
}
