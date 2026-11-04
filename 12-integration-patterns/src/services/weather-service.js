// The weather service: wraps Open-Meteo and returns a small, stable, normalized result.
// Callers never see Open-Meteo's field names, so the provider can change without breaking them.

export class ServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ServiceError";
    this.code = code; // "BAD_INPUT" (the caller's fault) or "UPSTREAM" (the outside service's fault)
  }
}

const FORECAST_DAYS = 16;
const bad = (message) => new ServiceError("BAD_INPUT", message);
const upstream = (message) => new ServiceError("UPSTREAM", `Open-Meteo ${message}`);
const DAY_MS = 24 * 60 * 60 * 1000;

export function buildUrl(latitude, longitude) {
  const q = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: "precipitation_probability_max,temperature_2m_max",
    timezone: "Asia/Manila",
    forecast_days: String(FORECAST_DAYS),
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

// Today in Manila, as 2027-03-04.
const manilaToday = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

function validDate(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text; // rejects 2027-02-30
}

const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

export async function getForecast({ date, latitude = 13.94, longitude = 121.62, today = manilaToday() } = {}, { fetch = globalThis.fetch } = {}) {
  if (!validDate(date)) throw bad("date must look like 2027-03-04");
  if (!(latitude >= -90 && latitude <= 90)) throw bad("latitude must be a number from -90 to 90");
  if (!(longitude >= -180 && longitude <= 180)) throw bad("longitude must be a number from -180 to 180");

  // Outside the window there is nothing to ask: say so without calling the outside service.
  const ahead = daysBetween(today, date);
  const reason = "beyond the 16 day forecast window";
  if (ahead < 0 || ahead >= FORECAST_DAYS) return { available: false, date, reason };

  let body;
  try {
    const response = await fetch(buildUrl(latitude, longitude));
    if (!response.ok) throw upstream(`answered with status ${response.status}`);
    body = await response.json();
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw upstream(`could not be reached: ${error.message}`);
  }

  // Translate: Open-Meteo's parallel arrays become one plain record.
  const i = body?.daily?.time?.indexOf(date) ?? -1;
  const rain = body?.daily?.precipitation_probability_max?.[i];
  const temp = body?.daily?.temperature_2m_max?.[i];
  const missing = i < 0 || typeof rain !== "number" || typeof temp !== "number";
  if (missing) throw upstream("sent no forecast for that date");
  return { available: true, date, rainChancePercent: rain, maxTempC: temp, source: "open-meteo" };
}
