import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — PixSnug',
  description: 'How PixSnug handles your files: zero retention, ephemeral server processing, no logging.',
};

const S = {
  page: { minHeight: '100vh', backgroundColor: '#F9FAFB', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  header: { backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E7EB', position: 'sticky' as const, top: 0, zIndex: 10 },
  headerInner: { maxWidth: 700, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { textDecoration: 'none', fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' } as React.CSSProperties,
  body: { maxWidth: 700, margin: '0 auto', padding: '48px 24px 80px' },
  h1: { fontSize: 28, fontWeight: 700, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.02em' } as React.CSSProperties,
  updated: { fontSize: 13, color: '#9CA3AF', margin: '0 0 40px' } as React.CSSProperties,
  h2: { fontSize: 17, fontWeight: 600, color: '#111827', margin: '36px 0 10px' } as React.CSSProperties,
  p: { fontSize: 15, color: '#374151', lineHeight: 1.7, margin: '0 0 14px' } as React.CSSProperties,
  ul: { fontSize: 15, color: '#374151', lineHeight: 1.7, margin: '0 0 14px', paddingLeft: 22 } as React.CSSProperties,
  highlight: { backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 18px', marginBottom: 32 },
  highlightText: { fontSize: 15, color: '#1D4ED8', fontWeight: 600, margin: 0 } as React.CSSProperties,
  footer: { borderTop: '1px solid #E5E7EB', padding: '28px 24px', textAlign: 'center' as const },
  footerText: { margin: 0, fontSize: 12, color: '#9CA3AF' } as React.CSSProperties,
};

export default function PrivacyPage() {
  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.headerInner}>
          <Link href="/" style={S.logo}>
            PixSnug<sup style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400, marginLeft: 1 }}>™</sup>
          </Link>
          <Link href="/" style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none' }}>← Back</Link>
        </div>
      </header>

      <div style={S.body}>
        <h1 style={S.h1}>Privacy Policy</h1>
        <p style={S.updated}>Last updated: June 2026</p>

        <div style={S.highlight}>
          <p style={S.highlightText}>
            🔒 Zero-Retention Guarantee (Free tier) — PixSnug does not store, log, sell, or share your files. Files uploaded for video compression are deleted from our server the moment your download completes, or within 60 minutes at the latest. Pro and Enterprise tiers collect an email address for billing and notifications only — see Section 8 below.
          </p>
        </div>

        <h2 style={S.h2}>1. Who We Are</h2>
        <p style={S.p}>
          PixSnug ("we", "us", "our") is a file compression tool available at pixsnug.com, operated as an independent project. It offers a Free tier and paid Pro and Enterprise tiers with higher file size limits.
        </p>

        <h2 style={S.h2}>2. What Files We Process</h2>
        <p style={S.p}><strong>Images (JPEG, PNG, WebP, HEIC):</strong> Compressed entirely within your browser using client-side JavaScript. Your image files are never uploaded to our server.</p>
        <p style={S.p}><strong>Videos (MP4, MOV, WebM):</strong> Uploaded to our server for FFmpeg compression, then immediately deleted after you download the result. If you do not download within 60 minutes, the file is automatically purged by our cleanup scheduler.</p>

        <h2 style={S.h2}>3. Zero-Retention Architecture</h2>
        <p style={S.p}>When you upload a video, our server:</p>
        <ul style={S.ul}>
          <li>Writes your file to a temporary directory in <code>/tmp</code></li>
          <li>Runs FFmpeg compression in a background process</li>
          <li>Serves you the compressed result via a one-time download link</li>
          <li>Deletes the temporary files immediately after your download completes</li>
          <li>Runs an automated cleanup every 10 minutes to remove any files older than 60 minutes</li>
        </ul>
        <p style={S.p}>We do not write your files to any database, object storage, backup system, or persistent disk location.</p>

        <h2 style={S.h2}>4. Information We Collect (by Plan)</h2>
        <p style={S.p}><strong>Free tier:</strong> We collect no personal information. No name, no email, no account. No sign-up or login required.</p>
        <p style={S.p}><strong>Pro and Enterprise tiers:</strong> We collect your email address when you subscribe. This is used solely for billing receipts, job completion notifications, and essential service updates. We do not sell this data or use it for advertising.</p>
        <p style={S.p}>Across all plans:</p>
        <ul style={S.ul}>
          <li>We do not use cookies or tracking pixels</li>
          <li>We do not use Google Analytics or any third-party analytics</li>
          <li>We do not log the content of your files</li>
        </ul>

        <h2 style={S.h2}>5. Server Logs</h2>
        <p style={S.p}>
          Our web server (Caddy) may retain standard access logs (IP address, request path, timestamp, HTTP status code) for a short period for security and abuse prevention purposes. These logs do not contain your file content and are not linked to your identity.
        </p>

        <h2 style={S.h2}>6. Rate Limiting</h2>
        <p style={S.p}>
          We use Redis-based rate limiting keyed to your IP address to prevent abuse. IP addresses are held in memory only and are not written to persistent storage.
        </p>

        <h2 style={S.h2}>7. Third-Party Services (Free Tier)</h2>
        <p style={S.p}>
          On the Free tier, PixSnug does not use third-party advertising, analytics, or data brokers. The optional "Support" link points to Ko-fi, which has its own privacy policy.
        </p>

        <h2 style={S.h2}>8. Pro and Enterprise Tiers</h2>
        <p style={S.p}>
          Pro and Enterprise plans unlock higher file size limits (2 GB and 5 GB respectively) and priority processing. Subscribing to a paid plan involves two additional third-party services:
        </p>
        <p style={S.p}><strong>Payment Processing — Stripe:</strong> All payments are processed by Stripe, Inc. We do not store your credit card number or billing address on our servers. Stripe receives your payment details and billing information directly. Stripe may retain this data in accordance with their own privacy policy. You can review it at stripe.com/privacy.</p>
        <p style={S.p}><strong>Email Delivery — Resend:</strong> We use Resend to send transactional emails such as billing receipts and compression job notifications. Your email address is shared with Resend solely to deliver these messages. Resend does not use your email for advertising. You can review Resend's privacy policy at resend.com/legal/privacy-policy.</p>
        <p style={S.p}>
          Your email address is retained for as long as you hold an active paid subscription. Upon cancellation, your email and account record are deleted within 30 days. You may request immediate deletion by emailing us at <a href="mailto:privacy@pixsnug.com" style={{ color: '#2563EB' }}>privacy@pixsnug.com</a>.
        </p>
        <p style={S.p}>The Zero-Retention Guarantee for uploaded files applies equally to all plans — files are never stored beyond your active session.</p>

        <h2 style={S.h2}>9. Children's Privacy</h2>
        <p style={S.p}>
          PixSnug is not directed at children under 13. We do not knowingly collect information from children. Paid tiers require users to be at least 18 years old or have parental consent.
        </p>

        <h2 style={S.h2}>10. Your Rights</h2>
        <p style={S.p}><strong>Free tier:</strong> Because we collect no personal data and retain no files, there is nothing to access, correct, or delete.</p>
        <p style={S.p}><strong>Pro and Enterprise tiers:</strong> You have the right to access, correct, or delete your email address and subscription record at any time. To exercise these rights, email us at <a href="mailto:privacy@pixsnug.com" style={{ color: '#2563EB' }}>privacy@pixsnug.com</a>. If you are in the EU or UK, you also have the right to lodge a complaint with your local data protection authority.</p>

        <h2 style={S.h2}>11. Changes to This Policy</h2>
        <p style={S.p}>
          We may update this policy from time to time. The "Last updated" date at the top of this page will reflect any changes. Continued use of PixSnug after changes constitutes acceptance.
        </p>

        <h2 style={S.h2}>12. Contact</h2>
        <p style={S.p}>
          Questions? Email us at: <a href="mailto:privacy@pixsnug.com" style={{ color: '#2563EB' }}>privacy@pixsnug.com</a>
        </p>
      </div>

      <footer style={S.footer}>
        <p style={S.footerText}>© 2025 PixSnug™ &nbsp;·&nbsp; <Link href="/privacy" style={{ color: '#9CA3AF' }}>Privacy</Link> &nbsp;·&nbsp; <Link href="/terms" style={{ color: '#9CA3AF' }}>Terms</Link></p>
      </footer>
    </div>
  );
}
