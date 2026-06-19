/**
 * Lightweight client-side error logger.
 * Sends errors to the /api/public/log-error endpoint.
 * Replaces the duplicated fetch() pattern used across 15+ client components.
 */
export function logClientError(source, err) {
  fetch('/api/public/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `${source}: ${err?.message || String(err)}`,
      stack: err?.stack || ''
    })
  }).catch(() => {});
}
