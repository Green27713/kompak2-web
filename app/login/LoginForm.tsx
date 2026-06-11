'use client';

import { useState } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  expired:  'That sign-in link has expired or already been used. Request a new one below.',
  invalid:  'Invalid sign-in link. Request a new one below.',
  notfound: 'No Pro account found for that email. You may need to subscribe first.',
};

export default function LoginForm({ error }: { error?: string }) {
  const [email, setEmail]   = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>📬</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#F8FAFC', margin: '0 0 10px' }}>Check your email</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: '0 0 24px', lineHeight: 1.6 }}>
          We sent a sign-in link to{' '}
          <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{email}</strong>.
          <br />It expires in 15 minutes.
        </p>
        <button
          onClick={() => setStatus('idle')}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#F8FAFC', margin: '0 0 6px' }}>Sign in</h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', margin: '0 0 24px', lineHeight: 1.5 }}>
        Enter your email and we'll send you a sign-in link — no password needed.
      </p>

      {error && ERROR_MESSAGES[error] && (
        <div style={{ backgroundColor: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>
          {ERROR_MESSAGES[error]}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
          Email address
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          style={{
            width: '100%', padding: '10px 14px', boxSizing: 'border-box',
            backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, color: '#F8FAFC', fontSize: 14, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          style={{
            marginTop: 14, width: '100%', padding: '11px 0',
            background: status === 'loading' ? 'rgba(8,145,178,0.4)' : 'linear-gradient(135deg, #0891b2, #6d28d9)',
            color: '#FFFFFF', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 600, cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'opacity 0.15s',
          }}
        >
          {status === 'loading' ? 'Sending…' : 'Send sign-in link'}
        </button>

        {status === 'error' && (
          <p style={{ marginTop: 10, fontSize: 13, color: '#fca5a5', textAlign: 'center', margin: '10px 0 0' }}>
            Something went wrong. Please try again.
          </p>
        )}
      </form>
    </>
  );
}
