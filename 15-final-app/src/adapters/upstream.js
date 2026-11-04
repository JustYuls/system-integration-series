// Shared by the adapters: fetch JSON from an outside API and turn every problem into one error type.
export class UpstreamError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "UpstreamError";
    this.code = "UPSTREAM";
    this.status = status;
  }
}

export class BadInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "BadInputError";
    this.code = "BAD_INPUT";
  }
}

export async function getJson(fetch, url, { timeoutMs = 5000 } = {}) {
  const host = new URL(url).host;
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new UpstreamError(`cannot reach ${host} (${err.message})`);
  }
  if (!response.ok) throw new UpstreamError(`${host} answered ${response.status}`, response.status);
  try {
    return await response.json();
  } catch {
    throw new UpstreamError(`${host} sent invalid JSON`, response.status);
  }
}

// Can another try help? Not for our own bad input, a changed payload, or a 4xx answer (except 429 "slow down").
export function isTransient(err) {
  if (["BAD_INPUT", "BAD_SHAPE", "ERR_MODULE_NOT_FOUND"].includes(err.code)) return false;
  if (err.status >= 400 && err.status < 500 && err.status !== 429) return false;
  return true;
}
