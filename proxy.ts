import { NextRequest, NextResponse } from 'next/server';
import { unsealData } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';

// ─── Paths that skip session injection ───────────────────────────────────────
// The Stripe webhook is secured by signature verification — it never needs a
// session cookie. Public static pages don't need one either.
const SESSION_BYPASS = ['/api/stripe/webhook'];

// Next.js 16 renamed "middleware" to "proxy". The function must be named
// `proxy` (or be the default export). The config.matcher works identically.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (SESSION_BYPASS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Decode the session cookie (if present) ──────────────────────────────────
  // unsealData uses the Web Crypto API — safe in the Edge proxy runtime.
  // We never call the Node.js Redis or Prisma clients here.
  let tier: SessionData['tier'] = 'free';
  let email = '';

  const cookie = request.cookies.get(sessionOptions.cookieName);
  if (cookie?.value) {
    try {
      const session = await unsealData<Partial<SessionData>>(cookie.value, {
        password: sessionOptions.password,
        ttl: sessionOptions.ttl,
      });
      if (session.tier === 'pro' || session.tier === 'enterprise') tier = session.tier;
      if (session.email) email = session.email;
    } catch {
      // Tampered or expired cookie — default to free tier silently.
    }
  }

  // ── Inject tier into downstream request headers ───────────────────────────
  // Route handlers read X-User-Tier instead of re-parsing the cookie.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-tier', tier);
  if (email) requestHeaders.set('x-user-email', email);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/api/:path*'],
};
