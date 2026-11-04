// A live call of the real Open-Meteo API through the weather service.   Run:  node weather-demo.js
// It prints the raw answer (a short excerpt) next to the normalized result, then two cases that do not reach the API.
import { ServiceError, getForecast } from "./src/services/weather-service.js";

const addDays = (days) => new Date(Date.now() + 8 * 3600e3 + days * 86400e3).toISOString().slice(0, 10);
const date = addDays(3);

// A spy: remember what Open-Meteo really sent, then hand it on unchanged.
let raw;
const spy = async (url) => {
  const response = await fetch(url);
  raw = await response.clone().json();
  return response;
};

console.log(`Forecast for Lucena City on ${date}`);
const result = await getForecast({ date }, { fetch: spy });
const i = raw.daily.time.indexOf(date);
console.log("");
console.log("Open-Meteo sends (excerpt):");
console.log(`  daily.time                           "${raw.daily.time[i]}"`);
console.log(`  daily.precipitation_probability_max  ${raw.daily.precipitation_probability_max[i]}`);
console.log(`  daily.temperature_2m_max             ${raw.daily.temperature_2m_max[i]}`);
console.log("The weather service returns:");
console.log(`  ${JSON.stringify(result)}`);

console.log("");
console.log("Too far ahead (no call is made):");
console.log(`  ${JSON.stringify(await getForecast({ date: addDays(40) }))}`);

console.log("Bad input:");
try {
  await getForecast({ date: "04/03/2027" });
} catch (error) {
  if (!(error instanceof ServiceError)) throw error;
  console.log(`  ServiceError ${error.code}: ${error.message}`);
}
