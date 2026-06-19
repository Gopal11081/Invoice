'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '@/styles/login.module.css';
import { logClientError } from '@/lib/logError';

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [debugUrl, setDebugUrl] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setSuccessMsg(data.message);
        if (data.debugUrl) {
          // Replace server-side link (.html extension) with Next.js path structure
          const cleanLink = data.debugUrl.replace('.html', '');
          setDebugUrl(cleanLink);
        }
      } else {
        throw new Error(data.error || 'Request failed');
      }
    } catch (err) {
      logClientError('Forgot password page', err);
      setError(err.message);
      setLoading(false);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className={styles['login-wrapper']}>
      {/* Floating particles */}
      <div className={styles['particles']}>
        <div className={styles['particle']}></div>
        <div className={styles['particle']}></div>
        <div className={styles['particle']}></div>
        <div className={styles['particle']}></div>
        <div className={styles['particle']}></div>
        <div className={styles['particle']}></div>
      </div>

      <div className={styles['login-card']}>
        {/* Logo */}
        <div className={styles['login-logo']}>
          <div className={styles['login-logo-icon']}>
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="6" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="2.5" />
              <path d="M4 14H36" stroke="currentColor" strokeWidth="2.5" />
              <path d="M12 6V14" stroke="currentColor" strokeWidth="2.5" />
              <path d="M28 6V14" stroke="currentColor" strokeWidth="2.5" />
              <path d="M12 22H20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M12 28H28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="30" cy="22" r="3" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <h1 className={styles['login-title']}>Forgot Password</h1>
          {!success && <p className={styles['login-subtitle']}>Recover your InvoiceGST Account</p>}
        </div>

        {/* Error message */}
        {error && !success && (
          <div className={styles['login-error']} style={{ display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Success message */}
        {success ? (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '50%', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-green)', marginBottom: '0.5rem' }}>Link Generated</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{successMsg}</p>
            
            {/* Local Debug Link box */}
            {debugUrl && (
              <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '8px', padding: '1rem', marginTop: '1.5rem', textAlign: 'left' }}>
                <strong style={{ color: 'var(--accent-blue)', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>[Local Debug Link]</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>SMTP is not configured. Click the button below to test the reset form directly:</span>
                <Link href={debugUrl} style={{ display: 'block', marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(56,189,248,0.12)', color: 'var(--accent-blue)', textDecoration: 'none', borderRadius: '4px', fontWeight: 600, textAlign: 'center', fontSize: '0.8rem', border: '1px solid rgba(56,189,248,0.25)' }}>
                  Verify Reset Password Form
                </Link>
              </div>
            )}
          </div>
        ) : (
          /* Form */
          <form className={`${styles['login-form']} ${shake ? styles['shake'] : ''}`} onSubmit={handleSubmit}>
            <div className={styles['login-field']}>
              <label htmlFor="email">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Email Address
              </label>
              <input
                type="email"
                id="email"
                placeholder="Enter registered email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
            </div>
            
            <button type="submit" className={styles['login-btn']} style={{ marginTop: '0.75rem' }} disabled={loading}>
              <span className="submit-btn-text">
                {loading ? 'Processing...' : 'Send Reset Link'}
              </span>
              {loading && <div className={styles['login-spinner']} />}
            </button>
          </form>
        )}

        <div className={styles['login-footer']}>
          <div className={styles['login-hint']}>
            Remember your password? &nbsp;
            <Link href="/login" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: '600' }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
