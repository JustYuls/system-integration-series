// The consumer of the topic "request.decided": builds the message for the person and sends it (the last task of the process).
export const TOPIC = "request.decided";

const OPENINGS = {
  approved: "Good news: your request was approved.",
  returned: "Your request was returned. Please fix the points below and submit it again.",
  "needs-review": "We could not check everything automatically, so a person will review your request.",
};

export function buildMessage({ requestId, decision, reasons = [], email }) {
  if (!OPENINGS[decision]) throw new Error(`unknown decision "${decision}"`);
  const lines = [OPENINGS[decision], "", ...(reasons.length ? ["Reasons:", ...reasons.map((r) => `- ${r}`)] : [])];
  return { to: email, subject: `Request ${requestId}: ${decision}`, body: lines.join("\n") };
}

// send({ to, subject, body }) is injected: a console line today, a mail server later.
export function createNotifier({ send }) {
  const sent = new Set(); // one message for each request and decision, also when the queue delivers twice
  return async function notify(payload) {
    const key = `${payload.requestId}:${payload.decision}`;
    if (sent.has(key)) return { skipped: true };
    await send(buildMessage(payload)); // if this throws, the queue retries
    sent.add(key);
    return { skipped: false };
  };
}
