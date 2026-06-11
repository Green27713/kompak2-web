import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { randomBytes } from 'crypto';
import { getRedisClient } from '@/lib/redis';
import { applyStrictRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const TOKEN_TTL_SECONDS = 15 * 60;

function baseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? 'https://pixsnug.com').replace(/\/$/, '');
}

export async function POST(req: NextRequest) {
  const limited = await applyStrictRateLimit(req, 3, 60 * 60 * 1000); // 3 per hour per IP
  if (limited) return limited;

  const body = await req.json().catch(() => ({})) as { email?: string };
  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 });
  }

  const token = randomBytes(32).toString('hex');
  const redis = await getRedisClient();
  await redis.set(`magic:${token}`, email, { EX: TOKEN_TTL_SECONDS });

  const link = `${baseUrl()}/api/auth/verify?token=${token}`;
  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toUTCString();

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'PixSnug <onboarding@resend.dev>',
      to: email,
      subject: 'Your PixSnug sign-in link',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
          <h2 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px">Sign in to PixSnug</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 28px">
            Click the button below to sign in. This link expires in 15 minutes and works only once.
          </p>
          <a href="${link}"
             style="display:inline-block;background:linear-gradient(135deg,#0891b2,#6d28d9);color:#fff;
                    text-decoration:none;padding:13px 30px;border-radius:8px;font-weight:600;font-size:15px">
            Sign in to PixSnug →
          </a>
          <p style="color:#94a3b8;font-size:12px;margin:28px 0 0;line-height:1.6">
            If you didn't request this, ignore this email — nothing will happen.<br>
            Expires: ${expiresAt}
          </p>
        </div>
      `,
    }).catch(err => console.error('[auth/request] email send failed:', err));
  } else {
    console.warn('[auth/request] RESEND_API_KEY not set — magic link:', link);
  }

  // Always return success so we don't leak whether the email exists.
  return NextResponse.json({ success: true });
}
