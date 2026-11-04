// Circuit breaker: closed (calls go through), open (calls fail at once), half-open (one probe call).
export class CircuitOpenError extends Error {
  constructor() {
    super("circuit is open");
    this.name = "CircuitOpenError";
    this.code = "CIRCUIT_OPEN";
  }
}

export function createBreaker({ failureThreshold = 3, coolDownMs = 30_000, now = Date.now, isFailure = () => true } = {}) {
  let state = "closed";
  let failures = 0; // consecutive failures
  let openedAt = 0;
  let probing = false;

  function current() {
    if (state === "open" && now() - openedAt >= coolDownMs) state = "half-open"; // cool-down is over
    return state;
  }

  function open() {
    state = "open";
    openedAt = now();
  }

  async function call(fn) {
    const s = current();
    if (s === "open" || (s === "half-open" && probing)) throw new CircuitOpenError(); // fail fast
    if (s === "half-open") probing = true; // this call is the probe
    try {
      const result = await fn();
      state = "closed";
      failures = 0;
      return result;
    } catch (err) {
      if (isFailure(err)) {
        failures += 1;
        if (s === "half-open" || failures >= failureThreshold) open();
      }
      throw err;
    } finally {
      if (s === "half-open") probing = false;
    }
  }

  return { call, state: current, failures: () => failures };
}
