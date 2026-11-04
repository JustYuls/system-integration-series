// Frankfurter adapter: any amount -> pesos, as { amountPhp, rate, asOf, available }.
import { createRouter } from "../patterns/router.js";
import { translate } from "../patterns/translator.js";
import { BadInputError, getJson } from "./upstream.js";

export const ratesUrl = (currency) => `https://api.frankfurter.dev/v1/latest?base=${currency}&symbols=PHP`;

// Upstream: { amount, base, date, rates: { PHP: 63.46 } }.  Internal: { rate, asOf }.
const RATE = { rate: "rates.PHP", asOf: "date" };

export async function fetchRate(currency, fetch) {
  return translate(await getJson(fetch, ratesUrl(currency)), RATE);
}

const round2 = (n) => Math.round(n * 100) / 100;

// Pesos need no call: the amount is returned unchanged, with rate 1.
const pesos = ({ amount }) => ({ amountPhp: amount, rate: 1, asOf: null, available: true });

// loadRate(currency) is injected (plain fetchRate, or the protected one).
export function createRates({ loadRate }) {
  async function foreign({ amount, currency }) {
    const { rate, asOf } = await loadRate(currency);
    return { amountPhp: round2(amount * rate), rate, asOf, available: true };
  }
  // The content-based router: the currency of the message picks the handler.
  const toPesos = createRouter({ by: "currency", routes: { PHP: pesos }, fallback: foreign });
  return {
    async convert({ amount, currency }) {
      if (!Number.isFinite(amount) || amount < 0) throw new BadInputError("amount must be a number, zero or more");
      if (!/^[A-Z]{3}$/.test(String(currency))) throw new BadInputError("currency must be a code like USD");
      return toPesos({ amount, currency });
    },
  };
}
