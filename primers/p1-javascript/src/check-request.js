// Check one event request and return a list of problems (an empty list means the request is fine).
// A request looks like:
// { requestNo, title, date, venue, attendees, budget: { amount, currency }, outdoor, contactEmail }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// "2027-02-30" has the right shape but is not a real day, so we also build the date and compare.
export function isRealDate(text) {
  if (typeof text !== "string" || !ISO_DATE.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === text;
}

export function checkRequest(request) {
  if (request === null || typeof request !== "object") {
    return ["request: must be an object"];
  }
  const problems = [];

  if (typeof request.title !== "string" || request.title.trim() === "") {
    problems.push("title: required");
  }
  if (!isRealDate(request.date)) {
    problems.push("date: must be a real date like 2027-03-04");
  }
  if (!Number.isInteger(request.attendees) || request.attendees <= 0) {
    problems.push("attendees: must be a whole number above 0");
  }

  const budget = request.budget;
  if (budget === null || typeof budget !== "object") {
    problems.push("budget: required, like { amount: 500, currency: \"PHP\" }");
  } else {
    if (typeof budget.amount !== "number" || Number.isNaN(budget.amount) || budget.amount < 0) {
      problems.push("budget.amount: must be a number, 0 or more");
    }
    if (typeof budget.currency !== "string" || !/^[A-Z]{3}$/.test(budget.currency)) {
      problems.push("budget.currency: must be 3 capital letters, like PHP");
    }
  }

  if (typeof request.contactEmail !== "string" || !request.contactEmail.includes("@")) {
    problems.push("contactEmail: must contain @");
  }
  if (request.outdoor !== undefined && typeof request.outdoor !== "boolean") {
    problems.push("outdoor: must be true or false");
  }
  return problems;
}
