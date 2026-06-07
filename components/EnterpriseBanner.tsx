import Link from 'next/link';

// Persistent top banner injected into app/layout.tsx above {children}.
// Server Component — no interactivity needed, renders on every page.
export default function EnterpriseBanner() {
  return (
    <div
      style={{
        backgroundColor: '#0F172A',
        color: '#E2E8F0',
        textAlign: 'center',
        padding: '9px 24px',
        fontSize: 13,
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        letterSpacing: '-0.01em',
      }}
    >
      <span
        style={{
          backgroundColor: '#1D4ED8',
          color: '#BFDBFE',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '2px 7px',
          borderRadius: 4,
        }}
      >
        Coming Soon
      </span>
      <span style={{ color: '#CBD5E1' }}>
        Enterprise API Integration — higher limits, dedicated support, custom access.
      </span>
      <Link
        href="/enterprise"
        style={{
          color: '#60A5FA',
          fontWeight: 600,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Join the waitlist →
      </Link>
    </div>
  );
}
