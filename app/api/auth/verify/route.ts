import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { db } from '@/lib/db';
import { setSession } from '@/lib/session';
import { ACTIVE_STATUSES } from '@/lib/stripe';

export const runtime = 'nodejs';

function baseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? 'https://pixsnug.com').replace(/\/$/, '');
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${baseUrl()}/login?error=invalid`);
  }

  const redis = await getRedisClient();
  const email = await redis.get(`magic:${token}`);

  if (!email) {
    return NextResponse.redirect(`${baseUrl()}/login?error=expired`);
  }

  // Burn the token immediately — one-time use.
  await redis.del(`magic:${token}`);

  const user = await db.user.findUnique({
    where: { email },
    select: {
      email: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
    },
  });

  if (!user) {
    return NextResponse.redirect(`${baseUrl()}/login?error=notfound`);
  }

  const isActive = ACTIVE_STATUSES.has(user.subscriptionStatus);
  const tier =
    isActive && (user.subscriptionTier === 'pro' || user.subscriptionTier === 'enterprise')
      ? (user.subscriptionTier as 'pro' | 'enterprise')
      : 'free';

  await setSession({ email: user.email, tier, stripeCustomerId: user.stripeCustomerId });

  return NextResponse.redirect(`${baseUrl()}/?login=success`);
}
