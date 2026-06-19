import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Rate limit configuration per route pattern.
 * limit  = max requests allowed in the window
 * window = time window in milliseconds
 */
const RATE_LIMITS = {
  '/api/auth/login':            { limit: 7,  window: 60 * 1000 },       // 7 attempts / min
  '/api/auth/register':         { limit: 3,  window: 60 * 1000 },       // 3 attempts / min
  '/api/auth/forgot-password':  { limit: 3,  window: 5 * 60 * 1000 },   // 3 attempts / 5 min
  '/api/auth/reset-password':   { limit: 5,  window: 5 * 60 * 1000 },   // 5 attempts / 5 min
  '/api/admin/users':           { limit: 30, window: 60 * 1000 },       // 30 req / min (admin panel)
};

// Routes that need rate limiting (match by prefix for dynamic segments like /api/admin/users/[id]/...)
const RATE_LIMITED_PREFIXES = [
  { prefix: '/api/auth/',  limit: 10, window: 60 * 1000 },              // General auth fallback: 10/min
  { prefix: '/api/admin/', limit: 30, window: 60 * 1000 },              // General admin fallback: 30/min
];

function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Find exact match first, then prefix match
  let config = RATE_LIMITS[pathname];

  if (!config) {
    for (const rule of RATE_LIMITED_PREFIXES) {
      if (pathname.startsWith(rule.prefix)) {
        config = { limit: rule.limit, window: rule.window };
        break;
      }
    }
  }

  // No rate limit rule for this route — pass through
  if (!config) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const key = `${ip}:${pathname}`;
  const { limited, remaining, resetIn } = rateLimit(key, config.limit, config.window);

  if (limited) {
    return NextResponse.json(
      { error: `Too many requests. Please try again in ${resetIn} seconds.` },
      {
        status: 429,
        headers: {
          'Retry-After': String(resetIn),
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // Attach rate-limit headers to successful responses
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(config.limit));
  response.headers.set('X-RateLimit-Remaining', String(remaining));

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
