// Check a new event request. Returns a list of problems (empty list = the request is good).
export function validateRequest(body, venues) {
  const problems = [];
  const input = body ?? {};

  if (typeof input.title !== "string" || input.title.trim() === "") {
    problems.push("title is required");
  }

  if (!isRealDate(input.date)) {
    problems.push("date must be a real date like 2027-03-04");
  }

  const venue = venues.find((v) => v.id === input.venue);
  if (!venue) {
    problems.push("venue must be one of: " + venues.map((v) => v.id).join(", "));
  }

  if (!Number.isInteger(input.attendees) || input.attendees < 1) {
    problems.push("attendees must be a whole number of 1 or more");
  } else if (venue && input.attendees > venue.capacity) {
    problems.push(`attendees (${input.attendees}) is more than the capacity of ${venue.name} (${venue.capacity})`);
  }

  return problems;
}

// "2027-03-04" is real, "2027-02-30" is not.
export function isRealDate(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(text + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}
