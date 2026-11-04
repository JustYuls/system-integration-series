// The venues of the campus, read from data/venues.csv.
import { fileURLToPath } from "node:url";
import { readCsv } from "./csv.js";

// ES modules have no __dirname: build the path from import.meta.url instead.
export const DEFAULT_FILE = fileURLToPath(new URL("../data/venues.csv", import.meta.url));

export function loadVenues(file = DEFAULT_FILE) {
  return readCsv(file);
}

// Venues that hold `people`, smallest first. { outdoor: true } keeps only outdoor venues.
export function venuesFor(people, { outdoor = false, venues = loadVenues() } = {}) {
  if (!Number.isInteger(people) || people < 1) {
    throw new RangeError(`people must be a whole number of 1 or more, got ${people}`);
  }
  return venues
    .filter((venue) => venue.capacity >= people)
    .filter((venue) => !outdoor || venue.outdoor)
    .sort((a, b) => a.capacity - b.capacity);
}
