// Nager.Date adapter: public holidays of the Philippines -> { date, isHoliday, name, available }.
import { translate, TranslationError } from "../patterns/translator.js";
import { BadInputError, getJson } from "./upstream.js";

export const holidaysUrl = (year) => `https://date.nager.at/api/v3/PublicHolidays/${year}/PH`;

// What we keep from each upstream holiday (the API sends more fields).
const HOLIDAY = { date: "date", name: "name" };

// One call gets the whole year: [{ date, name }, ...].
export async function fetchYear(year, fetch) {
  const body = await getJson(fetch, holidaysUrl(year));
  if (!Array.isArray(body)) throw new TranslationError(["a list of holidays"]);
  return body.map((item) => translate(item, HOLIDAY));
}

// loadYear(year) is injected: it can be the plain fetchYear, or one protected by cache, retry and breaker.
export function createHolidays({ loadYear }) {
  return {
    async holiday(date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new BadInputError(`"${date}" is not a date like 2027-03-04`);
      const year = Number(date.slice(0, 4));
      const found = (await loadYear(year)).find((h) => h.date === date);
      return { date, isHoliday: Boolean(found), name: found ? found.name : null, available: true };
    },
  };
}
