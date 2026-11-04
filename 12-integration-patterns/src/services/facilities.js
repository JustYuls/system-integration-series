// Facilities service: venues and their reservations.
//   GET  /venues?minCapacity=               the venues (only those that hold enough people)
//   GET  /venues/:id                        one venue, or 404
//   GET  /venues/:id/availability?date=&attendees=   can the venue be used on that date?
//   GET  /reservations?venueId=&date=       the reservations
//   GET  /reservations/:requestNo           the reservation of one request
//   POST /reservations                      reserve: 201 + Location, 400, 409 (already reserved), 422 (unknown venue)
import { checkFields, createJsonApp, finishApp, hasProblems, sendError, sendValidation } from "../http.js";
import { seedData } from "../seed.js";
import { isIsoDate, isPositiveInt, isRequestNo, isText } from "../validate.js";

const RESERVATION_RULES = { requestNo: isRequestNo, venueId: isText, date: isIsoDate, hours: (v) => isPositiveInt(v) && v <= 12 };

export function createFacilitiesApp(data = seedData(), { log } = {}) {
  const venues = structuredClone(data.venues);
  const reservations = structuredClone(data.reservations);
  const findVenue = (id) => venues.find((v) => v.id === id);
  const reservedOn = (venueId, date) => reservations.find((r) => r.venueId === venueId && r.date === date);
  const app = createJsonApp("facilities");

  app.get("/venues", (req, res) => {
    const { minCapacity } = req.query;
    if (minCapacity === undefined) return res.json(venues);
    if (!isPositiveInt(Number(minCapacity))) return sendValidation(res, { missing: [], invalid: ["minCapacity"] });
    res.json(venues.filter((v) => v.capacity >= Number(minCapacity)));
  });

  app.get("/venues/:id", (req, res) => {
    const venue = findVenue(req.params.id);
    if (!venue) return sendError(res, 404, "NOT_FOUND", `No venue ${req.params.id}`);
    res.json(venue);
  });

  // A question about a venue on a date. It changes nothing, so it is a GET.
  app.get("/venues/:id/availability", (req, res) => {
    const venue = findVenue(req.params.id);
    if (!venue) return sendError(res, 404, "NOT_FOUND", `No venue ${req.params.id}`);
    const { date, attendees } = req.query;
    const problems = checkFields({ date }, { date: isIsoDate });
    if (attendees !== undefined && !isPositiveInt(Number(attendees))) problems.invalid.push("attendees");
    if (hasProblems(problems)) return sendValidation(res, problems);

    const reasons = [];
    const available = !reservedOn(venue.id, date);
    if (!available) reasons.push(`${venue.name} is already reserved on ${date}`);
    const capacityOk = attendees === undefined || Number(attendees) <= venue.capacity;
    if (!capacityOk) reasons.push(`${venue.name} holds ${venue.capacity} people, not ${attendees}`);
    if (venue.penaltyPhp > 0) reasons.push(`${venue.name} has an unpaid penalty of ${venue.penaltyPhp} PHP`);
    res.json({ venue: venue.name, date, available, capacityOk, penaltyPhp: venue.penaltyPhp, reasons });
  });

  app.get("/reservations", (req, res) => {
    const { venueId, date } = req.query;
    res.json(reservations.filter((r) => (!venueId || r.venueId === venueId) && (!date || r.date === date)));
  });

  app.get("/reservations/:requestNo", (req, res) => {
    const found = reservations.find((r) => r.requestNo === req.params.requestNo);
    if (!found) return sendError(res, 404, "NOT_FOUND", `No reservation for ${req.params.requestNo}`);
    res.json(found);
  });

  app.post("/reservations", (req, res) => {
    const body = req.body ?? {};
    const problems = checkFields(body, RESERVATION_RULES);
    if (hasProblems(problems)) return sendValidation(res, problems);
    const venue = findVenue(body.venueId);
    if (!venue) return sendError(res, 422, "UNKNOWN_VENUE", `There is no venue ${body.venueId}`);
    if (reservedOn(venue.id, body.date)) return sendError(res, 409, "ALREADY_RESERVED", `${venue.name} is already reserved on ${body.date}`);
    if (reservations.some((r) => r.requestNo === body.requestNo)) {
      return sendError(res, 409, "DUPLICATE_RESERVATION", `${body.requestNo} already has a reservation`);
    }
    const created = { requestNo: body.requestNo, venueId: venue.id, date: body.date, hours: body.hours };
    reservations.push(created);
    res.status(201).location(`/reservations/${created.requestNo}`).json(created);
  });

  return finishApp(app, log);
}
