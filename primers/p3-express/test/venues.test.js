import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withApp } from "./helpers.js";

test("the venue file has the five campus venues", () => {
  const venues = JSON.parse(readFileSync(new URL("../data/venues.json", import.meta.url), "utf-8"));
  assert.deepEqual(venues.map((v) => v.id), ["gym", "room-101", "lab-a", "atrium", "field"]);
  assert.equal(venues.find((v) => v.id === "field").outdoor, true);
  assert.equal(venues.find((v) => v.id === "field").penaltyPhp, 120);
});

test("GET /api/venues returns all venues as JSON", () =>
  withApp({}, async (call) => {
    const r = await call("GET", "/api/venues");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /application\/json/);
    assert.equal(r.data.length, 5);
  }));

test("GET /api/venues?minCapacity=400 keeps the big venues", () =>
  withApp({}, async (call) => {
    const r = await call("GET", "/api/venues?minCapacity=400");
    assert.deepEqual(r.data.map((v) => v.id), ["gym", "atrium", "field"]);
  }));

test("minCapacity above every venue gives an empty list, not an error", () =>
  withApp({}, async (call) => {
    const r = await call("GET", "/api/venues?minCapacity=5000");
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, []);
  }));

test("createApp uses the venues it is given", () =>
  withApp({ venues: [{ id: "x", name: "X", capacity: 10, outdoor: false, penaltyPhp: 0 }] }, async (call) => {
    const r = await call("GET", "/api/venues");
    assert.equal(r.data.length, 1);
    assert.equal(r.data[0].id, "x");
  }));

test("GET /api/venues/:id returns one venue", () =>
  withApp({}, async (call) => {
    const r = await call("GET", "/api/venues/gym");
    assert.equal(r.status, 200);
    assert.equal(r.data.name, "Gym");
    assert.equal(r.data.capacity, 400);
  }));

test("a route parameter picks the venue (room-101)", () =>
  withApp({}, async (call) => {
    const r = await call("GET", "/api/venues/room-101");
    assert.equal(r.data.capacity, 60);
  }));

test("an unknown venue gives 404 with the error shape", () =>
  withApp({}, async (call) => {
    const r = await call("GET", "/api/venues/pool");
    assert.equal(r.status, 404);
    assert.equal(r.data.error.code, "NOT_FOUND");
    assert.match(r.data.error.message, /pool/);
  }));
