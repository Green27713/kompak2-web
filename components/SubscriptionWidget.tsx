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
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px 32px' }}>

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
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
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
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Free Plan</span>
              <span style={{ fontSize: 11, backgroundColor: '#F3F4F6', color: '#6B7280', padding: '1px 7px', borderRadius: 4, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Current
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>{TIER_LIMITS.free}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => handleUpgrade('pro')}
              disabled={loading === 'checkout'}
              style={{
                padding: '9px 18px',
                backgroundColor: loading === 'checkout' ? '#93C5FD' : '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: loading === 'checkout' ? 'not-allowed' : 'pointer',
                fontFamily: 'system-ui, sans-serif',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.15s',
              }}
            >
              {loading === 'checkout' ? 'Loading…' : 'Upgrade to Pro →'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          backgroundColor: tier === 'enterprise' ? '#0F172A' : '#EFF6FF',
          border: `1px solid ${tier === 'enterprise' ? '#1E293B' : '#BFDBFE'}`,
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
              <span style={{ fontSize: 14, fontWeight: 700, color: tier === 'enterprise' ? '#F1F5F9' : '#1D4ED8' }}>
                {TIER_LABELS[tier]} Plan
              </span>
              <span style={{
                fontSize: 11,
                backgroundColor: tier === 'enterprise' ? '#1E40AF' : '#2563EB',
                color: '#BFDBFE',
                padding: '1px 7px',
                borderRadius: 4,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                {tier === 'enterprise' ? 'Enterprise' : 'Pro'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: tier === 'enterprise' ? '#94A3B8' : '#3B82F6' }}>
              {TIER_LIMITS[tier]}
              {email && <span style={{ marginLeft: 8, color: tier === 'enterprise' ? '#64748B' : '#93C5FD' }}>· {email}</span>}
            </p>
          </div>
          <button
            onClick={handleManage}
            disabled={loading === 'portal'}
            style={{
              padding: '9px 18px',
              backgroundColor: 'transparent',
              color: tier === 'enterprise' ? '#CBD5E1' : '#1D4ED8',
              border: `1.5px solid ${tier === 'enterprise' ? '#334155' : '#BFDBFE'}`,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading === 'portal' ? 'not-allowed' : 'pointer',
              fontFamily: 'system-ui, sans-serif',
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
        <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>
          Pro: 2 GB videos · 100 req/min · $9/mo &nbsp;·&nbsp;{' '}
          <a href="/enterprise" style={{ color: '#9CA3AF', textDecoration: 'underline' }}>
            Enterprise →
          </a>
        </p>
      )}
    </div>
  );
}
