// Writing and reading JSON files with fs/promises (non-blocking) and path (works on every OS).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Writes data as pretty JSON to dir/name (".json" is added when missing). Returns the full path.
export async function writeReport(dir, name, data) {
  const fileName = path.extname(name) === ".json" ? name : `${name}.json`;
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, fileName);
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  return file;
}

export async function readReport(file) {
  return JSON.parse(await readFile(file, "utf8"));
}
