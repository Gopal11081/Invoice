/**
 * Simple in-memory sliding-window rate limiter.
 * Each key (IP + route) gets a bucket of timestamps.
 * Works per-instance (fine for single-server / Vercel edge).
 */

const store = new Map();

// Auto-cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, timestamps] of store) {
    const filtered = timestamps.filter(t => now - t < windowMs);
    if (filtered.length === 0) {
      store.delete(key);
    } else {
      store.set(key, filtered);
    }
  }
}

/**
 * Check if a request should be rate-limited.
 * @param {string} key - Unique identifier (e.g., IP + route path)
 * @param {number} limit - Max requests allowed in the window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ limited: boolean, remaining: number, resetIn: number }}
 */
export function rateLimit(key, limit, windowMs) {
  cleanup(windowMs);

  const now = Date.now();
  const timestamps = store.get(key) || [];

  // Filter to only timestamps within the current window
  const windowStart = now - windowMs;
  const recent = timestamps.filter(t => t > windowStart);

  if (recent.length >= limit) {
    const oldestInWindow = recent[0];
    const resetIn = Math.ceil((oldestInWindow + windowMs - now) / 1000);
    return { limited: true, remaining: 0, resetIn };
  }

  // Allow request — record timestamp
  recent.push(now);
  store.set(key, recent);

  return { limited: false, remaining: limit - recent.length, resetIn: 0 };
}
