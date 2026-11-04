// The seed data of the three services, read from data/*.json. Every call returns a fresh copy.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const load = (name) => JSON.parse(readFileSync(path.join(dir, name), "utf8"));

export const seedData = () => ({
  requests: load("requests.json"),
  deposits: load("deposits.json"),
  venues: load("venues.json"),
  reservations: load("reservations.json"),
});
