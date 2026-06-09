'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

type Tier = 'free' | 'pro' | 'enterprise';

interface Props {
  tier: Tier;
  email: string;
}

const TIER_LABELS: Record<Tier, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const TIER_LIMITS: Record<Tier, string> = {
  free: '600 MB files · 10 req/min',
  pro: '2 GB files · 100 req/min',
  enterprise: '5 GB files · 500 req/min',
};

type Toast = { type: 'success' | 'error' | 'info'; text: string } | null;

export default function SubscriptionWidget({ tier, email }: Props) {
  const [loading, setLoading] = useState<'checkout' | 'portal' | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read Stripe redirect outcome from URL params and show a toast.
  useEffect(() => {
    const status = searchParams.get('checkout');
    if (!status) return;

    if (status === 'success') {
      setToast({ type: 'success', text: "You're now on Pro! Your new limits are active." });
    } else if (status === 'cancelled') {
      setToast({ type: 'info', text: 'Checkout cancelled — no charge was made.' });
    } else if (status === 'unpaid' || status === 'error') {
      setToast({ type: 'error', text: 'Something went wrong with checkout. Please try again.' });
    }

    // Strip the param from the URL so refresh doesn't re-show the toast.
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    router.replace(url.pathname + (url.search || ''), { scroll: false });
  }, [searchParams, router]);

  const handleUpgrade = useCallback(async (selectedTier: 'pro' | 'enterprise' = 'pro') => {
    setLoading('checkout');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selectedTier, email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setToast({ type: 'error', text: data.error ?? 'Could not start checkout. Please try again.' });
        setLoading(null);
      }
    } catch {
      setToast({ type: 'error', text: 'Network error. Please check your connection.' });
      setLoading(null);
    }
  }, [email]);

  const handleManage = useCallback(async () => {
    setLoading('portal');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setToast({ type: 'error', text: data.error ?? 'Could not open billing portal. Please try again.' });
        setLoading(null);
      }
    } catch {
      setToast({ type: 'error', text: 'Network error. Please check your connection.' });
      setLoading(null);
    }
  }, []);

  const toastColors: Record<NonNullable<Toast>['type'], { bg: string; text: string; border: string }> = {
    success: { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC' },
    error:   { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' },
    info:    { bg: '#FFFBEB', text: '#92400E', border: '#FCD34D' },
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px 24px', position: 'relative', zIndex: 1 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          backgroundColor: toastColors[toast.type].bg,
          border: `1px solid ${toastColors[toast.type].border}`,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <span style={{ fontSize: 13, color: toastColors[toast.type].text, fontWeight: 500 }}>
            {toast.type === 'success' ? '✓ ' : toast.type === 'error' ? '✕ ' : 'ℹ '}{toast.text}
          </span>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: toastColors[toast.type].text, fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* Card */}
      {tier === 'free' ? (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14,
          padding: '20px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#F8FAFC' }}>Free Plan</span>
              <span style={{ fontSize: 11, backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', padding: '1px 7px', borderRadius: 4, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Current
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{TIER_LIMITS.free}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => handleUpgrade('pro')}
              disabled={loading === 'checkout'}
              style={{
                padding: '9px 18px',
                background: loading === 'checkout' ? 'rgba(8,145,178,0.4)' : 'linear-gradient(135deg, #0891b2, #6d28d9)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: loading === 'checkout' ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                opacity: loading === 'checkout' ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading === 'checkout' ? 'Loading…' : 'Upgrade to Pro →'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          background: tier === 'enterprise' ? 'rgba(109,28,217,0.12)' : 'rgba(8,145,178,0.1)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${tier === 'enterprise' ? 'rgba(167,139,250,0.25)' : 'rgba(34,211,238,0.25)'}`,
          borderRadius: 14,
          padding: '20px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC' }}>
                {TIER_LABELS[tier]} Plan
              </span>
              <span style={{
                fontSize: 11,
                backgroundColor: tier === 'enterprise' ? 'rgba(109,28,217,0.4)' : 'rgba(8,145,178,0.35)',
                color: tier === 'enterprise' ? '#c4b5fd' : '#67e8f9',
                padding: '1px 7px',
                borderRadius: 4,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                {tier === 'enterprise' ? 'Enterprise' : 'Pro'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
              {TIER_LIMITS[tier]}
              {email && <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.3)' }}>· {email}</span>}
            </p>
          </div>
          <button
            onClick={handleManage}
            disabled={loading === 'portal'}
            style={{
              padding: '9px 18px',
              backgroundColor: 'transparent',
              color: tier === 'enterprise' ? '#c4b5fd' : '#67e8f9',
              border: `1.5px solid ${tier === 'enterprise' ? 'rgba(167,139,250,0.3)' : 'rgba(34,211,238,0.3)'}`,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading === 'portal' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              opacity: loading === 'portal' ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loading === 'portal' ? 'Loading…' : 'Manage Subscription'}
          </button>
        </div>
      )}

      {/* Upsell teaser for free users */}
      {tier === 'free' && (
        <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          Pro: 2 GB videos · 100 req/min · $9/mo
        </p>
      )}
    </div>
  );
}
