import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — PixSnug',
  description: 'Terms of Service for PixSnug file compression tool.',
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
  footer: { borderTop: '1px solid #E5E7EB', padding: '28px 24px', textAlign: 'center' as const },
  footerText: { margin: 0, fontSize: 12, color: '#9CA3AF' } as React.CSSProperties,
};

export default function TermsPage() {
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
        <h1 style={S.h1}>Terms of Service</h1>
        <p style={S.updated}>Last updated: June 2025</p>

        <h2 style={S.h2}>1. Acceptance of Terms</h2>
        <p style={S.p}>
          By using PixSnug ("the Service", available at pixsnug.com), you agree to these Terms of Service. If you do not agree, please do not use the Service.
        </p>

        <h2 style={S.h2}>2. Description of Service</h2>
        <p style={S.p}>
          PixSnug provides free, browser-based and server-side file compression for images and videos. The Service is provided "as is" and may change or be discontinued at any time without notice.
        </p>

        <h2 style={S.h2}>3. Acceptable Use</h2>
        <p style={S.p}>You may use PixSnug only for lawful purposes. You agree not to:</p>
        <ul style={S.ul}>
          <li>Upload files you do not have the right to compress or distribute</li>
          <li>Upload illegal content, including content that violates copyright, contains malware, or depicts illegal activity</li>
          <li>Attempt to exceed rate limits, reverse-engineer, or disrupt the Service</li>
          <li>Use the Service for any commercial purpose that involves reselling access to the Service</li>
        </ul>

        <h2 style={S.h2}>4. Your Files</h2>
        <p style={S.p}>
          You retain full ownership of any files you upload. By uploading a file, you grant us a temporary, limited license solely to process and return the compressed version to you. We do not claim any rights to your content.
        </p>
        <p style={S.p}>
          Files are deleted from our servers immediately after download or within 60 minutes, whichever comes first. See our <Link href="/privacy" style={{ color: '#2563EB' }}>Privacy Policy</Link> for the full Zero-Retention architecture.
        </p>

        <h2 style={S.h2}>5. No Warranties</h2>
        <p style={S.p}>
          THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE ERROR-FREE, UNINTERRUPTED, OR THAT COMPRESSED FILES WILL MEET YOUR REQUIREMENTS.
        </p>
        <p style={S.p}>
          You are responsible for keeping backups of your original files. We recommend always retaining your originals before compressing.
        </p>

        <h2 style={S.h2}>6. Limitation of Liability</h2>
        <p style={S.p}>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, PIXSNUG SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA OR FILES, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.
        </p>

        <h2 style={S.h2}>7. Intellectual Property</h2>
        <p style={S.p}>
          The PixSnug name, logo, and website design are our intellectual property. The underlying software is built on open-source components including FFmpeg (LGPL), Sharp, and Next.js. Their respective licenses apply.
        </p>

        <h2 style={S.h2}>8. Service Availability</h2>
        <p style={S.p}>
          We make no uptime guarantees. The Service may be unavailable due to maintenance, technical issues, or any other reason. We are not responsible for any loss resulting from downtime.
        </p>

        <h2 style={S.h2}>9. File Size and Rate Limits</h2>
        <p style={S.p}>
          The Service currently supports files up to 2 GB for videos and 50 MB for images. Rate limits are enforced per IP address. We reserve the right to change these limits at any time.
        </p>

        <h2 style={S.h2}>10. Changes to Terms</h2>
        <p style={S.p}>
          We may update these Terms at any time. The "Last updated" date will reflect changes. Continued use of the Service after changes constitutes your acceptance of the updated Terms.
        </p>

        <h2 style={S.h2}>11. Governing Law</h2>
        <p style={S.p}>
          These Terms are governed by the laws of Thailand, without regard to conflict of law principles, reflecting where the Service is operated from.
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
