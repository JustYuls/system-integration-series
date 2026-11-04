import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { chosenStrategy, DOC_FILE, loadKinds, QUALITY_RESPONSES, renderArchitecture } from "../src/architecture-doc.js";
import { loadNfr } from "../src/nfr.js";
import { buildDiagrams } from "../src/diagrams.js";

const doc = renderArchitecture();

describe("docs/architecture.md", () => {
  test("the file on disk is what the generator writes now (the diagrams did not drift)", () => {
    assert.equal(readFileSync(DOC_FILE, "utf8"), doc);
  });
  test("it holds the four diagrams in mermaid fences", () => {
    assert.equal((doc.match(/^```mermaid$/gm) ?? []).length, 4);
    for (const text of Object.values(buildDiagrams())) assert.ok(doc.includes(text));
  });
  test("it has the sections: purpose, context, views, components, decisions, qualities, viewing", () => {
    for (const h of ["## 1. Purpose", "## 2. Context", "## 3. Views", "## 4. Components", "## 5. Decisions", "## 6. Quality attributes", "## 7. How to view the diagrams"]) assert.ok(doc.includes(h), h);
  });
  test("the components table has a row for every service and a port", () => {
    assert.ok(doc.includes("| Student Affairs service |"));
    assert.ok(doc.includes("port 4001"));
    assert.ok(doc.includes("| Nager.Date |"));
  });
  test("it says how to view the diagrams", () => {
    for (const word of ["GitHub", "Visual Studio Code", "mermaid.live"]) assert.ok(doc.includes(word), word);
  });
});

describe("decisions", () => {
  test("the chosen strategy of episode 6 is quoted", () => {
    const s = chosenStrategy();
    assert.ok(s);
    assert.ok(doc.includes(s.name));
    assert.ok(doc.includes(`${s.total} of ${s.max} points`));
  });
  test("a missing strategy file is handled without a crash", () => {
    assert.equal(chosenStrategy("no-such-file.json"), null);
    assert.ok(renderArchitecture({ strategy: null }).includes("was not found"));
  });
});

describe("quality attributes", () => {
  test("[NFR-01] every NFR is in the table with its id", () => {
    for (const n of loadNfr()) assert.ok(doc.includes(`| ${n.id} |`), n.id);
  });
  test("every NFR category has an architecture answer", () => {
    for (const n of loadNfr()) assert.ok(QUALITY_RESPONSES[n.category], n.category);
  });
  test("[NFR-02] the availability answer names needs-review", () => assert.ok(QUALITY_RESPONSES.availability.includes("needs-review")));
});

describe("the UML kinds table", () => {
  const kinds = loadKinds();
  test("it has seven kinds, each with a question and a use in the project", () => {
    assert.equal(kinds.length, 7);
    for (const k of kinds) assert.ok(k.question && k.useInProject && ["structure", "behavior"].includes(k.view), k.id);
  });
  test("each generated diagram has a kind, and no kind claims a diagram that does not exist", () => {
    const generated = kinds.map((k) => k.generated).filter(Boolean).sort();
    assert.deepEqual(generated, Object.keys(buildDiagrams()).sort());
  });
});
