import { getSession } from '@/lib/session';

export default async function SuccessPage() {
  let email = '';
  try {
    const session = await getSession();
    email = session.email ?? '';
  } catch {}

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>

        {/* Icon */}
        <div style={{ fontSize: 56, marginBottom: 20, lineHeight: 1 }}>🎉</div>

        {/* Heading */}
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          Welcome to PixSnug Pro!
        </h1>

        {/* Sub-heading */}
        <p style={{ fontSize: 16, color: '#6B7280', margin: '0 0 32px', lineHeight: 1.6 }}>
          Your subscription is active.
          {email && (
            <> A confirmation will be sent to <strong style={{ color: '#374151' }}>{email}</strong>.</>
          )}
        </p>

        {/* Feature list */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 14,
          padding: '24px',
          marginBottom: 28,
          textAlign: 'left',
        }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            What you unlocked
          </p>
          {[
            ['📁', '2 GB video file limit', 'Up from 600 MB on the free plan'],
            ['⚡', '100 requests / minute', 'Up from 10 on the free plan'],
            ['🖼️', 'Unlimited image compression', 'JPEG · PNG · HEIC · WebP'],
            ['🔒', 'Zero-retention processing', 'Files deleted from server instantly'],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 18, lineHeight: 1.4, flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{title}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <a
          href="/"
          style={{
            display: 'inline-block',
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
            padding: '12px 28px',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          Start compressing →
        </a>

        <p style={{ marginTop: 20, fontSize: 12, color: '#9CA3AF' }}>
          Manage your subscription anytime from the home page.
        </p>

      </div>
    </main>
  );
}
