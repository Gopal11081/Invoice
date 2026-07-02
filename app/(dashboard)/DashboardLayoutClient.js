'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { logClientError } from '@/lib/logError';
import { toast } from '@/lib/toast';

export default function DashboardLayoutClient({ children, currentUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isCARestricted = currentUser?.role === 'ca' && pathname !== '/ca-dashboard';

  useEffect(() => {
    if (isCARestricted) {
      router.replace('/ca-dashboard');
    }
  }, [isCARestricted, router]);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileMobile, setProfileMobile] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [initialProfile, setInitialProfile] = useState(null);

  const handleOpenProfile = async () => {
    setIsProfileOpen(true);
    setProfileLoading(true);
    setProfileName(currentUser.displayName || currentUser.username || '');
    setProfileEmail('');
    setProfileMobile('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    try {
      const res = await fetch('/api/auth/profile');
      if (res.ok) {
        const data = await res.json();
        setProfileName(data.display_name || '');
        setProfileEmail(data.email || '');
        setProfileMobile(data.mobile || '');
        setInitialProfile(data);
      }
    } catch (e) {
      logClientError('DashboardLayoutClient profile fetch', e);
    } finally {
      setProfileLoading(false);
    }
  };

  const isProfileChanged = initialProfile ? (
    profileName.trim() !== (initialProfile.display_name || '') ||
    profileEmail.trim().toLowerCase() !== (initialProfile.email || '').toLowerCase() ||
    profileMobile.trim() !== (initialProfile.mobile || '') ||
    (newPassword !== '' && currentPassword !== '')
  ) : false;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) {
      toast.error('Full Name is required');
      return;
    }
    if (profileEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail)) {
      toast.error('Invalid email format');
      return;
    }

    let cleanMobile = profileMobile.trim();
    if (cleanMobile) {
      cleanMobile = cleanMobile.replace(/\D/g, '');
      if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) {
        cleanMobile = cleanMobile.substring(2);
      } else if (cleanMobile.length === 11 && cleanMobile.startsWith('0')) {
        cleanMobile = cleanMobile.substring(1);
      }
      if (!/^\d{10}$/.test(cleanMobile)) {
        toast.error('Mobile number must be a valid 10-digit number');
        return;
      }
    }

    if (newPassword) {
      if (!currentPassword) {
        toast.error('Current password is required to change password');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('New passwords do not match');
        return;
      }
      if (newPassword.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(newPassword)) {
        toast.error('New password must be at least 8 characters long and include a letter, a number, and a special character.');
        return;
      }
    }

    setProfileSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: profileName.trim(),
          email: profileEmail.trim(),
          mobile: cleanMobile,
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      toast.success('Profile updated successfully!');
      setIsProfileOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (e) {
      logClientError('app/(dashboard)/DashboardLayoutClient.js error (Logout failed:):', e);
    }
  };

  const links = currentUser?.role === 'ca' ? [] : [
    { name: 'Dashboard', path: '/dashboard', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
    )},
    { name: 'New Invoice', path: '/invoice', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
    )},
    { name: 'History', path: '/history', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
    )},
    { name: 'Products', path: '/products', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
    )},
    { name: 'Customers', path: '/customers', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    )},
    { name: 'Settings', path: '/settings', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    )},
  ];

  // Role checks for showing conditional links
  const isAdmin = currentUser.role === 'admin';
  const isCA = currentUser.role === 'ca' || isAdmin;

  const userAvatarChar = currentUser.display_name
    ? currentUser.display_name.charAt(0).toUpperCase()
    : currentUser.username.charAt(0).toUpperCase();

  const userRoleDisplay = currentUser.role === 'admin'
    ? 'Administrator'
    : currentUser.role === 'ca'
    ? 'Chartered Accountant'
    : 'Staff Member';

  return (
    <div style={{ display: 'contents' }}>
      {/* ===== SIDEBAR ===== */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} id="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="6" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="2.5"/>
              <path d="M4 14H36" stroke="currentColor" strokeWidth="2.5"/>
              <path d="M12 6V14" stroke="currentColor" strokeWidth="2.5"/>
              <path d="M28 6V14" stroke="currentColor" strokeWidth="2.5"/>
              <path d="M12 22H20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M12 28H28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="30" cy="22" r="3" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-title">InvoiceGST</span>
            <span className="sidebar-logo-sub">Professional Billing</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => {
            const isActive = pathname === link.path;
            return (
              <Link
                key={link.path}
                href={link.path}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {link.icon}
                <span>{link.name}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/users"
              className={`sidebar-link ${pathname === '/users' ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Users</span>
            </Link>
          )}

          {isCA && (
            <Link
              href="/ca-dashboard"
              className={`sidebar-link ${pathname === '/ca-dashboard' ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
              <span>CA Dashboard</span>
            </Link>
          )}
        </nav>

        <div className="sidebar-footer">
          <div
            className="sidebar-user"
            id="sidebarUser"
            onClick={handleOpenProfile}
            style={{
              cursor: 'pointer',
              transition: 'background var(--transition-fast)',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title="Edit Profile"
          >
            <div className="sidebar-user-avatar" id="sidebarUserAvatar">
              {userAvatarChar}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name" id="sidebarUserName">{currentUser.display_name || currentUser.username}</div>
              <div className="sidebar-user-role" id="sidebarUserRole">{userRoleDisplay}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout} title="Sign Out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ===== MOBILE HEADER ===== */}
      <header className="mobile-header" id="mobileHeader">
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} id="btnMobileMenu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <span className="mobile-title">InvoiceGST</span>
      </header>
      
      <div 
        className={`sidebar-overlay ${mobileOpen ? 'active' : ''}`} 
        onClick={() => setMobileOpen(false)}
        id="sidebarOverlay"
      ></div>

      {/* ===== MAIN CONTENT WRAPPER ===== */}
      <div className="app-content" id="appContent">
        {isCARestricted ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            Redirecting to CA Dashboard...
          </div>
        ) : (
          children
        )}
      </div>

      {isProfileOpen && (
        <div
          className="modal-overlay active"
          onClick={() => setIsProfileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-xl)',
              width: '90vw',
              maxWidth: '460px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(255, 255, 255, 0.01)'
              }}
            >
              <h2
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ color: 'var(--accent-blue)' }}>👤</span>
                Edit Profile
              </h2>
              <button
                onClick={() => setIsProfileOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.25rem',
                  borderRadius: '6px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {profileLoading ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading profile details...
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} style={{ margin: 0 }}>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
                  <div className="form-group">
                    <label htmlFor="profName">Full Name *</label>
                    <input
                      type="text"
                      id="profName"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="profEmail">Email Address</label>
                    <input
                      type="email"
                      id="profEmail"
                      value={profileEmail}
                      placeholder="name@company.com"
                      onChange={(e) => setProfileEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="profMobile">Mobile Number</label>
                    <input
                      type="tel"
                      id="profMobile"
                      value={profileMobile}
                      placeholder="9876543210"
                      onChange={(e) => setProfileMobile(e.target.value)}
                    />
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '0.5rem 0' }} />
                  
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Change Password (Optional)
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="profCurrPassword">Current Password</label>
                    <input
                      type="password"
                      id="profCurrPassword"
                      value={currentPassword}
                      placeholder="Required to change password"
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="profNewPassword">New Password</label>
                    <input
                      type="password"
                      id="profNewPassword"
                      value={newPassword}
                      placeholder="Minimum 8 characters"
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="profConfirmPassword">Confirm New Password</label>
                    <input
                      type="password"
                      id="profConfirmPassword"
                      value={confirmPassword}
                      placeholder="Verify new password"
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'rgba(0, 0, 0, 0.15)'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(false)}
                    disabled={profileSaving}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving || !isProfileChanged}
                    className="btn btn-primary"
                  >
                    {profileSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
