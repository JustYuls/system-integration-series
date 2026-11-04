// Run:  node demo.js      (needs the internet for the last part)
import { checkRequest } from "./src/check-request.js";
import { venuesThatFit, venueNames } from "./src/venues.js";
import { rainChance } from "./src/weather.js";

const valid = {
  requestNo: "EVT-0001",
  title: "Orientation Day",
  date: "2027-03-04",
  venue: "Gym",
  attendees: 120,
  budget: { amount: 15000, currency: "PHP" },
  outdoor: false,
  contactEmail: "cs@campus.example",
};
const invalid = { ...valid, title: "", date: "2027-02-30", attendees: "120", budget: { amount: -5, currency: "peso" } };

console.log("Valid request:  ", checkRequest(valid));
console.log("Invalid request:", checkRequest(invalid));

console.log("Venues:", venueNames().join(", "));
console.log("Venues for 100 people:", venuesThatFit(100).map((v) => v.name).join(", "));

// the date 3 days ahead, in the campus time zone, as 2027-03-04 text
const ahead = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
const date = ahead.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
try {
  const percent = await rainChance(date);
  console.log(`Chance of rain on ${date}:`, percent === null ? "no forecast" : `${percent}%`);
} catch (error) {
  console.log("Weather problem:", error.message);
}
