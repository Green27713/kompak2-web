import { NextRequest, NextResponse } from 'next/server';
import { unsealData } from 'iron-session';
import type { SessionData } from '@/lib/session';
import { sessionOptions } from '@/lib/session';

// ─── Paths that skip session injection ───────────────────────────────────────
// The Stripe webhook is secured by signature verification — it never needs a
// session cookie. Public static pages don't need one either.
const SESSION_BYPASS = ['/api/stripe/webhook'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let bypassed paths through immediately.
  if (SESSION_BYPASS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Decode the session cookie (if present) ──────────────────────────────────
  // We use unsealData directly rather than getIronSession because middleware
  // runs on the Edge runtime, which doesn't support the full Node.js crypto
  // module. unsealData uses the Web Crypto API and is Edge-safe.
  let tier: SessionData['tier'] = 'free';
  let email = '';

  const cookie = request.cookies.get(sessionOptions.cookieName);
  if (cookie?.value) {
    try {
      const session = await unsealData<Partial<SessionData>>(cookie.value, {
        password: sessionOptions.password,
        ttl: sessionOptions.ttl,
      });
      if (session.tier === 'pro' || session.tier === 'enterprise') {
        tier = session.tier;
      }
      if (session.email) email = session.email;
    } catch {
      // Cookie is tampered, expired, or encrypted with a rotated password.
      // Treat as unauthenticated — they'll get free-tier limits.
    }
  }

  // ── Inject headers for downstream route handlers ───────────────────────────
  // Route handlers read X-User-Tier instead of re-parsing the cookie.
  // This keeps the crypto work in one place (here) and keeps route handlers clean.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-tier', tier);
  if (email) requestHeaders.set('x-user-email', email);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Apply to all API routes. Static assets, _next internals, and page routes
// are excluded automatically by the :path* pattern.
export const config = {
  matcher: ['/api/:path*'],
};
