'use client';

import React from 'react';

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // 'danger' | 'primary'
  onConfirm,
  onCancel,
  isLoading = false
}) {
  if (!isOpen) return null;

  const isDanger = type === 'danger';

  return (
    <div
      className="modal-overlay active"
      onClick={onCancel}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999
      }}
    >
      <div
        className="modal-content modal-small"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          width: '90vw',
          maxWidth: '440px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden'
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
            {isDanger ? (
              <span style={{ color: 'var(--accent-red)' }}>⚠️</span>
            ) : (
              <span style={{ color: 'var(--accent-blue)' }}>ℹ️</span>
            )}
            {title}
          </h2>
          <button
            onClick={onCancel}
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
        <div style={{ padding: '1.5rem', minHeight: '80px' }}>
          <p
            style={{
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
              margin: 0
            }}
          >
            {message}
          </p>
        </div>

        {/* Actions Footer */}
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
            onClick={onCancel}
            disabled={isLoading}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-light)',
              padding: '0.5rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.82rem',
              transition: 'all var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--border-focus)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-light)';
            }}
          >
            {cancelText}
          </button>
          
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              background: isDanger ? 'rgba(248, 113, 113, 0.12)' : 'var(--gradient-blue)',
              color: isDanger ? 'var(--accent-red)' : '#0a0e1a',
              border: isDanger ? '1px solid rgba(248, 113, 113, 0.25)' : '1px solid transparent',
              padding: '0.5rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: isDanger ? 600 : 700,
              fontSize: '0.82rem',
              transition: 'all var(--transition-fast)',
              opacity: isLoading ? 0.6 : 1,
              boxShadow: !isDanger && !isLoading ? '0 0 16px rgba(56, 189, 248, 0.2)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                if (isDanger) {
                  e.currentTarget.style.background = 'rgba(248, 113, 113, 0.22)';
                  e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.4)';
                } else {
                  e.currentTarget.style.boxShadow = '0 0 24px rgba(56, 189, 248, 0.45)';
                }
              }
            }}
            onMouseLeave={(e) => {
              if (isDanger) {
                e.currentTarget.style.background = 'rgba(248, 113, 113, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.25)';
              } else {
                e.currentTarget.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.2)';
              }
            }}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
