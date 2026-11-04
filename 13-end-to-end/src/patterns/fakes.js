// Fakes for tests and demos: a clock that only moves when we say so, and a fetch that never leaves the computer.
export function createFakeClock(start = 0) {
  let time = start;
  const sleeps = [];
  return {
    now: () => time,
    advance(ms) {
      time += ms;
    },
    sleeps, // every pause that was asked for
    async sleep(ms) {
      sleeps.push(ms);
      time += ms; // a pause costs time, but no real waiting
    },
  };
}

// handler(url) returns { status = 200, body } or throws (a network error). Every call is recorded in `calls`.
export function createFakeFetch(handler) {
  const calls = [];
  async function fakeFetch(url) {
    calls.push(String(url));
    const { status = 200, body } = await handler(String(url), calls.length);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }
  fakeFetch.calls = calls;
  return fakeFetch;
}
