// How many connections do n systems need? Two ways to wire them.

// Every system talks directly to every other one: n * (n - 1) / 2 links.
export const pointToPoint = (n) => (n * (n - 1)) / 2;

// Every system talks only to a hub in the middle: n links.
export const hubAndSpoke = (n) => n;

export function table(maxN = 6) {
  return Array.from({ length: maxN - 1 }, (_, i) => i + 2).map((n) => [n, pointToPoint(n), hubAndSpoke(n)]);
}
