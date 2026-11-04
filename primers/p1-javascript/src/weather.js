// The chance of rain on a date, from Open-Meteo (free, no key). Campus: Lucena City.
const URL =
  "https://api.open-meteo.com/v1/forecast?latitude=13.94&longitude=121.62" +
  "&daily=precipitation_probability_max&timezone=Asia%2FManila&forecast_days=16";

// Returns the percent (0 to 100), or null when the date is outside the 16 day forecast.
// `fetch` is a parameter so that tests can pass a fake one.
export async function rainChance(date, { fetch = globalThis.fetch } = {}) {
  let data;
  try {
    const response = await fetch(URL);
    if (!response.ok) {                 // fetch does NOT throw on 404 or 500
      throw new Error(`Open-Meteo answered ${response.status}`);
    }
    data = await response.json();
  } catch (error) {
    throw new Error(`Could not get the weather: ${error.message}`);
  }
  const i = data.daily.time.indexOf(date);
  return i === -1 ? null : data.daily.precipitation_probability_max[i];
}
