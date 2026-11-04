// The planner skeleton: the business process of YOUR project as code.
// The rules are a small TABLE. One row = one check = one task of your BPMN diagram. To change the process,
// change the table (add a row, rename a row, change what `run` asks); the rest of this file stays.
import { TOPIC } from "../notifier.js";

const passed = (reason, extra) => ({ status: "passed", reasons: [reason], ...extra });
const failed = (reason, extra) => ({ status: "failed", reasons: [reason], ...extra });
const unknown = (reason, extra) => ({ status: "unknown", reasons: [reason], ...extra }); // a service did not answer

// request: { customerId, itemId, quantity, date }.  context: { clients, external }.
export const RULES = [
  {
    id: "BR-01", name: "date", task: "T02", // an outside API: Nager.Date
    async run(request, { external }) {
      const day = await external.holiday(request.date);
      if (!day.available) return unknown("We could not check public holidays, because the holiday service did not answer.");
      return day.isHoliday ? failed(`The date is a public holiday: ${day.name}.`) : passed(`${request.date} is not a public holiday.`);
    },
  },
  {
    id: "BR-02", name: "customer", task: "T03", // placeholder service 1
    async run(request, { clients }) {
      const customer = await clients.get("customers", `/customers/${encodeURIComponent(request.customerId)}`);
      if (!customer) return failed(`We do not know the customer ${request.customerId}.`);
      if (!customer.active) return failed(`The customer ${customer.name} is not active.`, { email: customer.email });
      return passed(`The customer ${customer.name} is active.`, { email: customer.email });
    },
  },
  {
    id: "BR-03", name: "stock", task: "T04", // placeholder service 2
    async run(request, { clients }) {
      const item = await clients.get("items", `/items/${encodeURIComponent(request.itemId)}`);
      if (!item) return failed(`We do not know the item ${request.itemId}.`);
      if (item.stock < request.quantity) return failed(`Only ${item.stock} of ${item.name} are in stock, and ${request.quantity} were requested.`);
      return passed(`${item.name}: ${item.stock} in stock, ${request.quantity} requested.`);
    },
  },
  {
    id: "BR-04", name: "payment", task: "T05", // placeholder service 3
    async run(request, { clients }) {
      const accounts = (await clients.get("accounts", "/accounts")) ?? [];
      const account = accounts.find((a) => a.customerId === request.customerId);
      if (!account) return failed("This customer has no account, so the payment cannot be checked.");
      if (account.balance > 0) return failed(`The customer still owes ${account.balance} on the account.`);
      return passed("The account is paid.");
    },
  },
];

// A check must never reject: a service that does not answer is "unknown", not a crash.
async function guard(rule, request, context) {
  try {
    return await rule.run(request, context);
  } catch (error) {
    return unknown(`We could not run the ${rule.name} check, because a service did not answer.`, { detail: error.message });
  }
}

// The decision gateway G3: any failed check returns the request, an unknown check asks a person, all passed approves.
export function decide(checks) {
  const all = Object.values(checks);
  if (all.some((c) => c.status === "failed")) return "returned";
  if (all.some((c) => c.status === "unknown")) return "needs-review";
  return "approved";
}

export async function plan(requestId, request, { clients, external, queue }) {
  const results = await Promise.all(RULES.map((rule) => guard(rule, request, { clients, external }))); // independent checks run together
  const checks = Object.fromEntries(RULES.map((rule, i) => [rule.name, results[i]]));
  const decision = decide(checks);
  const reasons = [...Object.values(checks).filter((c) => c.status === "failed"), ...Object.values(checks).filter((c) => c.status === "unknown")].flatMap((c) => c.reasons);
  const email = checks.customer.email ?? null;
  if (email) queue.publish(TOPIC, { requestId, decision, reasons: reasons.length ? reasons : ["All checks passed."], email }); // the last task: notify
  return { requestId, decision, checks, reasons: reasons.length ? reasons : ["All checks passed."] };
}
