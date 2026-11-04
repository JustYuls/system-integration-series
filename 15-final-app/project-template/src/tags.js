// Find the requirement tags in the NAMES of the tests, such as [FR-03] or [NFR-02].
// Pure code: it reads text and files, nothing else. The project template keeps an identical copy of this file.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const TAG = /\[((?:N?FR)-\d{2})\]/g;
// test("name", ...) or it('name', ...) or test(`name ${x}`, ...): the first argument is the name.
const TEST_CALL = /\b(?:test|it)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;

// Every test of one source text: { name, tags }. A test with no tag has an empty list.
export function testsIn(source) {
  const found = [];
  for (const m of source.matchAll(TEST_CALL)) {
    const tags = [...new Set([...m[2].matchAll(TAG)].map((t) => t[1]))];
    found.push({ name: m[2], tags });
  }
  return found;
}

// Every test of the folder's test/*.test.js files: { file, name, tags }.
export function scanTests(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".test.js")).sort();
  return files.flatMap((file) => testsIn(readFileSync(path.join(dir, file), "utf8")).map((t) => ({ file, ...t })));
}

// One row per requirement id: how many tests carry its tag, and in which files.
// `isNew(file)` says which files hold the tests added at the end (behaviour tests of the whole application).
export function coverageRows(ids, tests, isNew = () => false) {
  return ids.map((id) => {
    const mine = tests.filter((t) => t.tags.includes(id));
    const newOnes = mine.filter((t) => isNew(t.file));
    return { id, total: mine.length, newTests: newOnes.length, earlier: mine.length - newOnes.length, files: [...new Set(mine.map((t) => t.file))] };
  });
}

// Tags that name no requirement (a typo such as FR-13 when there are 12).
export function unknownTags(tests, ids) {
  const known = new Set(ids);
  return [...new Set(tests.flatMap((t) => t.tags).filter((tag) => !known.has(tag)))].sort();
}

export const countTests = (tests) => ({ total: tests.length, tagged: tests.filter((t) => t.tags.length > 0).length });
