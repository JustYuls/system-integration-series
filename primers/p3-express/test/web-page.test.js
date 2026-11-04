import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withApp } from "./helpers.js";
import { escapeHtml } from "../src/escape.js";
import { validateRequest, isRealDate } from "../src/validate.js";

const read = (name) => readFileSync(new URL("../public/" + name, import.meta.url), "utf-8");

test("the server serves the page at / (express.static)", () =>
  withApp({}, async (call) => {
    const r = await call("GET", "/");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /text\/html/);
    assert.match(r.text, /<h1>Campus Event Planner<\/h1>/);
  }));

test("the server serves the CSS and the browser script", () =>
  withApp({}, async (call) => {
    assert.match((await call("GET", "/styles.css")).headers.get("content-type"), /text\/css/);
    assert.match((await call("GET", "/app.js")).headers.get("content-type"), /javascript/);
  }));

test("the page uses semantic elements: header, main, table, form", () => {
  const html = read("index.html");
  for (const tag of ["<header>", "<main>", "<table>", "<form", "<footer>"]) assert.ok(html.includes(tag), tag);
  assert.match(html, /<html lang="en">/);
});

test("every form field has a label", () => {
  const html = read("index.html");
  for (const id of ["title", "date", "venue", "attendees"]) assert.ok(html.includes(`for="${id}"`), id);
});

test("the CSS has variables, flexbox, grid, a focus state and a media query", () => {
  const css = read("styles.css");
  for (const part of [":root", "var(--", "display: flex", "display: grid", ":focus-visible", "@media"]) {
    assert.ok(css.includes(part), part);
  }
});

test("the browser script uses textContent and never innerHTML", () => {
  const js = read("app.js");
  assert.ok(js.includes("textContent"));
  assert.ok(!js.includes("innerHTML"));
  assert.ok(js.includes("fetch("));
});

test("escapeHtml turns a tag into harmless text", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(escapeHtml("Tom & Jerry's"), "Tom &amp; Jerry&#39;s");
});

test("isRealDate accepts real dates and rejects the rest", () => {
  assert.equal(isRealDate("2027-03-04"), true);
  assert.equal(isRealDate("2027-02-30"), false);
  assert.equal(isRealDate("03/04/2027"), false);
  assert.equal(isRealDate(20270304), false);
});

test("validateRequest returns an empty list for a good request", () => {
  const venues = [{ id: "gym", name: "Gym", capacity: 400 }];
  assert.deepEqual(validateRequest({ title: "A", date: "2027-03-04", venue: "gym", attendees: 10 }, venues), []);
  assert.equal(validateRequest(undefined, venues).length, 4);
});
