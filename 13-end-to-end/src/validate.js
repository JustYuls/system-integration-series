// Small checks used to validate what a client sends. Each one answers: is this value acceptable?
export const isText = (v) => typeof v === "string" && v.trim().length > 0;
export const isEmail = (v) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const isPositiveInt = (v) => Number.isInteger(v) && v > 0;
export const isRequestNo = (v) => typeof v === "string" && /^EVT-\d{4}$/.test(v);

// "2027-03-04" is a date; "2027-02-30" and "03/04/2027" are not.
export function isIsoDate(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}

// Money is { amount, currency }, for example { "amount": 500, "currency": "USD" }.
export const isMoney = (v) => v !== null && typeof v === "object" && typeof v.amount === "number" && v.amount > 0 && /^[A-Z]{3}$/.test(v.currency ?? "");

// An amount of pesos with at most two decimals (centavos).
export const isPesos = (v) => typeof v === "number" && v > 0 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
