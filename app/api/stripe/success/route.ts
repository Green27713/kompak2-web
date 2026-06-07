import { NextRequest, NextResponse } from 'next/server';
import { getStripe, tierFromPriceId } from '@/lib/stripe';
import { db } from '@/lib/db';
import { setSession } from '@/lib/session';

export const runtime = 'nodejs';

// Stripe redirects the browser here after a successful checkout:
//   /api/stripe/success?session_id=cs_live_...
//
// We retrieve the Checkout Session, upsert the User row (in case the webhook
// hasn't fired yet), set the iron-session cookie, then redirect home.
// This is a GET because Stripe's success_url is a browser redirect.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(new URL('/?checkout=error', req.nextUrl.origin));
  }

  try {
    const cs = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    if (cs.payment_status !== 'paid' && cs.status !== 'complete') {
      return NextResponse.redirect(new URL('/?checkout=unpaid', req.nextUrl.origin));
    }

    const email = cs.customer_details?.email ?? (cs.customer as { email?: string })?.email ?? '';
    const customerId = typeof cs.customer === 'string' ? cs.customer : (cs.customer as { id: string })?.id;
    const sub = cs.subscription as { id: string; status: string; items: { data: { price: { id: string } }[] } } | null;
    const priceId = sub?.items?.data[0]?.price?.id ?? '';

    // Use metadata tier as fallback in case STRIPE_PRICE_ID_* env vars aren't set yet.
    const metadataTier = (cs.metadata?.tier ?? 'pro') as 'pro' | 'enterprise';
    const resolvedTier = tierFromPriceId(priceId) !== 'free' ? tierFromPriceId(priceId) : metadataTier;

    if (email && customerId) {
      // Upsert — the webhook may have already done this, which is fine.
      await db.user.upsert({
        where: { stripeCustomerId: customerId },
        create: {
          email,
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub?.id ?? null,
          subscriptionTier: resolvedTier,
          subscriptionStatus: sub?.status ?? 'active',
        },
        update: {
          email,
          stripeSubscriptionId: sub?.id ?? null,
          subscriptionTier: resolvedTier,
          subscriptionStatus: sub?.status ?? 'active',
        },
      });

      // Set the encrypted httpOnly session cookie in the browser.
      await setSession({ email, tier: resolvedTier, stripeCustomerId: customerId });
    }

    return NextResponse.redirect(new URL('/?checkout=success', req.nextUrl.origin));
  } catch (err) {
    console.error('[stripe/success]', err);
    return NextResponse.redirect(new URL('/?checkout=error', req.nextUrl.origin));
  }
}
