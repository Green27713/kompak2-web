'use client';

import { useState, useCallback } from 'react';

type Tier = 'free' | 'pro' | 'enterprise';

export default function NavActions({ tier, email }: { tier: Tier; email: string }) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'pro', email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // fall through
    } finally {
      setLoading(false);
    }
  }, [email]);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <a
        href="https://ko-fi.com/pixsnug"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 20,
          padding: '5px 14px',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        ☕ Support
      </a>
      {tier === 'free' && (
        <>
          <a
            href="/login"
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', whiteSpace: 'nowrap', padding: '5px 4px' }}
          >
            Sign in
          </a>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#FFFFFF',
              background: 'linear-gradient(135deg, #0891b2, #6d28d9)',
              border: 'none',
              borderRadius: 20,
              padding: '6px 16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Loading…' : 'Upgrade to Pro →'}
          </button>
        </>
      )}
      {tier !== 'free' && (
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20 }}>
          {tier === 'pro' ? '⭐ Pro' : '🏢 Enterprise'}
        </span>
      )}
    </div>
  );
}
