import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createFinanceApp } from "../src/services/finance.js";
import { send, start } from "../src/serve.js";

let api;
const pay = (no, body) => send(api.url, `/deposits/${no}/payments`, { method: "POST", body });

before(async () => {
  api = await start(createFinanceApp());
});
after(() => api.close());

describe("reading a deposit", () => {
  test("[FR-06] a deposit with a balance shows how much is unpaid", async () => {
    const res = await send(api.url, "/deposits/EVT-0004");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { requestNo: "EVT-0004", balancePhp: 320 });
  });

  test("[FR-06] a paid deposit has a balance of 0", async () => {
    assert.equal((await send(api.url, "/deposits/EVT-0001")).body.balancePhp, 0);
  });

  test("a request with no record is a 404 (EVT-0005 has no deposit)", async () => {
    const res = await send(api.url, "/deposits/EVT-0005");
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });
});

describe("POST a payment", () => {
  test("a payment is created with 201 and a Location, and the balance goes down", async () => {
    const res = await pay("EVT-0004", { amountPhp: 120 });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("location"), "/deposits/EVT-0004/payments/1");
    assert.deepEqual(res.body, { id: 1, requestNo: "EVT-0004", amountPhp: 120, balancePhp: 200 });
    assert.equal((await send(api.url, "/deposits/EVT-0004")).body.balancePhp, 200);
  });

  test("the payment can be read at its Location, and listed", async () => {
    const one = await send(api.url, "/deposits/EVT-0004/payments/1");
    assert.equal(one.body.amountPhp, 120);
    const all = await send(api.url, "/deposits/EVT-0004/payments");
    assert.equal(all.body.length, 1);
  });

  test("centavos are kept exactly: 1500.5 minus 0.25", async () => {
    const res = await pay("EVT-0002", { amountPhp: 0.25 });
    assert.equal(res.body.balancePhp, 1500.25);
  });

  test("paying the whole balance makes it 0", async () => {
    const res = await pay("EVT-0004", { amountPhp: 200 });
    assert.equal(res.body.balancePhp, 0);
  });

  test("a deposit that is paid refuses another payment with 409", async () => {
    const res = await pay("EVT-0004", { amountPhp: 10 });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "ALREADY_PAID");
  });

  test("a payment above the balance is a 422: well formed, but the rule says no", async () => {
    const res = await pay("EVT-0002", { amountPhp: 5000 });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, "OVERPAYMENT");
  });

  test("a missing, negative or text amount is a 400", async () => {
    assert.deepEqual((await pay("EVT-0002", {})).body.error.missing, ["amountPhp"]);
    assert.deepEqual((await pay("EVT-0002", { amountPhp: -5 })).body.error.invalid, ["amountPhp"]);
    assert.deepEqual((await pay("EVT-0002", { amountPhp: "100" })).body.error.invalid, ["amountPhp"]);
  });

  test("a payment for a request with no deposit is a 404", async () => {
    assert.equal((await pay("EVT-0005", { amountPhp: 10 })).status, 404);
  });

  test("an unknown payment is a 404", async () => {
    assert.equal((await send(api.url, "/deposits/EVT-0004/payments/99")).status, 404);
  });
});

describe("the service", () => {
  test("GET /health names the service", async () => {
    assert.deepEqual((await send(api.url, "/health")).body, { status: "ok", service: "finance" });
  });

  test("a new app starts again from the seed data", async () => {
    const fresh = await start(createFinanceApp());
    try {
      assert.equal((await send(fresh.url, "/deposits/EVT-0004")).body.balancePhp, 320);
    } finally {
      await fresh.close();
    }
  });
});
