import { createApp } from "../src/app.js";

// Start the app on a free port, give the test a `call` function, close the server after.
export async function withApp(options, fn) {
  const app = createApp(options);
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;
  const call = async (method, path, body, rawBody) => {
    const res = await fetch(base + path, {
      method,
      headers: body !== undefined || rawBody !== undefined ? { "Content-Type": "application/json" } : {},
      body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* not JSON, e.g. HTML or CSS */ }
    return { status: res.status, headers: res.headers, data, text };
  };
  try {
    return await fn(call);
  } finally {
    server.close();
  }
}

export const goodRequest = { title: "Orientation Day", date: "2027-03-04", venue: "gym", attendees: 120 };
