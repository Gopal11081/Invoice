'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '@/styles/login.module.css';
import { logClientError } from '@/lib/logError';

export default function LoginClient() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 600);
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (err) {
      logClientError('Login page', err);
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
          <h1 className={styles['login-title']}>InvoiceGST</h1>
          <p className={styles['login-subtitle']}>Professional Billing System</p>
        </div>

        {/* Error message */}
        {error && (
          <div className={styles['login-error']} style={{ display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form className={`${styles['login-form']} ${shake ? styles['shake'] : ''}`} onSubmit={handleSubmit}>
          <div className={styles['login-field']}>
            <label htmlFor="loginUsername">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Username
            </label>
            <input
              type="text"
              id="loginUsername"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          
          <div className={styles['login-field']}>
            <label htmlFor="loginPassword" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Password
              </span>
              <Link href="/forgot-password" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: '0.75rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: '500' }}>
                Forgot?
              </Link>
            </label>
            <div className={styles['password-wrapper']}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="loginPassword"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className={styles['password-toggle']}
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 01-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className={`${styles['login-btn']} ${success ? styles['success'] : ''}`} disabled={loading}>
            <span className={styles['login-btn-text']}>
              {success ? '✓ Welcome!' : loading ? 'Signing in...' : 'Sign In'}
            </span>
            {loading && !success && <div className={styles['login-spinner']} />}
          </button>
        </form>

        <div className={styles['login-footer']}>
          <div className={styles['login-hint']}>
            Don't have an account? &nbsp;
            <Link href="/register" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
