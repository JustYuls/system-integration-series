import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkEnvelope, isCurrencyCode, isErrorBody, isIsoDate, loadStandards } from "../src/standards.js";
import { loadNfr } from "../src/nfr.js";

const json = { "content-type": "application/json; charset=utf-8" };

describe("the list of standards", () => {
  const list = loadStandards();
  test("there are 7 standards and 5 practices with unique ids", () => {
    assert.equal(list.filter((s) => s.kind === "standard").length, 7);
    assert.equal(list.filter((s) => s.kind === "practice").length, 5);
    assert.equal(new Set(list.map((s) => s.id)).size, 12);
  });
  test("each one has a rule, a reason and an example, and points to a real NFR", () => {
    const nfrs = loadNfr().map((n) => n.id);
    for (const s of list) {
      assert.ok(s.rule && s.why && s.example && s.name, s.id);
      assert.ok(nfrs.includes(s.nfr), `${s.id} points to ${s.nfr}`);
    }
  });
  test("the timeout practice fits the time limit: 3 x 800 + 500 = 2900 ms", () => {
    const t = list.find((s) => s.id === "STD-09");
    assert.ok(t.rule.includes("800 ms"));
    assert.equal(3 * 800 + 500, 2900);
  });
});

describe("isIsoDate", () => {
  test("[NFR-06] 2027-03-04 is an ISO 8601 date", () => assert.equal(isIsoDate("2027-03-04"), true));
  test("[NFR-06] dd/mm/yyyy is rejected, because 04/03/2027 is ambiguous", () => {
    assert.equal(isIsoDate("04/03/2027"), false);
    assert.equal(isIsoDate("03/04/2027"), false);
  });
  test("[NFR-06] a day that does not exist is rejected", () => {
    assert.equal(isIsoDate("2027-02-30"), false);
    assert.equal(isIsoDate("2027-13-01"), false);
  });
  test("[NFR-06] 29 February exists only in a leap year", () => {
    assert.equal(isIsoDate("2028-02-29"), true);
    assert.equal(isIsoDate("2027-02-29"), false);
  });
  test("[NFR-06] a date with a time, or a number, is rejected", () => {
    assert.equal(isIsoDate("2027-03-04T10:00:00Z"), false);
    assert.equal(isIsoDate(20270304), false);
  });
});

describe("isCurrencyCode", () => {
  test("[NFR-06] PHP and USD are ISO 4217 codes", () => assert.ok(isCurrencyCode("PHP") && isCurrencyCode("USD")));
  test("[NFR-06] names, symbols and lower case are rejected", () => {
    for (const bad of ["peso", "$", "php", "PH", 5]) assert.equal(isCurrencyCode(bad), false);
  });
});

describe("isErrorBody", () => {
  test("[NFR-05] the one error format is accepted", () => {
    assert.equal(isErrorBody({ error: { code: "NOT_FOUND", message: "No request EVT-0099" } }), true);
  });
  test("[NFR-05] a plain string, a missing message, or extra fields are rejected", () => {
    assert.equal(isErrorBody({ error: "not found" }), false);
    assert.equal(isErrorBody({ error: { code: "NOT_FOUND" } }), false);
    assert.equal(isErrorBody({ error: { code: "NOT_FOUND", message: "x" }, extra: 1 }), false);
    assert.equal(isErrorBody({ error: { code: "not found", message: "x" } }), false);
  });
});

describe("checkEnvelope", () => {
  test("[NFR-06] a response that follows all conventions has no problems", () => {
    const r = { status: 200, headers: json, body: { requestNo: "EVT-0004", date: "2027-07-30", budget: { amount: 500, currency: "USD" } } };
    assert.deepEqual(checkEnvelope(r), []);
  });
  test("[NFR-06] a wrong content type is reported", () => {
    assert.deepEqual(checkEnvelope({ status: 200, headers: { "content-type": "text/html" }, body: {} }), ['content type "text/html" is not application/json']);
  });
  test("[NFR-06] a wrong date and a wrong currency, even deep inside, are reported", () => {
    const r = { status: 200, headers: json, body: { items: [{ eventDate: "30/07/2027", budget: { amount: 5, currency: "dollars" } }] } };
    const found = checkEnvelope(r);
    assert.equal(found.length, 2);
    assert.ok(found[0].includes("body.items[0].eventDate"));
    assert.ok(found[1].includes("body.items[0].budget.currency"));
  });
  test("[NFR-06] a charset other than utf-8 is reported", () => {
    const found = checkEnvelope({ status: 200, headers: { "content-type": "application/json; charset=latin1" }, body: {} });
    assert.deepEqual(found, ["the charset is not utf-8"]);
  });
  test("[NFR-05] an error response must use the error format", () => {
    assert.deepEqual(checkEnvelope({ status: 404, headers: json, body: { message: "gone" } }), ["an error response must use the error format"]);
    assert.deepEqual(checkEnvelope({ status: 404, headers: json, body: { error: { code: "NOT_FOUND", message: "No request" } } }), []);
  });
});
