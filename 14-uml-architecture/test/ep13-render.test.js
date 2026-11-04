import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { decisionClass, decisionLabel, escapeHtml, renderChecks, statusLabel } from "../web/render.js";

const web = (name) => readFileSync(fileURLToPath(new URL(`../web/${name}`, import.meta.url)), "utf8");

describe("escapeHtml", () => {
  test("it replaces the five characters that HTML treats in a special way", () => {
    assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`), "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  });
  test("an XSS payload keeps no tag", () => {
    const safe = escapeHtml("<img src=x onerror=alert(1)>");
    assert.ok(!safe.includes("<") && !safe.includes(">"));
    assert.equal(safe, "&lt;img src=x onerror=alert(1)&gt;");
  });
  test("the & is escaped once: it is replaced first, so the entities of the others stay", () => {
    assert.equal(escapeHtml("Tom & Jerry"), "Tom &amp; Jerry");
    assert.equal(escapeHtml("&lt;"), "&amp;lt;");
  });
  test("numbers become text, and null or undefined become an empty text", () => {
    assert.equal(escapeHtml(42), "42");
    assert.equal(escapeHtml(null), "");
    assert.equal(escapeHtml(undefined), "");
  });
});

describe("decisionLabel and decisionClass", () => {
  test("the three decisions have a label for the organizer", () => {
    assert.equal(decisionLabel("approved"), "Approved");
    assert.equal(decisionLabel("returned"), "Returned to the organizer");
    assert.equal(decisionLabel("needs-review"), "Needs a manual review");
  });
  test("an unknown decision is not shown as one of the three", () => {
    assert.equal(decisionLabel("maybe"), "Not decided");
    assert.equal(decisionLabel(undefined), "Not decided");
  });
  test("the class comes from a fixed list: data cannot inject a class", () => {
    assert.equal(decisionClass("approved"), "approved");
    assert.equal(decisionClass("needs-review"), "needs-review");
    assert.equal(decisionClass('x" onclick="alert(1)'), "none");
  });
});

describe("renderChecks", () => {
  const checks = {
    holiday: { status: "failed", reasons: ["The date is a public holiday: Christmas Day."] },
    venue: { status: "passed", reasons: ["Gym is free."] },
    weather: { status: "passed", needed: false, reasons: ["The event is indoors."] },
    budget: { status: "unknown", reasons: ["We could not convert the budget."] },
  };
  test("it makes one list item for each check, in the order of the process", () => {
    const html = renderChecks(checks);
    assert.equal(html.match(/<li /g).length, 4);
    const names = [...html.matchAll(/class="check-name">([^<]+)</g)].map((m) => m[1]);
    assert.deepEqual(names, ["Public holiday", "Venue", "Weather", "Budget and deposit"]);
  });
  test("each item has a class for its status and a word, so color is not the only signal", () => {
    const html = renderChecks(checks);
    assert.match(html, /class="check failed"[^>]*><span class="check-name">Public holiday<\/span><span class="badge">Failed</);
    assert.match(html, /class="check unknown"[^>]*>.*Could not check/);
  });
  test("the weather of an indoor event says Not needed", () => {
    assert.equal(statusLabel({ status: "passed", needed: false }), "Not needed");
    assert.match(renderChecks(checks), /Not needed/);
  });
  test("reasons with markup are escaped", () => {
    const html = renderChecks({ venue: { status: "failed", reasons: ["<script>alert(1)</script>"] } });
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  });
  test("a status that is not one of the three cannot inject a class", () => {
    const html = renderChecks({ venue: { status: 'x" onmouseover="alert(1)', reasons: [] } });
    assert.match(html, /class="check unknown"/);
    assert.ok(!html.includes("onmouseover"));
  });
  test("a check that is missing is left out, and no checks give an empty text", () => {
    assert.equal(renderChecks({}), "");
    assert.equal(renderChecks({ venue: checks.venue }).match(/<li /g).length, 1);
  });
});

describe("the web page files", () => {
  const html = web("index.html");
  test("[NFR-06] the page declares its language and the viewport, for screen readers and phones", () => {
    assert.match(html, /<html lang="en">/);
    assert.match(html, /name="viewport"/);
  });
  test("every field of the form has a label that points to it", () => {
    const ids = [...html.matchAll(/<(?:input|select)[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(ids.length >= 9);
    for (const id of ids) assert.ok(html.includes(`for="${id}"`), `no label for ${id}`);
  });
  test("the page loads app.js as a module and styles.css", () => {
    assert.match(html, /<script type="module" src="app\.js">/);
    assert.match(html, /href="styles\.css"/);
  });
  test("the decision card is announced to screen readers when it appears", () => {
    assert.match(html, /id="decision"[^>]*aria-live="polite"/);
  });
  test("the CSS has a visible focus, a grid and a rule for narrow screens", () => {
    const css = web("styles.css");
    assert.match(css, /:focus-visible/);
    assert.match(css, /display: grid/);
    assert.match(css, /@media \(max-width/);
    for (const decision of ["approved", "returned", "needs-review"]) assert.ok(css.includes(`.decision.${decision}`), decision);
  });
  test("app.js uses innerHTML only for renderChecks, and never document.write or eval", () => {
    const app = web("app.js");
    const uses = app.split("\n").filter((line) => line.includes("innerHTML") && !line.trimStart().startsWith("//"));
    assert.equal(uses.length, 1);
    assert.match(uses[0], /renderChecks\(/);
    assert.doesNotMatch(app, /document\.write|\beval\(/);
  });
  test("app.js puts the title and the reasons in with textContent", () => {
    const app = web("app.js");
    assert.match(app, /item\.textContent = text/);
    assert.match(app, /\$\("decision-request"\)\.textContent/);
  });
  test("render.js has no document or window, so Node can import it", () => {
    assert.doesNotMatch(web("render.js"), /\b(document|window)\./);
  });
});
