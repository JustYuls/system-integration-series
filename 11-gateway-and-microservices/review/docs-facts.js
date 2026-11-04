// Facts for the AI review: process documentation drafted by an AI, checked against the BPMN model and the notes.
import { gaps, loadModel, loadNotes, taskOrder } from "../src/document.js";

// The AI draft: the weather check is given to the officer, the finance task lost its exceptions, and the currency rule is not used.
export function draftNotes() {
  const notes = structuredClone(loadNotes());
  notes.tasks.T04.actor = "Student Affairs Officer";
  notes.tasks.T05.exceptions = [];
  notes.tasks.T05.rules = ["BR-05"];
  return notes;
}

export function collect() {
  const model = loadModel();
  const notes = loadNotes();
  const found = gaps(model, draftNotes());
  const services = Object.entries(notes.tasks).filter(([id]) => model.nodes[id].type === "serviceTask");
  return {
    realGaps: gaps(model, notes).length,
    draftGaps: found.map((g) => `${g.task} ${g.gap}`),
    actorMismatch: found.some((g) => g.task === "T04" && g.gap.includes("lane")),
    noExceptions: found.some((g) => g.task === "T05" && g.gap.includes("exception")),
    unusedRule: found.some((g) => g.task === "BR-07"),
    parallelChecks: model.nodes.G1.outgoing.length,
    br02IsOutdoorOnly: /outdoor/i.test(notes.rules["BR-02"]),
    servicesWithOutsideApi: services.filter(([, n]) => n.externalApi).length,
    serviceTasks: services.length,
    taskCount: taskOrder(model).length,
  };
}
