import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkRequest, isRealDate } from "../src/check-request.js";

const valid = {
  requestNo: "EVT-0001", title: "Orientation Day", date: "2027-03-04", venue: "Gym",
  attendees: 120, budget: { amount: 15000, currency: "PHP" }, outdoor: false, contactEmail: "cs@campus.example",
};
const withChange = (change) => ({ ...valid, ...change });
const problemsAbout = (request, field) => checkRequest(request).filter((p) => p.startsWith(field));

describe("checkRequest", () => {
  test("a valid request has no problems", () => assert.deepEqual(checkRequest(valid), []));
  test("a missing title is a problem", () => assert.equal(problemsAbout(withChange({ title: "" }), "title").length, 1));
  test("a title of spaces is a problem", () => assert.equal(problemsAbout(withChange({ title: "   " }), "title").length, 1));
  test("a date in the wrong shape is a problem", () => assert.equal(problemsAbout(withChange({ date: "03/04/2027" }), "date").length, 1));
  test("an impossible date is a problem", () => assert.equal(problemsAbout(withChange({ date: "2027-02-30" }), "date").length, 1));
  test("attendees as text is a problem", () => assert.equal(problemsAbout(withChange({ attendees: "120" }), "attendees").length, 1));
  test("zero attendees is a problem", () => assert.equal(problemsAbout(withChange({ attendees: 0 }), "attendees").length, 1));
  test("a fraction of a person is a problem", () => assert.equal(problemsAbout(withChange({ attendees: 2.5 }), "attendees").length, 1));
  test("a negative budget is a problem", () => assert.equal(problemsAbout(withChange({ budget: { amount: -1, currency: "PHP" } }), "budget.amount").length, 1));
  test("a budget of zero is allowed", () => assert.deepEqual(checkRequest(withChange({ budget: { amount: 0, currency: "PHP" } })), []));
  test("a currency must be 3 capital letters", () => assert.equal(problemsAbout(withChange({ budget: { amount: 5, currency: "peso" } }), "budget.currency").length, 1));
  test("a missing budget is a problem", () => assert.equal(problemsAbout(withChange({ budget: undefined }), "budget").length, 1));
  test("an e-mail without @ is a problem", () => assert.equal(problemsAbout(withChange({ contactEmail: "cs.campus.example" }), "contactEmail").length, 1));
  test("several mistakes give several problems", () => assert.equal(checkRequest(withChange({ title: "", attendees: -3, contactEmail: "x" })).length, 3));
  test("something that is not an object is a problem", () => assert.deepEqual(checkRequest(null), ["request: must be an object"]));
  test("outdoor must be true or false", () => assert.equal(problemsAbout(withChange({ outdoor: "yes" }), "outdoor").length, 1));
});

describe("isRealDate", () => {
  test("a leap day is real in 2028", () => assert.equal(isRealDate("2028-02-29"), true));
  test("a leap day is not real in 2027", () => assert.equal(isRealDate("2027-02-29"), false));
});
