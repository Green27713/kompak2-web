import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

// ─── Session shape ────────────────────────────────────────────────────────────
// Stored encrypted inside the HttpOnly cookie. Never put secrets here —
// the user can decode (but not forge) the payload with the wrong password.
export type SessionData = {
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
  stripeCustomerId: string;
};

// ─── Tier limits ─────────────────────────────────────────────────────────────
export const TIER_LIMITS: Record<SessionData['tier'], { requests: number; windowMs: number }> = {
  free:       { requests: 10,  windowMs: 60_000 },
  pro:        { requests: 100, windowMs: 60_000 },
  enterprise: { requests: 500, windowMs: 60_000 },
};

// ─── Cookie configuration ─────────────────────────────────────────────────────
// SESSION_PASSWORD must be ≥ 32 characters. Rotate by adding a new key:
//   SESSION_PASSWORD='{"1":"old-pass","2":"new-pass"}'
// iron-session decrypts with all keys but always encrypts with the highest key.
export const sessionOptions: SessionOptions = {
  cookieName: 'ps_session',
  password: process.env.SESSION_PASSWORD as string,
  ttl: 60 * 60 * 24 * 30, // 30 days
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read (or create an empty) session in a Server Component or Route Handler.
 * Uses the Next.js App Router `cookies()` store — automatically wires up
 * Set-Cookie on the response when you call session.save().
 *
 * @example
 * const session = await getSession();
 * if (!session.email) return redirect('/');
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/**
 * Convenience: read the tier from the current session, defaulting to 'free'
 * when no valid session cookie is present.
 *
 * @example
 * const tier = await getSessionTier(); // 'free' | 'pro' | 'enterprise'
 */
export async function getSessionTier(): Promise<SessionData['tier']> {
  const session = await getSession();
  return session.tier ?? 'free';
}

/**
 * Write a new session after a successful Stripe checkout / webhook.
 * Overwrites any existing session for the same browser.
 *
 * @example
 * await setSession({ email, tier: 'pro', stripeCustomerId });
 */
export async function setSession(data: SessionData): Promise<void> {
  const session = await getSession();
  session.email = data.email;
  session.tier = data.tier;
  session.stripeCustomerId = data.stripeCustomerId;
  await session.save();
}

/**
 * Destroy the session (e.g. subscription cancelled via webhook).
 */
export async function clearSession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
