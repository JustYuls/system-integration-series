import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_FILE, loadVenues, venuesFor } from "../src/venues.js";

describe("loadVenues", () => {
  const venues = loadVenues();
  test("loads the five campus venues", () => assert.equal(venues.length, 5));
  test("capacity is a number and outdoor is a boolean", () => {
    assert.equal(typeof venues[0].capacity, "number");
    assert.equal(typeof venues[0].outdoor, "boolean");
  });
  test("the Field is the only outdoor venue", () => {
    assert.deepEqual(venues.filter((v) => v.outdoor).map((v) => v.id), ["field"]);
  });
  test("the default file is an absolute path to venues.csv", () => {
    assert.ok(DEFAULT_FILE.endsWith("venues.csv"));
    assert.ok(DEFAULT_FILE.length > "venues.csv".length);
  });
});

describe("venuesFor", () => {
  test("100 people: Gym, Atrium and Field, smallest first", () => {
    assert.deepEqual(venuesFor(100).map((v) => v.id), ["gym", "atrium", "field"]);
  });
  test("a venue that holds exactly the group is included", () => {
    assert.equal(venuesFor(40)[0].id, "lab-a");
  });
  test("outdoor: true keeps only the Field", () => {
    assert.deepEqual(venuesFor(100, { outdoor: true }).map((v) => v.id), ["field"]);
  });
  test("a group that is too big gets an empty list", () => assert.deepEqual(venuesFor(5000), []));
  test("bad input throws a RangeError", () => {
    assert.throws(() => venuesFor(0), RangeError);
    assert.throws(() => venuesFor("100"), RangeError);
  });
  test("the venue list can be passed in", () => {
    const one = [{ id: "x", capacity: 10, outdoor: false }];
    assert.deepEqual(venuesFor(5, { venues: one }), one);
  });
});
