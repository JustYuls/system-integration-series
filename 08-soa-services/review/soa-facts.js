// Facts for the AI review: a service contract draft by an AI, and claims about SOA, checked against the catalog and the BPMN model.
import { loadModel, loadNotes } from "../src/document.js";
import { checkCatalog, checkContract, deriveServices, loadCatalog, serviceForTask, sharedData } from "../src/soa.js";

// The AI draft: Facilities exposes database fields, Weather returns the raw Open-Meteo JSON, Notification keeps a session.
export function draftCatalog() {
  const draft = structuredClone(loadCatalog());
  const service = (id) => draft.services.find((s) => s.id === id);
  service("facilities-service").operations[1].output = ["venue_row_id", "tbl_penalty", "available"];
  service("weather-service").operations[0].output = ["daily"];
  service("notification-service").operations[0].input.push("sessionId");
  return draft;
}

export function collect() {
  const model = loadModel();
  const notes = loadNotes();
  const catalog = loadCatalog();
  const draft = checkCatalog(draftCatalog());
  const has = (principle, service) => draft.some((v) => v.principle === principle && v.service === service);
  const serviceTasks = Object.entries(model.nodes).filter(([, n]) => n.type === "serviceTask" || n.type === "sendTask").map(([id]) => id);
  const count = (id) => serviceForTask(catalog, id).length;
  const servicesPerTask = Object.fromEntries(serviceTasks.map((id) => [id, count(id)]));
  const dataOwners = new Set(catalog.services.map((s) => s.dataOwner));
  return {
    realViolations: checkCatalog(catalog).length,
    draftViolations: draft.map((v) => `${v.service} ${v.principle}: ${v.message}`),
    exposesInternals: has("loose-coupling", "facilities-service"),
    returnsRaw: has("abstraction", "weather-service"),
    keepsSession: has("statelessness", "notification-service"),
    servicesPerTask,
    tasksWithTwoServices: Object.entries(servicesPerTask).filter(([, n]) => n > 1).map(([id]) => id),
    tasksWithNoService: Object.entries(servicesPerTask).filter(([, n]) => n === 0).map(([id]) => id),
    serviceCount: catalog.services.length,
    dataOwnerCount: dataOwners.size,
    sharedData: sharedData(catalog).length,
    derivedCount: deriveServices(model, notes).length,
    allPass: catalog.services.every((s) => checkContract(s).length === 0),
  };
}
