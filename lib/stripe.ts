import Stripe from 'stripe';

// ─── Lazy singleton ───────────────────────────────────────────────────────────
// We defer instantiation until the first call so that build-time module
// evaluation never throws "No API key" when STRIPE_SECRET_KEY is absent
// from the build environment (it's only needed at runtime).
const g = globalThis as typeof globalThis & { _stripe?: Stripe };

export function getStripe(): Stripe {
  if (!g._stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set.');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    g._stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.preview' as any });
  }
  return g._stripe;
}

// ─── Tier ↔ Price helpers ─────────────────────────────────────────────────────
export type BilledTier = 'pro' | 'enterprise';

export function priceIdForTier(tier: BilledTier): string {
  const id =
    tier === 'enterprise'
      ? process.env.STRIPE_PRICE_ID_ENTERPRISE
      : process.env.STRIPE_PRICE_ID_PRO;
  if (!id) throw new Error(`Missing env STRIPE_PRICE_ID_${tier.toUpperCase()}`);
  return id;
}

export function tierFromPriceId(priceId: string): 'pro' | 'enterprise' | 'free' {
  if (priceId === process.env.STRIPE_PRICE_ID_ENTERPRISE) return 'enterprise';
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return 'pro';
  return 'free';
}

// Stripe statuses that still grant tier access (past_due = payment failed but
// we give a grace period rather than immediately revoking access).
export const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);
