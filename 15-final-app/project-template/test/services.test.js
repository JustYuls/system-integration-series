// createResourceApp: the tiny factory behind the three placeholder services.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { start } from "../src/serve.js";
import { createResourceApp } from "../src/services/resource-app.js";
import { createCustomersApp } from "../src/services/customers.js";
import { call } from "./support.js";

describe("a service made by createResourceApp", () => {
  let service;
  const seed = [{ id: "1", name: "Pen", stock: 10, open: true }];
  before(async () => (service = await start(createResourceApp({ name: "things", resource: "things", fields: { name: "text", stock: "integer", open: "boolean" }, seed }))));
  after(() => service.close());

  test("GET /health names the service", async () => {
    assert.deepEqual((await call(service.url, "/health")).body, { status: "ok", service: "things" });
  });
  test("GET list and GET one", async () => {
    assert.equal((await call(service.url, "/things")).body.length, 1);
    assert.equal((await call(service.url, "/things/1")).body.name, "Pen");
  });
  test("an unknown id is a 404 in the JSON error format", async () => {
    const res = await call(service.url, "/things/99");
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });
  test("POST creates: 201, a Location header and a new id", async () => {
    const res = await call(service.url, "/things", { method: "POST", body: { name: "Ruler", stock: 3, open: false } });
    assert.equal(res.status, 201);
    assert.equal(res.body.id, "2");
    assert.equal(res.headers.get("location"), "/things/2");
    assert.equal(res.body.open, false); // false is a value, not a missing field
  });
  test("POST with a missing and an invalid field is a 400 that lists both", async () => {
    const res = await call(service.url, "/things", { method: "POST", body: { stock: -1, open: true } });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.missing, ["name"]);
    assert.deepEqual(res.body.error.invalid, ["stock"]);
  });
  test("PATCH changes a field; an unknown field or a bad value is a 400", async () => {
    assert.equal((await call(service.url, "/things/1", { method: "PATCH", body: { stock: 7 } })).body.stock, 7);
    assert.equal((await call(service.url, "/things/1", { method: "PATCH", body: { colour: "red" } })).status, 400);
    assert.equal((await call(service.url, "/things/1", { method: "PATCH", body: { stock: "many" } })).status, 400);
    assert.equal((await call(service.url, "/things/99", { method: "PATCH", body: { stock: 1 } })).status, 404);
  });
  test("a field with an unknown type is refused when the service is built", () => {
    assert.throws(() => createResourceApp({ name: "x", resource: "x", fields: { a: "colour" } }), /unknown type/);
  });
});

describe("the placeholder services", () => {
  test("customers has three seed records and validates e-mail addresses", async () => {
    const service = await start(createCustomersApp());
    try {
      assert.equal((await call(service.url, "/customers")).body.length, 3);
      const bad = await call(service.url, "/customers", { method: "POST", body: { name: "Dan", email: "not-an-email", active: true } });
      assert.deepEqual(bad.body.error.invalid, ["email"]);
    } finally {
      await service.close();
    }
  });
});
