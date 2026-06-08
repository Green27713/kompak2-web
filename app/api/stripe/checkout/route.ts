import { NextRequest, NextResponse } from 'next/server';
import { getStripe, priceIdForTier, type BilledTier } from '@/lib/stripe';
import { getSession } from '@/lib/session';
import { applyRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // Stripe not yet configured — send users home instead of throwing an error.
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ url: '/' });
  }

  // Protect against checkout-spam (still tier-aware via middleware header).
  const limited = await applyRateLimit(req);
  if (limited) return limited;

  try {
    const body = await req.json();
    const tier = (body.tier ?? 'pro') as BilledTier;

    if (tier !== 'pro' && tier !== 'enterprise') {
      return NextResponse.json({ error: 'Invalid tier. Must be "pro" or "enterprise".' }, { status: 400 });
    }

    // Prefer session email (returning user) over body email (first-time).
    const session = await getSession();
    const email: string | undefined = session.email || body.email || undefined;

    // If this email already has a Stripe customer, reuse it so Stripe
    // recognises them and doesn't create duplicates.
    let customerId: string | undefined;
    if (email) {
      const existing = await getStripe().customers.list({ email, limit: 1 });
      if (existing.data.length > 0) customerId = existing.data[0].id;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://pixsnug.com';

    const checkoutSession = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceIdForTier(tier), quantity: 1 }],
      ...(customerId
        ? { customer: customerId }
        : email ? { customer_email: email } : {}),
      // {CHECKOUT_SESSION_ID} is replaced by Stripe before redirecting.
      success_url: `${baseUrl}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?checkout=cancelled`,
      subscription_data: {
        metadata: { tier },
      },
      metadata: { tier },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
  }
}
