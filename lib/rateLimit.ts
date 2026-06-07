import { NextRequest, NextResponse } from 'next/server';
import { TIER_LIMITS, type SessionData } from './session';
import { slidingWindowRateLimit } from './redis';

// ─── IP extraction ────────────────────────────────────────────────────────────
// Caddy sets X-Real-IP; X-Forwarded-For is the fallback for other proxies.
export function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'anonymous'
  );
}

// ─── Tier extraction ──────────────────────────────────────────────────────────
// middleware.ts injects X-User-Tier after verifying the session cookie.
// Defaults to 'free' when the header is absent (unauthenticated request).
export function getTier(req: NextRequest): SessionData['tier'] {
  const raw = req.headers.get('x-user-tier');
  if (raw === 'pro' || raw === 'enterprise') return raw;
  return 'free';
}

// ─── Main helper ──────────────────────────────────────────────────────────────
/**
 * Call at the top of any rate-limited route handler.
 * Returns null when the request is within limits (caller should continue).
 * Returns a 429 NextResponse when the limit is exceeded (caller should return it).
 *
 * Includes X-RateLimit-* headers on BOTH allowed and blocked responses
 * so clients can implement back-off without guessing.
 *
 * @example
 * const limited = await applyRateLimit(req);
 * if (limited) return limited;
 */
export async function applyRateLimit(
  req: NextRequest,
  // Optional override — use when a route needs a tighter limit than the tier default.
  override?: { limit: number; windowMs: number },
): Promise<NextResponse | null> {
  const tier = getTier(req);
  const ip = getIp(req);
  const limits = override
    ? { requests: override.limit, windowMs: override.windowMs }
    : TIER_LIMITS[tier];
  const { requests, windowMs } = limits;

  const { allowed, remaining, resetIn } = await slidingWindowRateLimit(
    `${tier}:${ip}`,
    requests,
    windowMs,
  );

  // Unix epoch seconds when the window resets — standard for Retry-After.
  const resetAt = Math.ceil((Date.now() + resetIn) / 1000);

  const rateLimitHeaders: Record<string, string> = {
    'X-RateLimit-Limit': String(requests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetAt),
  };

  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please slow down.',
        tier,
        retryAfter: resetAt,
        // Give free users a nudge toward upgrading.
        ...(tier === 'free' && {
          upgrade: 'Upgrade to Pro for 100 requests/min → /enterprise',
        }),
      },
      { status: 429, headers: { ...rateLimitHeaders, 'Retry-After': String(resetAt) } },
    );
  }

  return null;
}

// ─── Strict variant for abuse-prone endpoints ─────────────────────────────────
/**
 * Tighter IP-only rate limit for endpoints like /api/waitlist/enterprise.
 * Does NOT use tier — always keyed to IP so logged-out spam is still blocked.
 *
 * @example
 * const limited = await applyStrictRateLimit(req, 3, 60 * 60 * 1000); // 3/hr
 * if (limited) return limited;
 */
export async function applyStrictRateLimit(
  req: NextRequest,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  const ip = getIp(req);
  const { allowed, remaining, resetIn } = await slidingWindowRateLimit(
    `strict:${ip}`,
    limit,
    windowMs,
  );

  const resetAt = Math.ceil((Date.now() + resetIn) / 1000);
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetAt),
    'Retry-After': String(resetAt),
  };

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }
  return null;
}
