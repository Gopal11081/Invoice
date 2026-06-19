'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '@/styles/login.module.css';
import { logClientError } from '@/lib/logError';

export default function RegisterClient() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    let cleanMobile = '';
    if (mobile) {
      let normalized = mobile.replace(/\D/g, '');
      if (normalized.length === 12 && normalized.startsWith('91')) {
        normalized = normalized.substring(2);
      } else if (normalized.length === 11 && normalized.startsWith('0')) {
        normalized = normalized.substring(1);
      }
      cleanMobile = normalized;
    }

    if (!displayName.trim()) {
      showError('Full Name is required');
      return;
    }

    if (!email && !cleanMobile) {
      showError('Either Email Address or Mobile Number is required');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Invalid email address format');
      return;
    }

    if (cleanMobile && !/^\d{10}$/.test(cleanMobile)) {
      showError('Mobile number must be a valid 10-digit number (e.g. 9876543210)');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,}$/.test(username.trim())) {
      showError('Username must be alphanumeric and at least 3 characters');
      return;
    }

    if (password.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(password)) {
      showError('Password must be at least 8 characters long and include a letter, a number, and a special character');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          display_name: displayName.trim(),
          email: email.trim(),
          mobile: cleanMobile
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setSuccessMsg(data.message);
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (err) {
      logClientError('Registration page', err);
      showError(err.message);
    }
  };

  const showError = (msg) => {
    setError(msg);
    setLoading(false);
    setShake(true);
    setTimeout(() => setShake(false), 500);
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
          {!success && <p className={styles['login-subtitle']}>Create a New Account</p>}
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

        {success ? (
          <div className={styles['register-success-card']} style={{ display: 'block' }}>
            <div className={styles['success-icon']}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3>Registration Submitted!</h3>
            <p>{successMsg}</p>
            <Link href="/login" className={styles['login-btn']} style={{ textDecoration: 'none', marginTop: '1rem', width: '100%', display: 'flex' }}>
              Go to Login
            </Link>
          </div>
        ) : (
          <>
            {/* Form */}
            <form className={`${styles['login-form']} ${shake ? styles['shake'] : ''}`} onSubmit={handleSubmit}>
              <div className={styles['login-field']}>
                <label htmlFor="registerDisplayName">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                  Full Name
                </label>
                <input
                  type="text"
                  id="registerDisplayName"
                  placeholder="Enter your full name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              
              <div className={styles['login-field']}>
                <label htmlFor="registerEmail">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Email Address
                </label>
                <input
                  type="email"
                  id="registerEmail"
                  placeholder="Enter email (either Email or Mobile is required)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className={styles['login-field']}>
                <label htmlFor="registerMobile">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Mobile Number
                </label>
                <input
                  type="tel"
                  id="registerMobile"
                  placeholder="Enter mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              
              <div className={styles['login-field']}>
                <label htmlFor="registerUsername">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Username
                </label>
                <input
                  type="text"
                  id="registerUsername"
                  placeholder="Choose a username (min 3 chars)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className={styles['login-field']}>
                <label htmlFor="registerPassword">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  Password
                </label>
                <div className={styles['password-wrapper']}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="registerPassword"
                    placeholder="Enter password (min 8 chars)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
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

              <div className={styles['login-field']}>
                <label htmlFor="registerConfirmPassword">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="registerConfirmPassword"
                  placeholder="Verify password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <button type="submit" className={styles['login-btn']} disabled={loading}>
                <span className={styles['login-btn-text']}>
                  {loading ? 'Creating account...' : 'Sign Up'}
                </span>
                {loading && <div className={styles['login-spinner']} />}
              </button>
            </form>

            <div className={styles['login-footer']}>
              <div className={styles['login-hint']}>
                Already have an account? &nbsp;
                <Link href="/login" className={styles['register-link']}>
                  Sign In
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
