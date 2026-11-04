// An access log for the gateway: one line per request, with the request id so one call can be followed
// through the gateway and the service. The writer is injected, so tests collect the lines.
export function createAccessLog(write = console.log) {
  return ({ id, method, path, status, ms }) => write(`${method} ${path} -> ${status}  ${ms} ms  id=${id}`);
}
