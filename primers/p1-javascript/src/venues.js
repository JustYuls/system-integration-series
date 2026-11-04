// The campus venues, and three small functions that use filter, find and map.
export const venues = [
  { id: "gym", name: "Gym", capacity: 400, outdoor: false },
  { id: "room-101", name: "Room 101", capacity: 60, outdoor: false },
  { id: "lab-a", name: "Lab A", capacity: 40, outdoor: false },
  { id: "atrium", name: "Atrium", capacity: 500, outdoor: false },
  { id: "field", name: "Field", capacity: 1000, outdoor: true },
];

// filter: keep the venues that are big enough (a new array; the original is not changed)
export const venuesThatFit = (people) => venues.filter((v) => v.capacity >= people);

// find: the first venue with this id, or undefined
export const findVenue = (id) => venues.find((v) => v.id === id);

// map: one new value for each venue
export const venueNames = () => venues.map((v) => v.name);
