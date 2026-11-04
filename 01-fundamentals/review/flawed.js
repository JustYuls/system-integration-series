// An AI-style first draft of "combine Student Affairs and Facilities". It joins on the event title. Never use it.
export function naiveJoinByTitle(studentAffairs, facilities) {
  const merged = new Map();
  for (const row of studentAffairs) merged.set(row.title.toLowerCase(), { ...row });
  for (const row of facilities) {
    merged.set(row.title.toLowerCase(), { ...merged.get(row.title.toLowerCase()), ...row }); // BUG: two events can share a title
  }
  return [...merged.values()];
}
