// A small in-memory message queue: publish now, deliver later, retry a failing handler, keep the dead messages.
const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createQueue(options = {}) {
  const { maxAttempts = 3, backoffMs = [100, 400, 1600], sleep = realSleep } = options;
  const handlers = new Map(); // topic -> [handler, ...]
  const pending = []; // messages waiting for drain()
  const deadLetters = []; // messages that failed maxAttempts times
  const counts = { delivered: 0, retried: 0, dead: 0 };
  let nextId = 1;

  function subscribe(topic, handler) {
    if (!handlers.has(topic)) handlers.set(topic, []);
    handlers.get(topic).push(handler);
  }

  // The producer does not wait for any consumer: the message is only stored.
  function publish(topic, payload) {
    const id = nextId++;
    pending.push({ id, topic, payload });
    return id;
  }

  // One message to one handler: try, wait a growing time, try again, then give up.
  async function deliver(message, handler) {
    for (let attempt = 1; ; attempt++) {
      try {
        await handler(message.payload, message);
        counts.delivered++;
        return;
      } catch (error) {
        if (attempt >= maxAttempts) {
          deadLetters.push({ ...message, error: error.message, attempts: attempt });
          counts.dead++;
          return;
        }
        counts.retried++;
        await sleep(backoffMs[Math.min(attempt - 1, backoffMs.length - 1)]);
      }
    }
  }

  // Messages are taken one at a time, in the order they were published.
  async function drain() {
    while (pending.length > 0) {
      const message = pending.shift();
      for (const handler of handlers.get(message.topic) ?? []) await deliver(message, handler);
    }
  }

  const stats = () => ({ ...counts });
  return { subscribe, publish, drain, stats, deadLetters };
}
