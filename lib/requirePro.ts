import { NextRequest, NextResponse } from 'next/server';
import { getTier, getIp } from './rateLimit';
import { db } from './db';
import { ACTIVE_STATUSES } from './stripe';
import type { SessionData } from './session';

// ─── Shared 403 factory ───────────────────────────────────────────────────────
function forbidden(detail: string, hint = 'Upgrade at pixsnug.com/enterprise') {
  return NextResponse.json({ error: detail, upgrade: hint }, { status: 403 });
}

// ─── requirePro ───────────────────────────────────────────────────────────────
/**
 * Gate any route handler behind an active Pro or Enterprise subscription.
 *
 * Two-step check:
 *  1. Fast path — reads X-User-Tier injected by proxy.ts (no DB hit).
 *  2. DB cross-check — verifies the subscription hasn't been cancelled since
 *     the cookie was issued. Guards against stale 30-day cookies.
 *
 * Returns null when the caller may proceed, or a 403 NextResponse to return.
 *
 * @example
 * const denied = await requirePro(req);
 * if (denied) return denied;
 */
export async function requirePro(req: NextRequest): Promise<NextResponse | null> {
  const tier = getTier(req);

  // Fast-path rejection — no DB query needed for free-tier users.
  if (tier === 'free') {
    return forbidden(
      'This feature requires a Pro or Enterprise subscription.',
      'Upgrade at pixsnug.com/enterprise',
    );
  }

  // DB cross-check — the cookie may be up to 30 days old; the subscription
  // may have been cancelled in the meantime (webhook updated the DB).
  const email = req.headers.get('x-user-email');
  if (email) {
    const user = await db.user.findUnique({
      where: { email },
      select: { subscriptionTier: true, subscriptionStatus: true },
    });

    if (
      !user ||
      user.subscriptionTier === 'free' ||
      !ACTIVE_STATUSES.has(user.subscriptionStatus)
    ) {
      return forbidden(
        'Your subscription is no longer active. Please renew to continue.',
        'Manage billing at pixsnug.com or contact support.',
      );
    }
  }

  return null; // all checks passed — caller may proceed
}

// ─── requireEnterprise ────────────────────────────────────────────────────────
/**
 * Stricter variant — only Enterprise subscriptions pass.
 * Use on routes with 5 GB file limits or dedicated-worker processing.
 */
export async function requireEnterprise(req: NextRequest): Promise<NextResponse | null> {
  const tier = getTier(req);

  if (tier !== 'enterprise') {
    return forbidden(
      'This feature is restricted to Enterprise plans.',
      'Join the Enterprise waitlist at pixsnug.com/enterprise',
    );
  }

  const email = req.headers.get('x-user-email');
  if (email) {
    const user = await db.user.findUnique({
      where: { email },
      select: { subscriptionTier: true, subscriptionStatus: true },
    });

    if (
      !user ||
      user.subscriptionTier !== 'enterprise' ||
      !ACTIVE_STATUSES.has(user.subscriptionStatus)
    ) {
      return forbidden(
        'Your Enterprise subscription is no longer active.',
        'Contact support or visit pixsnug.com/enterprise',
      );
    }
  }

  return null;
}

// ─── Tier-based file size limits ─────────────────────────────────────────────
// Single source of truth for video size gates — imported by compress route.
export const VIDEO_SIZE_LIMITS: Record<SessionData['tier'], number> = {
  free:       600  * 1024 * 1024,       //   600 MB
  pro:        2    * 1024 * 1024 * 1024, //     2 GB
  enterprise: 5    * 1024 * 1024 * 1024, //     5 GB
};

/**
 * Returns a 403 if the video is too large for the user's tier, null otherwise.
 *
 * @example
 * const denied = await requireVideoSizeAllowed(req, videoBytes);
 * if (denied) return denied;
 */
export function requireVideoSizeAllowed(
  req: NextRequest,
  fileSizeBytes: number,
): NextResponse | null {
  const tier = getTier(req);
  const limit = VIDEO_SIZE_LIMITS[tier];

  if (fileSizeBytes > limit) {
    const limitMb = limit / 1024 / 1024;
    const limitLabel = limitMb >= 1024 ? `${limitMb / 1024} GB` : `${limitMb} MB`;

    return NextResponse.json(
      {
        error: `Your ${tier} plan supports videos up to ${limitLabel}. This file is too large.`,
        fileSizeBytes,
        limitBytes: limit,
        tier,
        upgrade:
          tier === 'free'
            ? 'Upgrade to Pro (2 GB) or Enterprise (5 GB) at pixsnug.com/enterprise'
            : 'Upgrade to Enterprise (5 GB) at pixsnug.com/enterprise',
      },
      { status: 403 },
    );
  }

  return null;
}

// ─── Usage examples ───────────────────────────────────────────────────────────
// Drop either guard into ANY route handler with two lines:
//
//   import { requirePro, requireVideoSizeAllowed } from '@/lib/requirePro';
//
//   // Inside your route handler:
//   const limited = await applyRateLimit(req);           // rate limit first
//   if (limited) return limited;
//
//   const denied = await requirePro(req);                // then paywall
//   if (denied) return denied;
//
//   const tooBig = requireVideoSizeAllowed(req, bytes);  // then size gate
//   if (tooBig) return tooBig;
// ─────────────────────────────────────────────────────────────────────────────

// Keeps linter happy — getIp is re-exported so callers don't need two imports.
export { getIp };
