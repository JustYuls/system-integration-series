// Start an Express app on a free port and call it with fetch. Used by the tests, the demo and the AI review.

// listen(0) asks the system for a free port, so tests never fight over a port.
export function start(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => (server.closeAllConnections(), server.close(done))),
      });
    });
  });
}

// One request. body: an object (sent as JSON) or a string (sent as it is). Returns { status, headers, body }.
export async function send(base, path, { method = "GET", body } = {}) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(base + path, init);
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}
