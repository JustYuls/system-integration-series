// The diagrams as an AI assistant drafted them: close to the real ones, with three mistakes.
//   1. the sequence diagram skips the queue and the notifier (task T07 is missing)
//   2. the component diagram has an arrow from the page straight to Open-Meteo
//   3. the state diagram has a state nobody can leave (On hold has no arrow out)
import { buildDiagrams } from "../src/diagrams.js";

export function draftDiagrams() {
  const real = buildDiagrams();
  const skipQueue = /^\s*participant (Q|N)\b|GW->>Q:|Q->>N:/;
  return {
    ...real,
    sequence: real.sequence.split("\n").filter((line) => !skipQueue.test(line)).join("\n"),
    component: `${real.component}\n  page --> api_open_meteo`,
    state: real.state.split("\n").filter((line) => !/^\s*Onhold -->/.test(line)).join("\n"),
  };
}
