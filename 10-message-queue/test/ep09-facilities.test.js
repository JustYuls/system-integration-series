import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createFacilitiesApp } from "../src/services/facilities.js";
import { send, start } from "../src/serve.js";

let api;
const reserve = (body) => send(api.url, "/reservations", { method: "POST", body });
const available = (id, query) => send(api.url, `/venues/${id}/availability?${query}`);
const gymBooking = { requestNo: "EVT-0001", venueId: "gym", date: "2027-03-04", hours: 4 };

before(async () => {
  api = await start(createFacilitiesApp());
});
after(() => api.close());

describe("venues", () => {
  test("the collection lists the five venues", async () => {
    const res = await send(api.url, "/venues");
    assert.deepEqual(res.body.map((v) => v.id), ["gym", "room-101", "lab-a", "atrium", "field"]);
  });

  test("?minCapacity= keeps the venues that are big enough", async () => {
    const res = await send(api.url, "/venues?minCapacity=300");
    assert.deepEqual(res.body.map((v) => v.id), ["gym", "atrium", "field"]);
  });

  test("a minCapacity that is not a number is a 400", async () => {
    const res = await send(api.url, "/venues?minCapacity=big");
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.invalid, ["minCapacity"]);
  });

  test("one venue has its capacity and penalty", async () => {
    const res = await send(api.url, "/venues/room-101");
    assert.deepEqual(res.body, { id: "room-101", name: "Room 101", capacity: 60, outdoor: false, penaltyPhp: 50 });
  });

  test("an unknown venue is a 404", async () => {
    const res = await send(api.url, "/venues/ballroom");
    assert.equal(res.status, 404);
    assert.equal(res.body.error.message, "No venue ballroom");
  });
});

describe("availability: a question, so a GET", () => {
  test("[FR-03] a free venue with enough room is available", async () => {
    const res = await available("gym", "date=2027-03-04&attendees=120");
    assert.deepEqual(res.body, { venue: "Gym", date: "2027-03-04", available: true, capacityOk: true, penaltyPhp: 0, reasons: [] });
  });

  test("[FR-03] a venue that holds fewer people than the attendees fails with a reason", async () => {
    const res = await available("lab-a", "date=2028-01-09&attendees=80");
    assert.equal(res.body.capacityOk, false);
    assert.deepEqual(res.body.reasons, ["Lab A holds 40 people, not 80"]);
  });

  test("[FR-03] a venue that is reserved on the date is not available", async () => {
    const res = await available("gym", "date=2027-03-05&attendees=50");
    assert.equal(res.body.available, false);
    assert.deepEqual(res.body.reasons, ["Gym is already reserved on 2027-03-05"]);
  });

  test("[FR-04] an unpaid penalty is reported with its amount", async () => {
    const res = await available("room-101", "date=2027-11-22&attendees=60");
    assert.equal(res.body.penaltyPhp, 50);
    assert.deepEqual(res.body.reasons, ["Room 101 has an unpaid penalty of 50 PHP"]);
  });

  test("[FR-04] a venue with no penalty reports 0", async () => {
    assert.equal((await available("atrium", "date=2027-07-30&attendees=300")).body.penaltyPhp, 0);
  });

  test("the date is required and must be an ISO date", async () => {
    assert.deepEqual((await available("gym", "attendees=10")).body.error.missing, ["date"]);
    assert.deepEqual((await available("gym", "date=03/04/2027")).body.error.invalid, ["date"]);
  });

  test("attendees must be a whole number when it is sent", async () => {
    const res = await available("gym", "date=2027-03-04&attendees=lots");
    assert.deepEqual(res.body.error.invalid, ["attendees"]);
  });

  test("availability of an unknown venue is a 404", async () => {
    assert.equal((await available("ballroom", "date=2027-03-04")).status, 404);
  });
});

describe("reservations", () => {
  test("the seed has two reservations, and ?venueId= filters them", async () => {
    assert.equal((await send(api.url, "/reservations")).body.length, 2);
    assert.deepEqual((await send(api.url, "/reservations?venueId=atrium")).body.map((r) => r.requestNo), ["EVT-0010"]);
  });

  test("[FR-03] a reservation is created with 201 and a Location", async () => {
    const res = await reserve(gymBooking);
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("location"), "/reservations/EVT-0001");
    assert.deepEqual(res.body, gymBooking);
  });

  test("[FR-03] the venue is then reserved on that date", async () => {
    const res = await available("gym", "date=2027-03-04");
    assert.equal(res.body.available, false);
  });

  test("[FR-03] a second reservation of the same venue and date is a 409", async () => {
    const res = await reserve({ ...gymBooking, requestNo: "EVT-0003" });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "ALREADY_RESERVED");
  });

  test("a request cannot hold two reservations: 409", async () => {
    const res = await reserve({ ...gymBooking, date: "2027-04-01" });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "DUPLICATE_RESERVATION");
  });

  test("the reservation of a request is found by its number, or 404", async () => {
    assert.equal((await send(api.url, "/reservations/EVT-0001")).body.venueId, "gym");
    assert.equal((await send(api.url, "/reservations/EVT-0099")).status, 404);
  });

  test("an unknown venue in the body is a 422, not a 404", async () => {
    const res = await reserve({ ...gymBooking, requestNo: "EVT-0020", venueId: "ballroom" });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, "UNKNOWN_VENUE");
  });

  test("missing and invalid fields are listed", async () => {
    const res = await reserve({ requestNo: "EVT-1", venueId: "gym", hours: 40 });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.missing, ["date"]);
    assert.deepEqual(res.body.error.invalid, ["requestNo", "hours"]);
  });
});
