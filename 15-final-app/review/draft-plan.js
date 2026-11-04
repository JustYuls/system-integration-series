// The planner as an AI assistant drafted it. It looks fine and it runs, but it has flaws:
//   1. the checks run one after another,   2. a check that did not answer counts as "ok".
export async function draftPlan(requestNo, { clients, external, today }) {
  const request = await clients.getRequest(requestNo);
  const holiday = await external.holiday(request.date);
  const venue = await clients.availability({ venue: request.venue, date: request.date, attendees: request.attendees });
  const weather = request.outdoor ? await external.forecast({ date: request.date, today }) : null;
  const deposit = await clients.deposit(requestNo);
  const budget = await external.convert(request.budget);

  const problems = [];
  if (holiday.isHoliday) problems.push(`holiday: ${holiday.name}`);
  if (!venue.available || !venue.capacityOk) problems.push("venue");
  if (weather && weather.rainChancePercent >= 60) problems.push("rain");
  if (deposit && deposit.balancePhp > 0) problems.push("deposit");
  void budget;
  return { requestNo, decision: problems.length > 0 ? "returned" : "approved", problems };
}
