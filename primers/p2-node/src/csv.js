// A small CSV reader: text in, an array of objects out.
// The first line holds the column names. No quoted commas: this is a primer, not a full parser.
import { readFileSync } from "node:fs";

// Every cell is text. Turn "400" into 400 and "false" into false.
export function convert(text) {
  const value = text.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value !== "" && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((name) => name.trim());
  return lines.slice(1).map((line, i) => {
    const cells = line.split(",");
    if (cells.length !== header.length) {
      throw new Error(`line ${i + 2}: expected ${header.length} columns, found ${cells.length}`);
    }
    return Object.fromEntries(header.map((name, k) => [name, convert(cells[k])]));
  });
}

// Reads the whole file at once. readFileSync blocks until the file is read.
export function readCsv(file) {
  return parseCsv(readFileSync(file, "utf8"));
}
