'use client';

import { useState, useEffect } from 'react';
import { INDIAN_STATES, getStateName, formatDateDisplay } from '@/lib/utils';
import { toast } from '@/lib/toast';
import ConfirmationModal from '@/components/ConfirmationModal';
import { logClientError } from '@/lib/logError';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);

  // Form states
  const [custName, setCustName] = useState('');
  const [custGstin, setCustGstin] = useState('');
  const [custState, setCustState] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (!res.ok) throw new Error('Failed to load customers');
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      toast.error('Failed to load customers');
      logClientError('app/(dashboard)/customers/page.js', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openAddForm = () => {
    setEditingCustomer(null);
    setCustName('');
    setCustGstin('');
    setCustState('');
    setCustAddress('');
    setCustPhone('');
    setCustEmail('');
    setFormOpen(true);
  };

  const openEditForm = (customer) => {
    setEditingCustomer(customer);
    setCustName(customer.name || '');
    setCustGstin(customer.gstin || '');
    setCustState(customer.state_code || '');
    setCustAddress(customer.address || '');
    setCustPhone(customer.phone || '');
    setCustEmail(customer.email || '');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingCustomer(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const name = custName.trim();
    const gstin = custGstin.trim().toUpperCase();
    const address = custAddress.trim();
    const phone = custPhone.trim();
    const email = custEmail.trim();

    if (!name) { toast.error('Customer name is required'); return; }

    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(gstin)) {
      toast.error('Invalid Customer GSTIN format (e.g. 22AAAAA0000A1Z5)');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Invalid customer email address format');
      return;
    }

    if (phone && !/^\d{10}$/.test(phone)) {
      toast.error('Customer phone number must be a valid 10-digit number.');
      return;
    }

    if (!custState) {
      toast.error('Please select the customer state code.');
      return;
    }

    const payload = { name, gstin, state_code: custState, address, phone, email };

    try {
      let res;
      if (editingCustomer) {
        res = await fetch(`/api/customers/${editingCustomer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save customer');
      }

      toast.success(editingCustomer ? 'Customer updated!' : 'Customer added!');
      closeForm();
      fetchCustomers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteClick = (customer) => {
    setConfirmConfig({
      title: 'Remove Customer',
      message: `Are you sure you want to remove customer "${customer.name}" from the directory? This action cannot be undone.`,
      confirmText: 'Remove',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete customer');
          toast.success('Customer removed');
          fetchCustomers();
        } catch (err) {
          toast.error(err.message);
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  return (
    <section className="page active" id="pageCustomers">
      <div className="page-header">
        <h1 className="page-title">👥 Customer Directory</h1>
        <div className="page-actions">
          {!formOpen && (
            <button className="btn btn-accent" onClick={openAddForm}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Customer
            </button>
          )}
        </div>
      </div>
      
      <div className="page-body">
        {formOpen && (
          <form className="product-form" style={{ display: 'block' }} onSubmit={handleSave}>
            <h3 className="settings-section-title">
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h3>
            <div className="form-grid cols-2">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="custName">Customer / Company Name *</label>
                <input
                  type="text"
                  id="custName"
                  placeholder="Acme Corp / John Doe"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="custGstin">GSTIN</label>
                <input
                  type="text"
                  id="custGstin"
                  placeholder="22AAAAA0000A1Z5"
                  className="mono"
                  maxLength="15"
                  value={custGstin}
                  onChange={(e) => setCustGstin(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="custState">State</label>
                <select
                  id="custState"
                  value={custState}
                  onChange={(e) => setCustState(e.target.value)}
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
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="custAddress">Address</label>
                <textarea
                  id="custAddress"
                  rows="2"
                  placeholder="Street Address, City"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="custPhone">Phone</label>
                <input
                  type="tel"
                  id="custPhone"
                  placeholder="+91 98765 43210"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="custEmail">Email</label>
                <input
                  type="email"
                  id="custEmail"
                  placeholder="billing@customer.com"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="product-form-actions">
              <button type="submit" className="btn btn-primary">Save Customer</button>
              <button type="button" className="btn btn-ghost" onClick={closeForm}>Cancel</button>
            </div>
          </form>
        )}

        <div className="products-list">
          {loading ? (
            <p className="page-empty-state">Loading customers...</p>
          ) : customers.length === 0 ? (
            <p className="page-empty-state">No customers yet. Add your first customer!</p>
          ) : (
            customers.map((c) => (
              <div className="product-item" key={c.id}>
                <div className="product-item-info">
                  <div className="product-item-name">{c.name}</div>
                  <div className="product-item-meta">
                    <span>GSTIN: {c.gstin || '—'}</span>
                    <span>State: {getStateName(c.state_code) || '—'}</span>
                    <span>Phone: {c.phone || '—'}</span>
                    <span>Created: {c.created_at ? formatDateDisplay(c.created_at) : '—'}</span>
                  </div>
                </div>
                <div className="product-item-actions">
                  <button className="btn btn-ghost" onClick={() => openEditForm(c)} title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button className="btn btn-danger" onClick={() => handleDeleteClick(c)} title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3,6 5,6 21,6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
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
    </section>
  );
}
