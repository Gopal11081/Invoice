'use client';

import { useState, useEffect } from 'react';
import { formatDateDisplay } from '@/lib/utils';
import { toast } from '@/lib/toast';
import ConfirmationModal from '@/components/ConfirmationModal';
import { logClientError } from '@/lib/logError';

export default function AdminUsersClient({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState(null);

  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleEditClick = (user) => {
    setEditingUser(user);
    setEditUsername(user.username || '');
    setEditDisplayName(user.display_name || '');
    setEditEmail(user.email || '');
    setEditMobile(user.mobile || '');
  };

  const isEditChanged = editingUser ? (
    editUsername.trim().toLowerCase() !== (editingUser.username || '').toLowerCase() ||
    editDisplayName.trim() !== (editingUser.display_name || '') ||
    editEmail.trim().toLowerCase() !== (editingUser.email || '').toLowerCase() ||
    editMobile.trim() !== (editingUser.mobile || '')
  ) : false;

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editUsername.trim()) {
      toast.error('Username is required');
      return;
    }
    if (!editDisplayName.trim()) {
      toast.error('Full name is required');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,}$/.test(editUsername.trim())) {
      toast.error('Username must be alphanumeric and at least 3 characters');
      return;
    }
    if (editEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
      toast.error('Invalid email format');
      return;
    }

    let cleanMobile = editMobile.trim();
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

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editUsername.trim(),
          display_name: editDisplayName.trim(),
          email: editEmail.trim(),
          mobile: cleanMobile
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
      toast.success('User updated successfully!');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to load user accounts');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      toast.error('Failed to load user accounts');
      logClientError('app/(dashboard)/users/AdminUsersClient.js', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatusClick = (userId, displayName, currentActive) => {
    const is_active = !currentActive;
    const actionText = is_active ? 'activate' : 'deactivate';
    const type = is_active ? 'primary' : 'danger';
    const confirmButtonText = is_active ? 'Activate' : 'Deactivate';

    setConfirmConfig({
      title: `${confirmButtonText} User`,
      message: `Are you sure you want to ${actionText} the user account for "${displayName}"?`,
      confirmText: confirmButtonText,
      type: type,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active }),
          });
          if (!res.ok) throw new Error('Failed to update status');
          toast.success(is_active ? 'User activated successfully!' : 'User deactivated successfully!');
          fetchUsers();
        } catch (err) {
          toast.error(err.message);
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  const handleRoleChangeClick = (userId, displayName, newRole) => {
    const roleLabel = newRole === 'admin' ? 'Admin' : newRole === 'ca' ? 'CA' : 'Staff';
    setConfirmConfig({
      title: 'Change User Role',
      message: `Are you sure you want to change the role of "${displayName}" to ${roleLabel}?`,
      confirmText: 'Change Role',
      type: 'primary',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole }),
          });
          if (!res.ok) throw new Error('Failed to update user role');
          toast.success('User role updated successfully!');
          fetchUsers();
        } catch (err) {
          toast.error(err.message);
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  const handleResetPasswordClick = (userId, displayName, email) => {
    if (!email) {
      toast.error(`Cannot send reset link — ${displayName} has no email address on file.`);
      return;
    }

    setConfirmConfig({
      title: 'Send Password Reset Link',
      message: `Send a password reset link to "${displayName}" at ${email}? The link will expire in 15 minutes.`,
      confirmText: 'Send Reset Link',
      type: 'primary',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to send reset link');
          toast.success(data.message);
          if (data.debugUrl) {
            console.log('🔑 Debug reset URL:', data.debugUrl);
          }
        } catch (err) {
          toast.error(err.message);
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  // Filter out the master admin user 'aishu' from management
  const filteredUsers = users.filter((u) => u.username !== 'aishu');

  return (
    <section className="page active" id="pageUsers">
      <div className="page-header">
        <h1 className="page-title">🛡️ User Accounts</h1>
      </div>
      <div className="page-body">
        <div className="products-list">
          {loading ? (
            <p className="page-empty-state">Loading user accounts...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="page-empty-state">No users registered.</p>
          ) : (
            filteredUsers.map((u) => {
              const activeText = u.is_active ? 'Active' : 'Deactivated';
              const statusClass = u.is_active ? 'badge-active' : 'badge-deactivated';

              let displayRoleLabel = 'Staff';
              let roleBadgeClass = 'badge-buyer';
              if (u.role === 'admin') {
                displayRoleLabel = 'Admin';
                roleBadgeClass = 'badge-seller';
              } else if (u.role === 'ca') {
                displayRoleLabel = 'CA';
                roleBadgeClass = 'badge-codes';
              }

              return (
                <div className="product-item" key={u.id}>
                  <div className="product-item-info">
                    <div className="product-item-name" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {u.display_name}
                      <span className={`badge ${roleBadgeClass}`}>{displayRoleLabel}</span>
                      <span className={`badge ${statusClass}`}>{activeText}</span>
                    </div>
                    <div className="product-item-meta" style={{ marginTop: '0.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <span>Username: {u.username}</span>
                      <span>Registered: {formatDateDisplay(u.created_at)}</span>
                      {(u.email || u.mobile) && (
                        <span>
                          {[u.email && `Email: ${u.email}`, u.mobile && `Mobile: ${u.mobile}`].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="product-item-actions">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {(() => {
                        const isSelf = u.id === currentUserId;
                        return (
                          <>
                            <select
                              className="role-select"
                              value={u.role || 'staff'}
                              onChange={(e) => handleRoleChangeClick(u.id, u.display_name, e.target.value)}
                              disabled={isSelf}
                              style={{
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-primary)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px',
                                outline: 'none',
                                cursor: isSelf ? 'not-allowed' : 'pointer',
                                opacity: isSelf ? 0.6 : 1,
                                fontSize: '13px'
                              }}
                            >
                              <option value="staff">Staff</option>
                              <option value="admin">Admin</option>
                              <option value="ca">CA</option>
                            </select>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => handleEditClick(u)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => handleResetPasswordClick(u.id, u.display_name, u.email)}
                              title={u.email ? `Send reset link to ${u.email}` : 'No email address on file'}
                              style={{
                                cursor: u.email ? 'pointer' : 'not-allowed',
                                opacity: u.email ? 1 : 0.5,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" />
                              </svg>
                              Reset Password
                            </button>
                            <button
                              className={`btn btn-sm ${u.is_active ? 'btn-outline' : 'btn-primary'} btn-toggle-status`}
                              onClick={() => handleToggleStatusClick(u.id, u.display_name, u.is_active)}
                              disabled={isSelf}
                              style={{
                                cursor: isSelf ? 'not-allowed' : 'pointer',
                                opacity: isSelf ? 0.6 : 1
                              }}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <ConfirmationModal
        isOpen={!!confirmConfig}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmText={confirmConfig?.confirmText}
        type={confirmConfig?.type}
        isLoading={confirmConfig?.isLoading}
        onConfirm={confirmConfig?.onConfirm}
        onCancel={() => setConfirmConfig(null)}
      />
      {editingUser && (
        <div
          className="modal-overlay active"
          onClick={() => setEditingUser(null)}
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
                <span style={{ color: 'var(--accent-blue)' }}>✏️</span>
                Edit User Account
              </h2>
              <button
                onClick={() => setEditingUser(null)}
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

            {/* Body */}
            <form onSubmit={handleSaveEdit} style={{ margin: 0 }}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="editUsername">Username *</label>
                  <input
                    type="text"
                    id="editUsername"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editDisplayName">Full Name *</label>
                  <input
                    type="text"
                    id="editDisplayName"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editEmail">Email Address</label>
                  <input
                    type="email"
                    id="editEmail"
                    value={editEmail}
                    placeholder="name@company.com"
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editMobile">Mobile Number</label>
                  <input
                    type="tel"
                    id="editMobile"
                    value={editMobile}
                    placeholder="9876543210"
                    onChange={(e) => setEditMobile(e.target.value)}
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
                  onClick={() => setEditingUser(null)}
                  disabled={isSavingEdit}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !isEditChanged}
                  className="btn btn-primary"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

