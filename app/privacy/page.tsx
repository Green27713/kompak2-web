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
        <p style={S.updated}>Last updated: June 2025</p>

        <div style={S.highlight}>
          <p style={S.highlightText}>
            🔒 Zero-Retention Guarantee — PixSnug does not store, log, sell, or share your files or personal data. Files uploaded for video compression are deleted from our server the moment your download completes, or within 60 minutes at the latest.
          </p>
        </div>

        <h2 style={S.h2}>1. Who We Are</h2>
        <p style={S.p}>
          PixSnug ("we", "us", "our") is a free file compression tool available at pixsnug.com. It is operated as an independent project.
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

        <h2 style={S.h2}>4. Information We Do Not Collect</h2>
        <ul style={S.ul}>
          <li>We do not collect your name, email address, or any account information</li>
          <li>We do not require sign-up or login</li>
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

        <h2 style={S.h2}>7. Third-Party Services</h2>
        <p style={S.p}>
          PixSnug does not use third-party advertising, analytics, or data brokers. The optional "Support" link points to Ko-fi, which has its own privacy policy.
        </p>

        <h2 style={S.h2}>8. Children's Privacy</h2>
        <p style={S.p}>
          PixSnug is not directed at children under 13. We do not knowingly collect information from children.
        </p>

        <h2 style={S.h2}>9. Your Rights</h2>
        <p style={S.p}>
          Because we collect no personal data and retain no files, there is nothing to access, correct, or delete. If you have concerns, contact us at the address below.
        </p>

        <h2 style={S.h2}>10. Changes to This Policy</h2>
        <p style={S.p}>
          We may update this policy from time to time. The "Last updated" date at the top of this page will reflect any changes. Continued use of PixSnug after changes constitutes acceptance.
        </p>

        <h2 style={S.h2}>11. Contact</h2>
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
