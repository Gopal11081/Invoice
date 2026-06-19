'use client';

import { useState, useEffect } from 'react';
import { INDIAN_STATES } from '@/lib/utils';
import { toast } from '@/lib/toast';
import ConfirmationModal from '@/components/ConfirmationModal';
import { logClientError } from '@/lib/logError';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);

  const [bizName, setBizName] = useState('');
  const [bizGstin, setBizGstin] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizState, setBizState] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizEmail, setBizEmail] = useState('');
  const [terms, setTerms] = useState('');
  const [sendEmails, setSendEmails] = useState(true);
  const [initialConfig, setInitialConfig] = useState(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/business');
        if (!res.ok) throw new Error('Failed to load settings');
        const data = await res.json();
        setBizName(data?.name || '');
        setBizGstin(data?.gstin || '');
        setBizAddress(data?.address || '');
        setBizState(data?.state_code || '');
        setBizPhone(data?.phone || '');
        setBizEmail(data?.email || '');
        setTerms(data?.terms || '');
        setSendEmails(data?.send_emails !== false);
        setInitialConfig(data || {});
      } catch (err) {
        toast.error('Failed to load settings');
      logClientError('app/(dashboard)/settings/page.js', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const isChanged = initialConfig ? (
    bizName !== (initialConfig.name || '') ||
    bizGstin !== (initialConfig.gstin || '') ||
    bizAddress !== (initialConfig.address || '') ||
    bizState !== (initialConfig.state_code || '') ||
    bizPhone !== (initialConfig.phone || '') ||
    bizEmail !== (initialConfig.email || '') ||
    terms !== (initialConfig.terms || '') ||
    sendEmails !== (initialConfig.send_emails !== false)
  ) : false;

  const handleSave = (e) => {
    e.preventDefault();

    const name = bizName.trim();
    const gstin = bizGstin.trim().toUpperCase();
    const address = bizAddress.trim();
    const phone = bizPhone.trim();
    const email = bizEmail.trim();

    if (!name) { toast.error('Business Name is required'); return; }
    if (!gstin) { toast.error('GSTIN is required'); return; }

    const regexGstin = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
    if (!regexGstin.test(gstin)) {
      toast.error('Invalid Business GSTIN format (e.g. 22AAAAA0000A1Z5)');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Invalid business email format');
      return;
    }

    if (phone && !/^\d{10}$/.test(phone)) {
      toast.error('Business phone number must be a valid 10-digit number.');
      return;
    }

    if (!bizState) {
      toast.error('Please select state code');
      return;
    }

    setConfirmConfig({
      title: 'Save Business Settings',
      message: 'Are you sure you want to save these changes to the business settings? The page will reload to apply changes.',
      confirmText: 'Save Changes',
      type: 'primary',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        setSaving(true);
        try {
          const res = await fetch('/api/business', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              gstin,
              address,
              state_code: bizState,
              phone,
              email,
              terms: terms.trim(),
              send_emails: sendEmails
            }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to save settings');
          }

          toast.success('Business settings saved!');
          // Force reload to update sidebar business display name
          window.location.reload();
        } catch (err) {
          toast.error(err.message);
          setSaving(false);
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="page-body">
        <p className="page-empty-state">Loading settings...</p>
      </div>
    );
  }

  return (
    <section className="page active" id="pageSettings">
      <div className="page-header">
        <h1 className="page-title">⚙️ Business Settings</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !isChanged}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
      <div className="page-body">
        <form className="settings-form" onSubmit={handleSave}>
          <h3 className="settings-section-title">Company Information</h3>
          <div className="form-grid cols-2">
            <div className="form-group">
              <label htmlFor="settBizName">Business Name *</label>
              <input
                type="text"
                id="settBizName"
                placeholder="Your Company Pvt. Ltd."
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="settBizGstin">GSTIN *</label>
              <input
                type="text"
                id="settBizGstin"
                placeholder="22AAAAA0000A1Z5"
                maxLength="15"
                className="mono"
                value={bizGstin}
                onChange={(e) => setBizGstin(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label htmlFor="settBizAddress">Address</label>
            <textarea
              id="settBizAddress"
              rows="2"
              placeholder="123 Business Park, City, State - 400001"
              value={bizAddress}
              onChange={(e) => setBizAddress(e.target.value)}
            />
          </div>

          <div className="form-grid cols-3" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label htmlFor="settBizState">State</label>
              <select
                id="settBizState"
                value={bizState}
                onChange={(e) => setBizState(e.target.value)}
                required
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.code} - {st.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="settBizPhone">Phone</label>
              <input
                type="tel"
                id="settBizPhone"
                placeholder="+91 98765 43210"
                value={bizPhone}
                onChange={(e) => setBizPhone(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="settBizEmail">Email</label>
              <input
                type="email"
                id="settBizEmail"
                placeholder="billing@company.com"
                value={bizEmail}
                onChange={(e) => setBizEmail(e.target.value)}
              />
            </div>
          </div>

          <h3 className="settings-section-title" style={{ marginTop: '2.5rem' }}>Email Notifications</h3>
          <div style={{ marginTop: '1rem', padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Send Invoice Emails Automatically</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Automatically send an invoice copy to the client's email address in the background upon generation or updates.</div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                <input
                  type="checkbox"
                  checked={sendEmails}
                  onChange={(e) => setSendEmails(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="slider round" style={{ position: 'absolute', cursor: 'pointer', inset: 0, backgroundColor: sendEmails ? 'var(--accent-blue)' : '#374151', borderRadius: '24px', transition: '0.3s' }}>
                  <span style={{ position: 'absolute', content: '""', height: '18px', width: '18px', left: sendEmails ? '24px' : '4px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '0.3s' }}></span>
                </span>
              </label>
            </div>
          </div>

          <h3 className="settings-section-title" style={{ marginTop: '2rem' }}>Default Terms & Conditions</h3>
          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <textarea
              id="settTerms"
              rows="4"
              placeholder="1. Payment is due within 30 days&#10;2. Goods once sold will not be taken back"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </div>
        </form>
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
    </section>
  );
}
