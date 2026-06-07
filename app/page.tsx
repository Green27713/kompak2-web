import { Suspense } from 'react';
import CompressionTool from '@/components/CompressionTool';
import SubscriptionWidget from '@/components/SubscriptionWidget';
import { getSession } from '@/lib/session';

export default async function Home() {
  // Read session on the server — no client-side cookie parse needed.
  const session = await getSession();
  const tier = session.tier ?? 'free';
  const email = session.email ?? '';

  const tierBadge: Record<typeof tier, { label: string; bg: string; color: string } | null> = {
    free:       null,
    pro:        { label: 'PRO',        bg: '#2563EB', color: '#FFFFFF' },
    enterprise: { label: 'ENTERPRISE', bg: '#0F172A', color: '#BFDBFE' },
  };
  const badge = tierBadge[tier];

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{
        backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E7EB',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href="/" style={{ textDecoration: 'none', fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
              PixSnug<sup style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400, marginLeft: 1 }}>™</sup>
            </a>
            {badge && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4,
                backgroundColor: badge.bg, color: badge.color,
              }}>
                {badge.label}
              </span>
            )}
          </div>
          <a
            href="https://ko-fi.com/pixsnug"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: 20, padding: '5px 14px', textDecoration: 'none' }}
          >
            ☕ Support
          </a>
        </div>
      </header>

      {/* Hero */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '48px 24px 8px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#2563EB', fontWeight: 500, marginBottom: 18 }}>
          🔒 Free · Private · No account needed
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#111827', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          Compress Images &amp; Videos
        </h1>
        <p style={{ fontSize: 16, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
          Up to 2 GB. JPEG · PNG · HEIC · MP4 · WebM. Files deleted from server instantly.
        </p>
      </div>

      {/* Tool */}
      <CompressionTool />

      {/* Subscription widget — upgrade or manage billing */}
      {/* useSearchParams inside SubscriptionWidget requires Suspense boundary */}
      <Suspense fallback={null}>
        <SubscriptionWidget tier={tier} email={email} />
      </Suspense>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #E5E7EB', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>© 2025 PixSnug™ — Built by a Navy veteran in Patong, Thailand</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9CA3AF' }}>Files are never stored, logged, or shared.</p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9CA3AF' }}>
          <a href="/privacy" style={{ color: '#9CA3AF', textDecoration: 'underline' }}>Privacy Policy</a>
          {' · '}
          <a href="/terms" style={{ color: '#9CA3AF', textDecoration: 'underline' }}>Terms of Service</a>
          {' · '}
          <a href="mailto:privacy@pixsnug.com" style={{ color: '#9CA3AF', textDecoration: 'underline' }}>Contact</a>
        </p>
      </footer>

    </main>
  );
}
