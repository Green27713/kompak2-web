import { Suspense } from 'react';
import CompressionTool from '@/components/CompressionTool';
import SubscriptionWidget from '@/components/SubscriptionWidget';
import NavActions from '@/components/NavActions';
import { getSession } from '@/lib/session';

export default async function Home() {
  let tier: 'free' | 'pro' | 'enterprise' = 'free';
  let email = '';
  try {
    const session = await getSession();
    tier = session.tier ?? 'free';
    email = session.email ?? '';
  } catch {
    // SESSION_PASSWORD not configured — degrades to free tier.
  }

  const tierBadge: Record<typeof tier, { label: string; bg: string; color: string } | null> = {
    free:       null,
    pro:        { label: 'PRO',        bg: 'rgba(8,145,178,0.25)',  color: '#67e8f9' },
    enterprise: { label: 'ENTERPRISE', bg: 'rgba(109,28,217,0.3)', color: '#c4b5fd' },
  };
  const badge = tierBadge[tier];

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#080d1c', fontFamily: "'Inter', system-ui, sans-serif", position: 'relative', overflowX: 'hidden' }}>

      {/* Aurora background orbs */}
      <div className="aurora-bg" aria-hidden="true">
        <div className="aurora-orb aurora-orb-1" />
        <div className="aurora-orb aurora-orb-2" />
        <div className="aurora-orb aurora-orb-3" />
      </div>

      {/* Nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(8,13,28,0.75)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '13px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 0 }}>
              <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: '#F8FAFC', lineHeight: 1 }}>
                Pix
              </span>
              <span style={{
                fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1,
                background: 'linear-gradient(135deg, #22d3ee, #a78bfa)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Snug
              </span>
              <sup style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginLeft: 2, verticalAlign: 'super', lineHeight: 1 }}>™</sup>
            </a>
            {badge && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4,
                backgroundColor: badge.bg, color: badge.color,
              }}>
                {badge.label}
              </span>
            )}
          </div>
          <NavActions tier={tier} email={email} />
        </div>
      </header>

      {/* Hero */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 24px 0', textAlign: 'center', position: 'relative', zIndex: 1 }}>

        {/* Pill badge — copy and colour vary by tier */}
        {tier === 'free' && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            backgroundColor: 'rgba(8,145,178,0.1)',
            border: '1px solid rgba(8,145,178,0.35)',
            borderRadius: 20, padding: '5px 14px',
            fontSize: 12, color: '#67e8f9', fontWeight: 500, marginBottom: 22,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22d3ee', flexShrink: 0, display: 'inline-block' }} />
            Zero-retention · Files deleted instantly
          </div>
        )}
        {tier === 'pro' && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            backgroundColor: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.35)',
            borderRadius: 20, padding: '5px 14px',
            fontSize: 12, color: '#86efac', fontWeight: 500, marginBottom: 22,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0, display: 'inline-block' }} />
            Zero-retention · 2 GB limit · Priority processing
          </div>
        )}
        {tier === 'enterprise' && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            backgroundColor: 'rgba(167,139,250,0.1)',
            border: '1px solid rgba(167,139,250,0.35)',
            borderRadius: 20, padding: '5px 14px',
            fontSize: 12, color: '#c4b5fd', fontWeight: 500, marginBottom: 22,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#a78bfa', flexShrink: 0, display: 'inline-block' }} />
            Zero-retention · 5 GB limit · Priority processing
          </div>
        )}

        <h1 style={{
          fontSize: 'clamp(2rem, 5.5vw, 3.5rem)',
          fontWeight: 800,
          color: '#F8FAFC',
          margin: '0 0 14px',
          letterSpacing: '-0.035em',
          lineHeight: 1.08,
        }}>
          Compress Images &amp; Videos
        </h1>
        <p style={{ fontSize: 16, color: '#94A3B8', margin: '0 0 36px', lineHeight: 1.65 }}>
          {tier === 'enterprise'
            ? 'Up to 5 GB. JPEG · PNG · HEIC · MP4 · WebM. Files deleted from server instantly.'
            : tier === 'pro'
            ? 'Up to 2 GB. JPEG · PNG · HEIC · MP4 · WebM. Files deleted from server instantly.'
            : 'Up to 600 MB. JPEG · PNG · HEIC · MP4 · WebM. Files deleted from server instantly.'}
        </p>
      </div>

      {/* Glassmorphism tool card */}
      <div style={{ maxWidth: 650, margin: '0 auto', padding: '0 20px', position: 'relative', zIndex: 1 }}>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
          borderRadius: 24,
          overflow: 'hidden',
        }}>
          <CompressionTool />
        </div>
      </div>

      {/* Trust strip */}
      <div style={{ maxWidth: 600, margin: '24px auto 0', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 20px' }}>
          {['No signup required', 'Files never stored', 'Private & secure', 'Built by a Navy veteran'].map(text => (
            <span key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#22d3ee', flexShrink: 0 }} />
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* Subscription widget */}
      <Suspense fallback={null}>
        <SubscriptionWidget tier={tier} email={email} />
      </Suspense>

      {/* Enterprise glass strip */}
      <div style={{ maxWidth: 600, margin: '0 auto 36px', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <div style={{
          background: 'rgba(109,28,217,0.08)',
          border: '1px solid rgba(167,139,250,0.2)',
          borderRadius: 14,
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#a78bfa',
              backgroundColor: 'rgba(109,28,217,0.3)',
              padding: '2px 8px', borderRadius: 4,
            }}>
              Enterprise
            </span>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>Higher limits, dedicated support, custom API access.</span>
          </div>
          <a href="/enterprise" style={{ fontSize: 13, fontWeight: 600, color: '#c4b5fd', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Join waitlist →
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ margin: 0, fontSize: 12, color: '#334155' }}>© 2025 PixSnug™ — Built by a Navy veteran in Patong, Thailand</p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#334155' }}>
          <a href="/privacy" style={{ color: '#475569', textDecoration: 'underline' }}>Privacy Policy</a>
          {' · '}
          <a href="/terms" style={{ color: '#475569', textDecoration: 'underline' }}>Terms of Service</a>
          {' · '}
          <a href="mailto:privacy@pixsnug.com" style={{ color: '#475569', textDecoration: 'underline' }}>Contact</a>
        </p>
      </footer>

    </main>
  );
}
