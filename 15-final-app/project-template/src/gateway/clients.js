// One small function to read from a service. null means "the service answered 404"; any other failure is a ClientError.
export class ClientError extends Error {
  constructor(service, code, message, status = 502) {
    super(message);
    this.name = "ClientError";
    this.service = service;
    this.code = code; // "UNREACHABLE" | "TIMEOUT" | "BAD_STATUS"
    this.status = status; // what the gateway answers: 502 (cannot reach), 504 (too slow)
  }
}

export function createClients(services, { fetch = globalThis.fetch, timeoutMs = 3000 } = {}) {
  return {
    async get(service, path) {
      let res;
      try {
        res = await fetch(String(services[service]).replace(/\/+$/, "") + path, { signal: AbortSignal.timeout(timeoutMs) });
      } catch (error) {
        const slow = error.name === "TimeoutError" || error.name === "AbortError";
        throw new ClientError(service, slow ? "TIMEOUT" : "UNREACHABLE", `${service} did not answer (${error.message})`, slow ? 504 : 502);
      }
      if (res.status === 404) return null;
      if (!res.ok) throw new ClientError(service, "BAD_STATUS", `${service} answered ${res.status}`);
      return res.json();
    },
  };
}
