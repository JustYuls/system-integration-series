// Cache-aside with a time to live (TTL): ask the cache first, call the source only on a miss.
// The clock is injected (`now`), so tests can move time without waiting.
export function createCache({ ttlMs = 60_000, now = Date.now } = {}) {
  const entries = new Map(); // key -> { value, expiresAt }
  let hits = 0;
  let misses = 0;

  async function getOrLoad(key, loader, ttl = ttlMs) {
    const entry = entries.get(key);
    if (entry && now() < entry.expiresAt) {
      hits += 1;
      return entry.value;
    }
    misses += 1; // missing, or too old: go to the source
    const value = await loader(); // if the loader throws, nothing is stored
    entries.set(key, { value, expiresAt: now() + ttl });
    return value;
  }

  return {
    getOrLoad,
    stats: () => ({ hits, misses, size: entries.size }),
    clear: () => entries.clear(),
  };
}
