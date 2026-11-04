// Check what an AI assistant said about integration patterns.   Run:  node review/patterns-review.js
import { collect } from "./patterns-facts.js";

const f = await collect();
const verdict = (ok) => (ok ? "confirmed" : "NOT confirmed");
console.log(`FINDING 1  retrying at once, with no pause, hammers the service     5 tries in ${f.immediateBurst ? "the same instant" : "different instants"}      ${verdict(f.immediateBurst)}`);
console.log(`FINDING 2  a cache with no expiry serves old data forever           still the old forecast a day later  ${verdict(f.foreverStale)}`);
console.log(`FINDING 3  an open breaker fails fast                               ${f.closedFailMs} ms -> ${f.openFailMs} ms per failure          ${verdict(f.openFailMs === 0 && f.closedFailMs > 0)}`);
console.log(`CLAIM 4    a circuit breaker retries every request until it works   ${f.upstreamCallsWhileOpen} upstream calls for 11 requests      ${f.upstreamCallsWhileOpen > 0 ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 5    cache-aside loads from the source only on a miss         ${f.cacheLoads} load for ${f.cacheHits + f.cacheMisses} calls (${f.cacheMisses} miss)         ${f.cacheLoads === f.cacheMisses ? "TRUE" : "FALSE"}`);
console.log(`CLAIM 6    a cache TTL of one year is fine for weather              1 day later: ${f.yearTtlStale ? "still the old forecast" : "fresh"}      ${f.yearTtlStale ? "FALSE" : "TRUE"}`);
