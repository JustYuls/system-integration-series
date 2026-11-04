import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { findVenue, venueNames, venues, venuesThatFit } from "../src/venues.js";

describe("venues", () => {
  test("for 100 people, the Gym, the Atrium and the Field fit", () => {
    assert.deepEqual(venuesThatFit(100).map((v) => v.id), ["gym", "atrium", "field"]);
  });
  test("a venue that has exactly the capacity fits", () => assert.ok(venuesThatFit(60).some((v) => v.id === "room-101")));
  test("nothing fits 5000 people", () => assert.deepEqual(venuesThatFit(5000), []));
  test("findVenue finds a venue by id", () => assert.equal(findVenue("lab-a").name, "Lab A"));
  test("findVenue gives undefined for an unknown id", () => assert.equal(findVenue("pool"), undefined));
  test("venueNames lists the names", () => assert.deepEqual(venueNames(), ["Gym", "Room 101", "Lab A", "Atrium", "Field"]));
  test("map and filter do not change the original array", () => {
    const before = venues.length;
    venuesThatFit(100);
    venueNames();
    assert.equal(venues.length, before);
  });
});
