'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from '@/styles/login.module.css';
import { logClientError } from '@/lib/logError';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);

  // If parameters are missing, display invalid link card
  if (!token || !email) {
    return (
      <div id="invalidLinkError" style={{ display: 'block', textAlign: 'center', marginBottom: '1rem' }}>
        <div style={{ width: '48px', height: '48px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '50%', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-red)', marginBottom: '0.5rem' }}>Invalid Reset Link</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '0.75rem' }}>
          This password reset link is invalid, incomplete, or has expired.
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1.5rem' }}>
          Please contact your administrator to receive a new reset link.
        </p>
        <Link href="/login" className={styles['login-btn']} style={{ textDecoration: 'none', display: 'block' }}>
          Back to Login
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(password)) {
      showError('Password must be at least 8 characters long and include a letter, a number, and a special character');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        throw new Error(data.error || 'Reset failed');
      }
    } catch (err) {
      logClientError('Reset password page', err);
      showError(err.message);
    }
  };

  const showError = (msg) => {
    setError(msg);
    setLoading(false);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  if (success) {
    return (
      <div id="resetSuccess" style={{ display: 'block', textAlign: 'center', marginBottom: '1rem' }}>
        <div style={{ width: '48px', height: '48px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '50%', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        </div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-green)', marginBottom: '0.5rem' }}>Password Updated</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1.5rem' }}>
          Your password has been reset successfully! You can now log in with your new password.
        </p>
        <Link href="/login" className={styles['login-btn']} style={{ textDecoration: 'none', background: 'linear-gradient(135deg, #34d399, #22d3ee)', boxShadow: '0 4px 16px rgba(52,211,153,0.3)', display: 'block' }}>
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className={styles['login-subtitle']} style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        Resetting password for {email}
      </p>

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

      <form className={`${styles['login-form']} ${shake ? styles['shake'] : ''}`} onSubmit={handleSubmit}>
        <div className={styles['login-field']}>
          <label htmlFor="newPassword">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            New Password
          </label>
          <input
            type="password"
            id="newPassword"
            placeholder="Enter new password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className={styles['login-field']}>
          <label htmlFor="confirmPassword">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className={styles['login-btn']} style={{ marginTop: '0.75rem' }} disabled={loading}>
          <span className="submit-btn-text">
            {loading ? 'Updating...' : 'Reset Password'}
          </span>
          {loading && <div className={styles['login-spinner']} />}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
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
        <div className={styles['login-logo']} style={{ marginBottom: '1rem' }}>
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
          <h1 className={styles['login-title']}>Reset Password</h1>
        </div>

        <Suspense fallback={<div className={styles['login-spinner']} style={{ margin: '2rem auto' }} />}>
          <ResetPasswordForm />
        </Suspense>

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
