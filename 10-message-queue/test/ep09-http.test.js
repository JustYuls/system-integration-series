import assert from "node:assert/strict";
import { describe, test } from "node:test";
import express from "express";
import { checkFields, createJsonApp, finishApp, sendError } from "../src/http.js";
import { PORTS } from "../src/ports.js";
import { send, start } from "../src/serve.js";
import { createFacilitiesApp } from "../src/services/facilities.js";
import { createFinanceApp } from "../src/services/finance.js";
import { createStudentAffairsApp } from "../src/services/student-affairs.js";
import { isIsoDate, isMoney, isPesos } from "../src/validate.js";

describe("the shared HTTP helpers", () => {
  test("every service answers GET /health with its name", async () => {
    const names = [];
    for (const make of [createStudentAffairsApp, createFinanceApp, createFacilitiesApp]) {
      const api = await start(make());
      names.push((await send(api.url, "/health")).body);
      await api.close();
    }
    assert.deepEqual(names, [{ status: "ok", service: "student-affairs" }, { status: "ok", service: "finance" }, { status: "ok", service: "facilities" }]);
  });

  test("an unknown route is a 404 in the error format, not an HTML page", async () => {
    const api = await start(createStudentAffairsApp());
    const res = await send(api.url, "/orders/7");
    await api.close();
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: { code: "NOT_FOUND", message: "No route for GET /orders/7" } });
  });

  test("a method that the route does not have is also a 404", async () => {
    const api = await start(createFinanceApp());
    const res = await send(api.url, "/deposits/EVT-0004", { method: "DELETE" });
    await api.close();
    assert.equal(res.status, 404);
  });

  test("an error inside a route is a 500 without the stack, even in an async route", async () => {
    const logged = [];
    const app = createJsonApp("broken");
    app.get("/boom", async () => {
      throw new Error("secret detail: /home/admin/db.js line 7");
    });
    const api = await start(finishApp(app, (line) => logged.push(line)));
    const res = await send(api.url, "/boom");
    await api.close();
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: { code: "INTERNAL_ERROR", message: "Something went wrong on the server" } });
    assert.ok(logged[0].includes("secret detail"), "the detail goes to the log, not to the client");
  });

  test("sendError builds the standard error body", async () => {
    const app = express();
    app.get("/x", (req, res) => sendError(res, 409, "CLASH", "Taken", { hint: "try another date" }));
    const api = await start(app);
    const res = await send(api.url, "/x");
    await api.close();
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: { code: "CLASH", message: "Taken", hint: "try another date" } });
  });

  test("checkFields lists what is missing and what is invalid, in the order of the rules", () => {
    const rules = { a: (v) => v > 0, b: (v) => v > 0, c: (v) => v > 0 };
    assert.deepEqual(checkFields({ a: 1, b: -1 }, rules), { missing: ["c"], invalid: ["b"] });
    assert.deepEqual(checkFields({ a: "", b: null }, rules), { missing: ["a", "b", "c"], invalid: [] });
  });
});

describe("the ports and the validators", () => {
  test("each service has its own port, and the gateway has 4000", () => {
    assert.deepEqual(PORTS, { gateway: 4000, studentAffairs: 4001, finance: 4002, facilities: 4003 });
  });

  test("dates are ISO 8601 text", () => {
    assert.ok(isIsoDate("2027-03-04"));
    assert.ok(!isIsoDate("2027-02-30"));
    assert.ok(!isIsoDate("03/04/2027"));
    assert.ok(!isIsoDate(20270304));
  });

  test("money is an amount and a currency; pesos have at most two decimals", () => {
    assert.ok(isMoney({ amount: 500, currency: "USD" }));
    assert.ok(!isMoney({ amount: 500 }));
    assert.ok(!isMoney({ amount: "500", currency: "USD" }));
    assert.ok(isPesos(1500.5));
    assert.ok(!isPesos(0.001));
    assert.ok(!isPesos(0));
  });
});
