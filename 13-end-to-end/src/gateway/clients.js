// Clients for the three campus services: one small function per call the planner needs.
// They speak plain fetch + JSON, use the real response shapes of episode 9, and turn every failure into a ClientError.

export class ClientError extends Error {
  constructor(service, code, message, { status = 502, body = null } = {}) {
    super(message);
    this.name = "ClientError";
    this.service = service; // "student-affairs", "finance" or "facilities"
    this.code = code; // "UNREACHABLE" | "TIMEOUT" | "NOT_FOUND" | "BAD_STATUS"
    this.status = status; // the HTTP status the gateway should answer with
    this.body = body; // the JSON the service sent, if any
  }
}

// "Room 101" -> "room-101": the request names the venue, Facilities identifies it by id.
export const venueId = (name) => String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function createClients(services, { fetch = globalThis.fetch, timeoutMs = 3000 } = {}) {
  // One call. Returns { status, ok, body } for ANY answer of the service (also 404 and 400);
  // throws only when there is no answer at all.
  async function call(service, name, path, { method = "GET", body } = {}) {
    const base = String(services[service]).replace(/\/+$/, "");
    const init = { method, headers: {}, signal: AbortSignal.timeout(timeoutMs) };
    if (body !== undefined) {
      init.headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(base + path, init);
    } catch (err) {
      const slow = err.name === "TimeoutError" || err.name === "AbortError";
      throw new ClientError(name, slow ? "TIMEOUT" : "UNREACHABLE", `${name} did not answer (${err.message})`, { status: slow ? 504 : 502 });
    }
    const json = await res.json().catch(() => null); // 204 and empty bodies have no JSON
    return { status: res.status, ok: res.ok, body: json };
  }

  // An answer we did not expect (a 500, for example) is an error of the service, not of the caller.
  const unexpected = (name, res) =>
    new ClientError(name, res.status === 404 ? "NOT_FOUND" : "BAD_STATUS", `${name} answered ${res.status}`, { status: res.status === 404 ? 404 : 502, body: res.body });

  const affairs = (path, options) => call("studentAffairs", "student-affairs", path, options);
  const finance = (path, options) => call("finance", "finance", path, options);
  const facilities = (path, options) => call("facilities", "facilities", path, options);

  return {
    async listRequests() {
      const res = await affairs("/requests");
      if (!res.ok) throw unexpected("student-affairs", res);
      return res.body;
    },

    async getRequest(requestNo) {
      const res = await affairs(`/requests/${encodeURIComponent(requestNo)}`);
      if (!res.ok) throw unexpected("student-affairs", res);
      return res.body;
    },

    // Returns the service's own answer, 201 or 400, so the gateway can pass the validation problems through.
    async createRequest(body) {
      const res = await affairs("/requests", { method: "POST", body });
      if (res.status !== 201 && res.status !== 400) throw unexpected("student-affairs", res);
      return res;
    },

    async setStatus(requestNo, status) {
      const res = await affairs(`/requests/${encodeURIComponent(requestNo)}`, { method: "PATCH", body: { status } });
      if (!res.ok) throw unexpected("student-affairs", res);
      return res.body;
    },

    // null when Facilities does not know the venue.
    async availability({ venue, date, attendees }) {
      const query = new URLSearchParams({ date, attendees: String(attendees) });
      const res = await facilities(`/venues/${encodeURIComponent(venueId(venue))}/availability?${query}`);
      if (res.status === 404) return null;
      if (!res.ok) throw unexpected("facilities", res);
      return res.body;
    },

    // null when Finance has no deposit record for the request.
    async deposit(requestNo) {
      const res = await finance(`/deposits/${encodeURIComponent(requestNo)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw unexpected("finance", res);
      return res.body;
    },
  };
}
