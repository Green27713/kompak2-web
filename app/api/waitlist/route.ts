import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Notify you when someone joins
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "markgreenslade27713@gmail.com",
      subject: "New PixSnug waitlist signup",
      html: `<p><strong>${email}</strong> just joined the PixSnug waitlist.</p>`,
    });

    // Send confirmation to the user
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "You're on the PixSnug waitlist",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #1A1714;">
          <h2 style="font-weight: 500; letter-spacing: -0.02em;">You're on the list.</h2>
          <p style="color: #8C8580; line-height: 1.6;">Thanks for signing up for PixSnug early access. We'll reach out when batch compression, API access, and the WordPress plugin are ready.</p>
          <p style="color: #8C8580; line-height: 1.6;">In the meantime, keep compressing at <a href="https://pixsnug.com" style="color: #C4956A;">pixsnug.com</a></p>
          <p style="color: #C4BAB3; font-size: 13px; margin-top: 32px;">— The PixSnug team</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Waitlist error:", err);
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
  }
}
