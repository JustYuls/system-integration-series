// Retry with backoff: try again after a growing pause, and give up after `attempts`.
// backoffMs is a list of pauses ([200, 800]) or one number that doubles each time (200, 400, 800).
export const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pause(backoffMs, failedAttempts) {
  if (Array.isArray(backoffMs)) return backoffMs[Math.min(failedAttempts, backoffMs.length) - 1] ?? 0;
  return backoffMs * 2 ** (failedAttempts - 1);
}

export async function retry(fn, { attempts = 3, backoffMs = [200, 800], sleep = defaultSleep, shouldRetry = () => true } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === attempts || !shouldRetry(err)) break; // out of attempts, or retrying is pointless
      await sleep(pause(backoffMs, attempt)); // wait before the next try
    }
  }
  throw lastError;
}
