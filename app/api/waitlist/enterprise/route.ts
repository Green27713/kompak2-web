import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { db } from '@/lib/db';
import { applyStrictRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const schema = z.object({
  email: z
    .string()
    .min(1, 'Email is required.')
    .email('Please enter a valid email address.')
    .max(255, 'Email address is too long.')
    .toLowerCase()
    .trim(),
  company: z.string().max(120).optional(),
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'markgreenslade@pixsnug.com';

export async function POST(req: NextRequest) {
  // 3 submissions per hour per IP — prevents spam without blocking real signups.
  const limited = await applyStrictRateLimit(req, 3, 60 * 60 * 1000);
  if (limited) return limited;

  // ── Validate input ──────────────────────────────────────────────────────────
  let email: string;
  let company: string | undefined;
  try {
    const body = await req.json();
    const parsed = schema.parse(body);
    email = parsed.email;
    company = parsed.company;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid input.' },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // ── Persist to SQLite ───────────────────────────────────────────────────────
  let alreadyExists = false;
  try {
    await db.enterpriseWaitlist.create({ data: { email } });
  } catch (err: unknown) {
    // Prisma throws P2002 on unique constraint violation (duplicate email).
    const isPrismaUniqueError =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002';

    if (isPrismaUniqueError) {
      alreadyExists = true;
    } else {
      console.error('[waitlist/enterprise] db error:', err);
      return NextResponse.json({ error: 'Failed to save your signup. Please try again.' }, { status: 500 });
    }
  }

  // ── Send emails (best-effort — never fail the request over email) ──────────
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = 'PixSnug <onboarding@resend.dev>';

    if (!alreadyExists) {
      // Notify admin.
      await resend.emails.send({
        from: fromAddress,
        to: ADMIN_EMAIL,
        subject: `🏢 New Enterprise waitlist signup${company ? ` — ${company}` : ''}`,
        html: `
          <p><strong>${email}</strong> joined the Enterprise waitlist.</p>
          ${company ? `<p>Company: <strong>${company}</strong></p>` : ''}
        `,
      });

      // Confirm to user.
      await resend.emails.send({
        from: fromAddress,
        to: email,
        subject: "You're on the PixSnug Enterprise waitlist",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #111827;">
            <h2 style="font-weight: 600; letter-spacing: -0.02em; margin: 0 0 12px;">You're on the list.</h2>
            <p style="color: #6B7280; line-height: 1.7; margin: 0 0 14px;">
              Thanks for your interest in PixSnug Enterprise. We're building dedicated API access,
              higher rate limits, priority processing, and SLA-backed support.
            </p>
            <p style="color: #6B7280; line-height: 1.7; margin: 0 0 14px;">
              We'll reach out personally when Enterprise is ready for your team.
            </p>
            <p style="color: #6B7280; line-height: 1.7; margin: 0;">
              In the meantime, compress files at
              <a href="https://pixsnug.com" style="color: #2563EB;">pixsnug.com</a>.
            </p>
            <p style="color: #9CA3AF; font-size: 13px; margin-top: 32px; border-top: 1px solid #F3F4F6; padding-top: 16px;">
              — The PixSnug team
            </p>
          </div>
        `,
      });
    }
  } catch (emailErr) {
    // Log but don't surface email errors to the user — the DB record is the source of truth.
    console.warn('[waitlist/enterprise] email send failed (non-fatal):', emailErr);
  }

  return NextResponse.json({
    success: true,
    message: alreadyExists
      ? "You're already on the list — we'll be in touch soon."
      : "You're on the list! Check your inbox for a confirmation.",
  });
}
