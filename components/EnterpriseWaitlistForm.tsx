'use client';

import { useState, type FormEvent } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function EnterpriseWaitlistForm() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/waitlist/enterprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), company: company.trim() || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error ?? 'Something went wrong. Please try again.');
      } else {
        setStatus('success');
        setMessage(data.message ?? "You're on the list!");
        setEmail('');
        setCompany('');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please check your connection and try again.');
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    fontSize: 14,
    border: '1.5px solid #D1D5DB',
    borderRadius: 8,
    outline: 'none',
    fontFamily: 'system-ui, sans-serif',
    color: '#111827',
    backgroundColor: '#FFFFFF',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  if (status === 'success') {
    return (
      <div
        style={{
          backgroundColor: '#F0FDF4',
          border: '1.5px solid #86EFAC',
          borderRadius: 12,
          padding: '20px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
        <p style={{ margin: 0, color: '#15803D', fontWeight: 600, fontSize: 15 }}>{message}</p>
        <p style={{ margin: '6px 0 0', color: '#4ADE80', fontSize: 13 }}>
          We'll reach out personally when Enterprise launches.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input
        type="email"
        required
        placeholder="Work email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
        disabled={status === 'loading'}
      />
      <input
        type="text"
        placeholder="Company name (optional)"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        style={inputStyle}
        disabled={status === 'loading'}
      />

      {status === 'error' && (
        <p style={{ margin: 0, fontSize: 13, color: '#DC2626', padding: '8px 12px', backgroundColor: '#FEF2F2', borderRadius: 6 }}>
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'loading' || !email}
        style={{
          padding: '13px 24px',
          backgroundColor: status === 'loading' ? '#93C5FD' : '#2563EB',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '-0.01em',
          transition: 'background-color 0.15s',
        }}
      >
        {status === 'loading' ? 'Submitting…' : 'Request Early Access'}
      </button>

      <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
        No spam. We'll only contact you when Enterprise is ready.
      </p>
    </form>
  );
}
