import type { Metadata } from 'next';
import Link from 'next/link';
import EnterpriseWaitlistForm from '@/components/EnterpriseWaitlistForm';

export const metadata: Metadata = {
  title: 'Enterprise API — PixSnug',
  description:
    'PixSnug Enterprise: dedicated API access, 5 GB file limits, 500 req/min, priority processing, SLA-backed support, and custom integrations. Join the waitlist.',
};

const features = [
  {
    icon: '⚡',
    title: '500 req / min',
    body: 'Enterprise rate limits are 50× higher than Free. Process at scale without throttling.',
  },
  {
    icon: '📦',
    title: 'Up to 5 GB per file',
    body: 'No file is too large. Compress full-length films, raw drone footage, and broadcast assets.',
  },
  {
    icon: '🔌',
    title: 'REST API access',
    body: 'Authenticated API keys for programmatic compression. Integrate PixSnug into your own pipelines and products.',
  },
  {
    icon: '🚀',
    title: 'Priority processing',
    body: 'Enterprise jobs run on dedicated worker capacity — no queue delays during peak hours.',
  },
  {
    icon: '🛡️',
    title: 'SLA guarantee',
    body: '99.9% uptime SLA with incident response and escalation paths for production workloads.',
  },
  {
    icon: '🤝',
    title: 'Dedicated support',
    body: 'Direct Slack channel with the engineering team. Custom FFmpeg presets available on request.',
  },
];

const tiers = [
  { name: 'Free', limit: '600 MB', rate: '10 req/min', price: '$0', highlight: false },
  { name: 'Pro', limit: '2 GB', rate: '100 req/min', price: '$9/mo', highlight: false },
  { name: 'Enterprise', limit: '5 GB', rate: '500 req/min', price: 'Contact us', highlight: true },
];

export default function EnterprisePage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ textDecoration: 'none', fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
            PixSnug<sup style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400, marginLeft: 1 }}>™</sup>
          </Link>
          <Link href="/" style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none' }}>
            ← Back to app
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div style={{ backgroundColor: '#0F172A', color: '#FFFFFF', padding: '72px 24px 80px', textAlign: 'center' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <span style={{ display: 'inline-block', backgroundColor: '#1E40AF', color: '#BFDBFE', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 20, marginBottom: 20 }}>
            Coming Soon
          </span>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 18px', lineHeight: 1.15 }}>
            PixSnug Enterprise
          </h1>
          <p style={{ fontSize: 18, color: '#94A3B8', lineHeight: 1.7, margin: '0 0 36px' }}>
            Programmatic compression at scale. Dedicated API keys, 5 GB file limits,
            500 requests per minute, priority processing, and SLA-backed support —
            built for teams that ship.
          </p>
          <a
            href="#waitlist"
            style={{ display: 'inline-block', backgroundColor: '#2563EB', color: '#FFFFFF', padding: '14px 32px', borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none', letterSpacing: '-0.01em' }}
          >
            Request Early Access
          </a>
        </div>
      </div>

      {/* Feature grid */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '64px 24px 0' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: '#111827', textAlign: 'center', letterSpacing: '-0.02em', margin: '0 0 8px' }}>
          Built for production workloads
        </h2>
        <p style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', margin: '0 0 48px' }}>
          Everything in Pro, plus the infrastructure your team actually needs.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {features.map((f) => (
            <div
              key={f.title}
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '24px 22px' }}
            >
              <div style={{ fontSize: 26, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.65, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison table */}
      <div style={{ maxWidth: 680, margin: '64px auto 0', padding: '0 24px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', textAlign: 'center', letterSpacing: '-0.02em', margin: '0 0 28px' }}>
          Plan comparison
        </h2>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                {['Plan', 'Max file size', 'Rate limit', 'Price'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiers.map((t, i) => (
                <tr
                  key={t.name}
                  style={{
                    borderBottom: i < tiers.length - 1 ? '1px solid #F3F4F6' : 'none',
                    backgroundColor: t.highlight ? '#EFF6FF' : 'transparent',
                  }}
                >
                  <td style={{ padding: '14px 16px', fontWeight: t.highlight ? 700 : 500, color: t.highlight ? '#1D4ED8' : '#111827' }}>
                    {t.name}
                    {t.highlight && (
                      <span style={{ marginLeft: 8, fontSize: 10, backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '1px 6px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', verticalAlign: 'middle' }}>
                        New
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#374151' }}>{t.limit}</td>
                  <td style={{ padding: '14px 16px', color: '#374151' }}>{t.rate}</td>
                  <td style={{ padding: '14px 16px', color: '#374151', fontWeight: t.highlight ? 600 : 400 }}>{t.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Waitlist form */}
      <div id="waitlist" style={{ maxWidth: 480, margin: '64px auto 0', padding: '0 24px 80px' }}>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: '36px 32px' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Request early access
          </h2>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.6 }}>
            We're onboarding Enterprise customers in batches. Leave your email and we'll reach out personally when your spot is ready.
          </p>
          <EnterpriseWaitlistForm />
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#9CA3AF', margin: '20px 0 0' }}>
          Already on Pro?{' '}
          <Link href="/" style={{ color: '#2563EB', textDecoration: 'none' }}>
            Manage your subscription →
          </Link>
        </p>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #E5E7EB', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>
          © 2025 PixSnug™ &nbsp;·&nbsp;
          <Link href="/privacy" style={{ color: '#9CA3AF' }}>Privacy</Link>
          &nbsp;·&nbsp;
          <Link href="/terms" style={{ color: '#9CA3AF' }}>Terms</Link>
        </p>
      </footer>

    </div>
  );
}
