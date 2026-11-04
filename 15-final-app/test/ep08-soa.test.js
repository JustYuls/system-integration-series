import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadModel, loadNotes } from "../src/document.js";
import { catalogProblems, checkCatalog, checkContract, deriveServices, loadCatalog, principles, serviceForTask, sharedData } from "../src/soa.js";

const model = loadModel();
const notes = loadNotes();
const catalog = loadCatalog();
const service = (id) => structuredClone(catalog.services.find((s) => s.id === id));
const violations = (s) => checkContract(s).map((v) => `${v.principle}: ${v.message}`);

describe("finding the services in the process", () => {
  test("the systems of the notes give seven services, and the web page is not one", () => {
    const systems = deriveServices(model, notes).map((d) => d.system);
    assert.deepEqual(systems, ["Holiday service", "Facilities system", "Weather service", "Finance system", "Frankfurter", "Student Affairs system", "Notification service"]);
    assert.ok(!systems.includes("Planner web page"));
  });
  test("the deposit task needs two services: Finance and the Frankfurter wrapper", () => {
    assert.deepEqual(serviceForTask(catalog, "T05").map((s) => s.id), ["finance-service", "currency-service"]);
  });
  test("the other service tasks need one service each", () => {
    for (const id of ["T02", "T03", "T04", "T07"]) assert.equal(serviceForTask(catalog, id).length, 1, id);
  });
  test("the catalog matches the process", () => assert.deepEqual(catalogProblems(model, notes, catalog), []));
  test("a missing service is found", () => {
    const small = structuredClone(catalog);
    small.services = small.services.filter((s) => s.id !== "weather-service");
    assert.deepEqual(catalogProblems(model, notes, small), ["Weather service (T04) has no service in the catalog"]);
  });
  test("a service for a task that does not exist is found", () => {
    const wrong = structuredClone(catalog);
    wrong.services[0].tasks.push("T99");
    assert.ok(catalogProblems(model, notes, wrong).some((p) => p.includes("T99")));
  });
});

describe("the principles", () => {
  test("seven principles, each with a one-line definition", () => {
    assert.equal(principles.length, 7);
    for (const p of principles) assert.ok(p.definition.length > 20 && p.definition.length < 140, p.id);
  });
  test("every service of the catalog has a good contract", () => assert.deepEqual(checkCatalog(catalog), []));
  test("loose coupling: a database field in the output is found", () => {
    const s = service("facilities-service");
    s.operations[0].output.push("venue_row_id");
    assert.deepEqual(violations(s), ['loose-coupling: exposes the internal field "venue_row_id"']);
  });
  test("abstraction: the raw answer of another system is found", () => {
    const s = service("weather-service");
    s.operations[0].output = ["daily"];
    assert.deepEqual(violations(s), ['abstraction: returns "daily", the raw answer of another system']);
  });
  test("statelessness: a session input is found", () => {
    const s = service("notification-service");
    s.operations[0].input.push("sessionId");
    assert.deepEqual(violations(s), ['statelessness: needs "sessionId", which means the service keeps state between calls']);
  });
  test("reusability: an operation named after the process is found", () => {
    const s = service("weather-service");
    s.operations[0].name = "checkEventWeather";
    assert.deepEqual(violations(s), ["reusability: the name ties the operation to one process"]);
  });
  test("discoverability: a missing owner and an operation without errors are found", () => {
    const s = service("finance-service");
    s.owner = "";
    s.operations[0].errors = [];
    assert.deepEqual(violations(s), ["discoverability: the service has no owner", "discoverability: has no errors in the contract"]);
  });
  test("composability: another protocol is found", () => {
    const s = service("holiday-service");
    s.protocol = "SOAP";
    assert.deepEqual(violations(s), ['composability: the protocol is "SOAP", not the shared REST/JSON']);
  });
  test("autonomy: a service needs an owner of its data, and no two share one", () => {
    const s = service("holiday-service");
    s.dataOwner = "";
    assert.deepEqual(violations(s), ["autonomy: the service names no owner of its data"]);
    assert.deepEqual(sharedData(catalog), []);
    const shared = structuredClone(catalog);
    shared.services[1].dataOwner = shared.services[0].dataOwner;
    assert.equal(sharedData(shared).length, 1);
  });
});

describe("the catalog", () => {
  test("seven services, each with its own data owner", () => {
    assert.equal(catalog.services.length, 7);
    assert.equal(new Set(catalog.services.map((s) => s.dataOwner)).size, 7);
  });
  test("the two wrappers name the outside API, the others do not", () => {
    const apis = catalog.services.filter((s) => s.externalApi).map((s) => [s.id, s.externalApi]);
    assert.deepEqual(apis, [["holiday-service", "Nager.Date"], ["weather-service", "Open-Meteo"], ["currency-service", "Frankfurter"]]);
  });
  test("the weather contract matches the service the code returns", () => {
    const op = service("weather-service").operations[0];
    assert.equal(op.name, "getForecast");
    assert.deepEqual(op.output, ["available", "date", "rainChancePercent", "maxTempC", "source", "reason"]);
    assert.deepEqual(op.errors, ["BAD_INPUT", "UPSTREAM"]);
  });
  test("every service speaks REST/JSON and has an SLA hint", () => {
    for (const s of catalog.services) assert.ok(s.protocol === "REST/JSON" && s.sla.length > 10, s.id);
  });
});
