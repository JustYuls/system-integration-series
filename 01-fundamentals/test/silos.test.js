import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { normalizeId, normalizeTitle, parseDate, readFacilities, readFinance, readStudentAffairs } from "../src/adapters.js";
import { hubAndSpoke, pointToPoint, table } from "../src/connections.js";
import { blockReasons, canApprove, integrate, isComplete } from "../src/integrate.js";

describe("normalizing", () => {
  test("both id styles become one", () => {
    assert.equal(normalizeId("EVT0001"), "EVT-0001");
    assert.equal(normalizeId("EVT-0001"), "EVT-0001");
  });
  test("a bad id is rejected", () => assert.throws(() => normalizeId("EVT-01"), /not a request number/));
  test("titles are turned into normal capitals", () => {
    assert.equal(normalizeTitle("ORIENTATION DAY"), "Orientation Day");
    assert.equal(normalizeTitle("  job   fair "), "Job Fair");
  });
  test("the same text is two dates in two orders", () => {
    assert.equal(parseDate("03/04/2027", "MDY"), "2027-03-04");
    assert.equal(parseDate("03/04/2027", "DMY"), "2027-04-03");
  });
  test("an impossible date is rejected, not rolled over", () => assert.throws(() => parseDate("02/30/2027", "MDY"), /not a date/));
});

describe("adapters", () => {
  test("every silo returns the canonical keys", () => {
    assert.deepEqual(Object.keys(readStudentAffairs()[0]), ["requestNo", "title", "organization", "date", "status"]);
    assert.deepEqual(Object.keys(readFinance()[0]), ["requestNo", "title", "balancePhp"]);
    assert.deepEqual(Object.keys(readFacilities()[0]), ["requestNo", "title", "date", "venue", "hours", "penaltyPhp"]);
  });
  test("the three formats are read", () => {
    assert.equal(readStudentAffairs().length, 6); // CSV
    assert.equal(readFinance().length, 6); // JSON
    assert.equal(readFacilities().length, 7); // XML (one duplicate)
  });
  test("student affairs dates are month first", () => assert.equal(readStudentAffairs()[1].date, "2027-11-22"));
  test("a wrong date order fails loudly", () => assert.throws(() => readStudentAffairs({ order: "DMY" }), /not a date/));
});

describe("integration", () => {
  const { requests, issues } = integrate();

  test("one record per registered request", () => {
    assert.deepEqual(Object.keys(requests), ["EVT-0001", "EVT-0002", "EVT-0003", "EVT-0004", "EVT-0005", "EVT-0007"]);
  });
  test("two events titled General Assembly stay separate", () => {
    assert.equal(requests["EVT-0002"].title, requests["EVT-0007"].title);
    assert.notEqual(requests["EVT-0002"].balancePhp, requests["EVT-0007"].balancePhp);
  });
  test("data from all three systems is combined", () => {
    const r = requests["EVT-0001"];
    assert.deepEqual([r.status, r.balancePhp, r.hours], ["Pending", 0, 3]);
    assert.deepEqual(r.sources, ["student affairs", "finance", "facilities"]);
  });
  test("the issues are reported", () => {
    assert.deepEqual(issues, ["EVT-0003: duplicate record in facilities (kept the first)", "EVT-0005: no finance record", "EVT-0009: only in finance (not a registered request)"]);
  });
  test("a finance-only deposit is not a request", () => assert.equal(requests["EVT-0009"], undefined));
  test("approval uses the rules of all three systems", () => {
    assert.equal(canApprove(requests["EVT-0001"]), true);
    assert.deepEqual(blockReasons(requests["EVT-0002"]), ["deposit unpaid", "facility penalty"]);
    assert.deepEqual(blockReasons(requests["EVT-0004"]), ["deposit unpaid"]);
    assert.deepEqual(blockReasons(requests["EVT-0005"]), ["on hold", "no finance record", "facility penalty"]);
  });
  test("paying the deposit unblocks the request", () => {
    const paid = [{ requestNo: "EVT-0004", title: "Job Fair", balancePhp: 0 }];
    assert.equal(canApprove(integrate({ finance: paid }).requests["EVT-0004"]), true);
  });
  test("a finance outage leaves every record incomplete and approves nothing", () => {
    const down = integrate({ finance: [] }).requests;
    assert.equal(Object.values(down).filter(isComplete).length, 0);
    assert.equal(Object.values(down).some(canApprove), false); // fail safe
  });
  test("different dates are reported", () => {
    const facilities = readFacilities();
    facilities[0].date = "2000-01-01";
    assert.ok(integrate({ facilities }).issues.some((i) => i.includes("date differs")));
  });
});

describe("connections", () => {
  test("point-to-point grows fast", () => assert.deepEqual([2, 3, 4, 5, 6].map(pointToPoint), [1, 3, 6, 10, 15]));
  test("a hub needs one link per system", () => assert.deepEqual([2, 3, 4, 5, 6].map(hubAndSpoke), [2, 3, 4, 5, 6]));
  test("the hub wins from four systems", () => {
    for (let n = 4; n < 20; n++) assert.ok(hubAndSpoke(n) < pointToPoint(n));
    assert.ok(hubAndSpoke(2) >= pointToPoint(2));
  });
  test("the table", () => assert.deepEqual(table(3), [[2, 1, 2], [3, 3, 3]]));
});
