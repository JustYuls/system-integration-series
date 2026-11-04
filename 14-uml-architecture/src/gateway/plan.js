// The BPMN process "Event request" as code. One call, planEvent, walks the process:
//   T02 holiday  T03 venue  T04 weather  T05 budget   (the four checks run at the same time)
//   G3 decide,  T06 approve or T08 return,  T07 notify through the queue.
// Rules BR-01 to BR-08 are in docs/process-notes.json. Every check says passed, failed or unknown.
import { TOPIC } from "../notifier.js";

export const RAIN_LIMIT_PERCENT = 60; // BR-02: an outdoor event needs a rain chance below this

const passed = (reasons, extra) => ({ status: "passed", reasons, ...extra });
const failed = (reasons, extra) => ({ status: "failed", reasons, ...extra });
const unknown = (reasons, extra) => ({ status: "unknown", reasons, ...extra });

const pesos = (n) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} pesos`;

// A check must never reject: a service that does not answer is "unknown", not a crash.
async function guard(what, run) {
  try {
    return await run();
  } catch (error) {
    return unknown([`We could not check ${what}, because a service did not answer.`], { detail: error.message });
  }
}

// T02, BR-01: the date is not a public holiday.
async function checkHoliday(request, { external }) {
  const day = await external.holiday(request.date);
  if (!day.available) {
    return unknown(["We could not check public holidays, because the holiday service did not answer."], { detail: day.reason });
  }
  if (day.isHoliday) return failed([`The date is a public holiday: ${day.name}.`], { holiday: day.name });
  return passed([`${request.date} is not a public holiday.`], { holiday: null });
}

// T03, BR-03 and BR-04: the venue is free, big enough, and has no unpaid penalty.
async function checkVenue(request, { clients }) {
  const { venue: name, date, attendees } = request;
  const found = await clients.availability({ venue: name, date, attendees });
  if (found === null) return failed([`We do not know a venue called ${name}.`]);

  const problems = [];
  if (!found.available) problems.push(`${name} is already reserved on ${date}.`); // BR-03
  if (!found.capacityOk) problems.push(`${name} is too small for ${attendees} people.`); // BR-03
  if (found.penaltyPhp > 0) problems.push(`${name} has an unpaid penalty of ${pesos(found.penaltyPhp)}, so it cannot be reserved.`); // BR-04
  const facts = { available: found.available, capacityOk: found.capacityOk, penaltyPhp: found.penaltyPhp };
  if (problems.length > 0) return failed(problems, facts);
  return passed([`${name} is free on ${date} and holds ${attendees} people.`], facts);
}

// T04, BR-02: only outdoor events need dry weather. Indoor events skip the check.
async function checkWeather(request, { external, today }) {
  if (!request.outdoor) return passed(["The event is indoors, so the weather does not matter."], { needed: false });
  const forecast = await external.forecast({ date: request.date, today });
  if (!forecast.available) {
    const tooFar = /beyond/.test(forecast.reason ?? "");
    const why = tooFar ? `there is no forecast for ${request.date} yet` : "the weather service did not answer";
    return unknown([`We could not check the weather, because ${why}.`], { needed: true, detail: forecast.reason });
  }
  const chance = forecast.rainChancePercent;
  if (chance >= RAIN_LIMIT_PERCENT) {
    return failed([`Rain is likely on ${request.date}: ${chance} percent chance (the limit is ${RAIN_LIMIT_PERCENT}).`], { needed: true, rainChancePercent: chance });
  }
  return passed([`Rain chance on ${request.date} is ${chance} percent, below the limit of ${RAIN_LIMIT_PERCENT}.`], { needed: true, rainChancePercent: chance });
}

// T05, BR-05 and BR-07: the deposit is paid, and the budget is known in pesos.
async function checkBudget(request, { clients, external }) {
  const [deposit, money] = await Promise.allSettled([clients.deposit(request.requestNo), external.convert(request.budget)]);
  const problems = [];
  const doubts = [];

  if (deposit.status === "rejected") doubts.push("We could not read the deposit, because the Finance system did not answer.");
  else if (deposit.value === null) problems.push("No deposit has been recorded for this request."); // BR-05
  else if (deposit.value.balancePhp > 0) problems.push(`The deposit is not fully paid: ${pesos(deposit.value.balancePhp)} are still due.`); // BR-05

  const converted = money.status === "fulfilled" && money.value.available ? money.value : null;
  if (!converted) doubts.push("We could not convert the budget to pesos, because the exchange rate service did not answer."); // BR-07

  const facts = { balancePhp: deposit.value?.balancePhp ?? null, amountPhp: converted?.amountPhp ?? null, rate: converted?.rate ?? null };
  if (problems.length > 0) return failed([...problems, ...doubts], facts);
  if (doubts.length > 0) return unknown(doubts, facts);
  const { amount, currency } = request.budget;
  const how = currency === "PHP" ? "" : ` (${amount} ${currency} at ${converted.rate})`;
  return passed([`The deposit is paid and the budget is ${pesos(converted.amountPhp)}${how}.`], facts);
}

// G3, BR-08: approved only when every check passed; a failed check returns the request;
// a check that could not run (unknown) asks a person to look, unless another check already failed (FR-12).
export function decide(checks) {
  const all = Object.values(checks);
  if (all.some((c) => c.status === "failed")) return "returned";
  if (all.some((c) => c.status === "unknown")) return "needs-review";
  return "approved";
}

// The sentences for the organizer: first what failed, then what could not be checked.
export function collectReasons(checks) {
  const all = Object.values(checks);
  const of = (status) => all.filter((c) => c.status === status).flatMap((c) => c.reasons);
  const reasons = [...of("failed"), ...of("unknown")];
  return reasons.length > 0 ? reasons : ["All four checks passed."];
}

export async function planEvent(requestNo, { clients, external, queue, today }) {
  const request = await clients.getRequest(requestNo); // a 404 throws a ClientError

  const context = { clients, external, today };
  const [holiday, venue, weather, budget] = await Promise.all([
    guard("public holidays", () => checkHoliday(request, context)),
    guard("the venue", () => checkVenue(request, context)),
    guard("the weather", () => checkWeather(request, context)),
    guard("the budget", () => checkBudget(request, context)),
  ]);
  const checks = { holiday, venue, weather, budget };

  const decision = decide(checks); // G3
  const reasons = collectReasons(checks);

  const setStatus = async (value) => (await clients.setStatus(requestNo, value)).status;
  let status = request.status; // needs-review: an officer decides, so the status stays
  if (decision === "approved") status = await setStatus("Approved"); // T06
  if (decision === "returned") status = await setStatus("Returned"); // T08

  queue.publish(TOPIC, { requestNo, decision, reasons, contactEmail: request.contactEmail }); // T07
  return { requestNo, decision, checks, reasons, status };
}
