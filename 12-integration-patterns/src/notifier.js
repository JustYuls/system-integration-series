// The consumer of "request.decided": builds the e-mail for the organizer and sends it (task T07, FR-12).
export const TOPIC = "request.decided";

const SUBJECTS = {
  approved: "approved",
  returned: "returned to you",
  "needs-review": "needs a manual review",
};

const OPENINGS = {
  approved: "Good news: your event request was approved.",
  returned: "Your event request was returned. Please fix the points below and submit it again.",
  "needs-review": "We could not check everything automatically, so an officer will review your request.",
};

export function buildMessage({ requestNo, decision, reasons = [], contactEmail }) {
  if (!SUBJECTS[decision]) throw new Error(`unknown decision "${decision}"`);
  const lines = [OPENINGS[decision]];
  if (reasons.length > 0) lines.push("", "Reasons:", ...reasons.map((r) => `- ${r}`));
  return { to: contactEmail, subject: `Event request ${requestNo} ${SUBJECTS[decision]}`, body: lines.join("\n") };
}

export function createNotifier({ send }) {
  const sent = new Set(); // "EVT-0001:approved": one e-mail per request and decision

  return async function notify(payload) {
    const key = `${payload.requestNo}:${payload.decision}`;
    if (sent.has(key)) return { skipped: true }; // a retried or repeated delivery
    const message = buildMessage(payload);
    await send(message); // if this throws, the key is not stored, so a retry sends again
    sent.add(key);
    return { skipped: false };
  };
}
