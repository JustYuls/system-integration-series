import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { PORTS } from "../src/ports.js";
import { send, start } from "../src/serve.js";
import { createFacilitiesApp } from "../src/services/facilities.js";
import { createFinanceApp } from "../src/services/finance.js";
import { createStudentAffairsApp } from "../src/services/student-affairs.js";

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const openapi = read("docs/openapi-services.json");
const collection = read("postman/campus-event-planner.postman_collection.json");
const quiet = { log: () => {} };
const factories = { [PORTS.studentAffairs]: createStudentAffairsApp, [PORTS.finance]: createFinanceApp, [PORTS.facilities]: createFacilitiesApp };
const portOf = (url) => Number(new URL(url).port);

// The operations of the contract: every path and method, with the example values written in the file.
const operations = Object.entries(openapi.paths).flatMap(([path, item]) =>
  Object.entries(item).filter(([key]) => ["get", "post", "put", "patch", "delete"].includes(key)).map(([method, op]) => ({ path, method: method.toUpperCase(), op, servers: item.servers })));

function exampleRequest({ path, op }) {
  const params = op.parameters ?? [];
  let url = path;
  for (const p of params.filter((p) => p.in === "path")) url = url.replace(`{${p.name}}`, p.example);
  const query = params.filter((p) => p.in === "query").map((p) => `${p.name}=${encodeURIComponent(p.example)}`);
  const body = op.requestBody?.content["application/json"].example;
  return { url: query.length ? `${url}?${query.join("&")}` : url, body };
}

describe("the OpenAPI file is a contract the services keep", () => {
  test("it is OpenAPI 3 and documents the three services on their ports", () => {
    assert.ok(openapi.openapi.startsWith("3.0"));
    assert.deepEqual(openapi.servers.map((s) => portOf(s.url)), [PORTS.studentAffairs, PORTS.finance, PORTS.facilities]);
  });

  test("it documents 16 operations and every one has a summary and an id", () => {
    assert.equal(operations.length, 16);
    assert.equal(new Set(operations.map((o) => o.op.operationId)).size, 16);
    assert.ok(operations.every((o) => o.op.summary));
  });

  test("every create documents 201, 400 and a Location header", () => {
    const creates = operations.filter((o) => o.method === "POST");
    assert.equal(creates.length, 3);
    for (const { op } of creates) {
      assert.ok(op.responses["201"].headers.Location, op.operationId);
      assert.ok(op.responses["400"], op.operationId);
    }
  });

  test("every operation with an id in its path documents 404", () => {
    for (const { path, op } of operations.filter((o) => o.path.includes("{"))) assert.ok(op.responses["404"], `${path} ${op.operationId}`);
  });

  test("every operation answers with a status that the file lists, when called with its examples", async () => {
    for (const operation of operations) {
      for (const server of operation.servers ?? openapi.servers) {
        const api = await start(factories[portOf(server.url)](undefined, quiet));
        try {
          const { url, body } = exampleRequest(operation);
          const res = await send(api.url, url, { method: operation.method, body });
          assert.ok(operation.op.responses[String(res.status)], `${operation.method} ${url} answered ${res.status}`);
        } finally {
          await api.close();
        }
      }
    }
  });

  test("the documented example of each error is in the error format", () => {
    for (const { op } of operations) {
      for (const [status, response] of Object.entries(op.responses).filter(([s]) => Number(s) >= 400)) {
        const example = response.content["application/json"].example;
        assert.ok(example.error.code && example.error.message, `${op.operationId} ${status}`);
      }
    }
  });
});

describe("the Postman collection (also imported by Thunder Client)", () => {
  const requests = collection.item.flatMap((folder) => folder.item.map((item) => ({ folder: folder.name, ...item })));

  test("it has one folder for each service and the variable baseUrl", () => {
    assert.deepEqual(collection.item.map((f) => f.name), ["Student Affairs (4001)", "Finance (4002)", "Facilities (4003)"]);
    assert.equal(collection.variable[0].key, "baseUrl");
    assert.ok(collection.info.schema.includes("v2.1.0"));
  });

  test("every request uses {{baseUrl}} and a port of one of the services", () => {
    for (const item of requests) assert.match(item.request.url.raw, /^\{\{baseUrl\}\}:400[123]\//, item.name);
  });

  test("every request in the collection is documented in the OpenAPI file", () => {
    const documented = new Set(operations.map((o) => `${o.method} ${o.path.replace(/\{[^}]+\}/g, "*")}`));
    for (const item of requests) {
      const path = "/" + item.request.url.path.join("/");
      const generic = path.replace(/^\/(requests|deposits|reservations|venues)\/[^/]+/, "/$1/*").replace(/payments\/[^/]+$/, "payments/*");
      assert.ok(documented.has(`${item.request.method} ${generic}`), `${item.request.method} ${path}`);
    }
  });

  test("run in order, every request gets the status that its test expects", async () => {
    const apis = {
      [PORTS.studentAffairs]: await start(createStudentAffairsApp(undefined, quiet)),
      [PORTS.finance]: await start(createFinanceApp(undefined, quiet)),
      [PORTS.facilities]: await start(createFacilitiesApp(undefined, quiet)),
    };
    try {
      for (const item of requests) {
        const { url, method } = item.request;
        const expected = Number(item.event[0].script.exec[0].match(/status\((\d+)\)/)[1]);
        const raw = item.request.body?.raw;
        const res = await send(apis[url.port].url, "/" + url.path.join("/") + (url.query ? "?" + url.query.map((q) => `${q.key}=${encodeURIComponent(q.value)}`).join("&") : ""), { method, body: raw });
        assert.equal(res.status, expected, item.name);
      }
    } finally {
      for (const api of Object.values(apis)) await api.close();
    }
  });
});
