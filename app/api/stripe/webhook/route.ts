import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe, tierFromPriceId, ACTIVE_STATUSES } from '@/lib/stripe';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// Stripe requires the raw body for signature verification.
// Next.js App Router provides req.text() — do NOT call req.json() here.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (err) {
    // Signature mismatch — reject immediately. Do NOT log rawBody.
    console.error('[stripe/webhook] signature verification failed:', (err as Error).message);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  console.log(`[stripe/webhook] ${event.type} — ${event.id}`);

  try {
    switch (event.type) {
      // ── Checkout completed ─────────────────────────────────────────────────
      // Fires when the user pays. The success page (/api/stripe/success) also
      // upserts the row — this webhook is the authoritative server-side record.
      case 'checkout.session.completed': {
        const cs = event.data.object as Stripe.Checkout.Session;
        if (cs.mode !== 'subscription' || !cs.subscription || !cs.customer) break;

        const subscription = await getStripe().subscriptions.retrieve(cs.subscription as string);
        const priceId = subscription.items.data[0]?.price.id ?? '';
        const tier = tierFromPriceId(priceId) === 'free'
          // Fall back to metadata tier if price IDs aren't configured yet.
          ? ((cs.metadata?.tier ?? 'pro') as 'pro' | 'enterprise')
          : tierFromPriceId(priceId);

        const email = cs.customer_details?.email ?? '';
        if (!email) { console.warn('[stripe/webhook] checkout.session has no email'); break; }

        await db.user.upsert({
          where: { stripeCustomerId: cs.customer as string },
          create: {
            email,
            stripeCustomerId: cs.customer as string,
            stripeSubscriptionId: cs.subscription as string,
            subscriptionTier: tier,
            subscriptionStatus: subscription.status,
          },
          update: {
            email,
            stripeSubscriptionId: cs.subscription as string,
            subscriptionTier: tier,
            subscriptionStatus: subscription.status,
          },
        });

        console.log(`[stripe/webhook] upserted user ${email} → ${tier}`);
        break;
      }

      // ── Subscription changed (upgrade / downgrade / renewal) ───────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id ?? '';
        const tier = tierFromPriceId(priceId);
        const isActive = ACTIVE_STATUSES.has(sub.status);

        await db.user.updateMany({
          where: { stripeCustomerId: sub.customer as string },
          data: {
            stripeSubscriptionId: sub.id,
            subscriptionTier: isActive && tier !== 'free' ? tier : 'free',
            subscriptionStatus: sub.status,
          },
        });

        console.log(`[stripe/webhook] subscription updated → ${tier} (${sub.status})`);
        break;
      }

      // ── Subscription cancelled / expired ───────────────────────────────────
      // The existing session cookie may still say 'pro' until it expires.
      // requirePro() (Step 6) cross-checks the DB and will reject stale cookies.
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;

        await db.user.updateMany({
          where: { stripeCustomerId: sub.customer as string },
          data: {
            subscriptionTier: 'free',
            subscriptionStatus: 'cancelled',
            stripeSubscriptionId: null,
          },
        });

        console.log(`[stripe/webhook] subscription cancelled for customer ${sub.customer}`);
        break;
      }

      default:
        // Unhandled event type — acknowledged to stop Stripe retrying.
        break;
    }
  } catch (err) {
    // Return 500 so Stripe retries the event (it will retry for 3 days).
    console.error('[stripe/webhook] handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  // Always return 200 for handled events so Stripe marks them delivered.
  return NextResponse.json({ received: true });
}
