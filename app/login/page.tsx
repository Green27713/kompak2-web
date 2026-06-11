import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in — PixSnug' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={{
      minHeight: '100vh', backgroundColor: '#080d1c',
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <a href="/" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 32 }}>
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', color: '#F8FAFC' }}>Pix</span>
          <span style={{
            fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em',
            background: 'linear-gradient(135deg, #22d3ee, #a78bfa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>Snug</span>
        </a>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 16, padding: '32px 28px',
        }}>
          <LoginForm error={error} />
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 20 }}>
          New here?{' '}
          <a href="/" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>
            Upgrade to Pro
          </a>
        </p>

      </div>
    </main>
  );
}
