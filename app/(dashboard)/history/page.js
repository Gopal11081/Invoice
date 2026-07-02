'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateDisplay, formatNumber } from '@/lib/utils';
import { toast } from '@/lib/toast';
import ConfirmationModal from '@/components/ConfirmationModal';
import { logClientError } from '@/lib/logError';

// Email badge display disabled
// const getEmailBadge = (status) => {
//   switch (status) {
//     case 'sending':
//       return <span className="badge badge-email-sending" style={{ marginLeft: '0.75rem' }}>✉️ Sending</span>;
//     case 'sent':
//       return <span className="badge badge-email-sent" style={{ marginLeft: '0.75rem' }}>✉️ Emailed</span>;
//     case 'failed':
//       return <span className="badge badge-email-failed" style={{ marginLeft: '0.75rem' }}>✉️ Failed</span>;
//     case 'not_configured':
//       return <span className="badge badge-email-not_configured" style={{ marginLeft: '0.75rem' }} title="SMTP not configured. Link logged to server console.">✉️ Logged</span>;
//     case 'disabled':
//       return <span className="badge badge-email-disabled" style={{ marginLeft: '0.75rem' }} title="Automatic email sending is turned off in settings.">✉️ Disabled</span>;
//     default:
//       return null;
//   }
// };

export default function HistoryPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [totalCount, setTotalCount] = useState(0);
  const [pageCursors, setPageCursors] = useState([null]); // index 0 is null for page 1

  // Sharing states
  const [shareInvoice, setShareInvoice] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);

  // Auto-correction for page overflow on deletions
  useEffect(() => {
    const maxPage = Math.ceil(totalCount / itemsPerPage) || 1;
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [totalCount, currentPage]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      if (data.authenticated) {
        setCurrentUser(data.user);
      }
    } catch (e) {
      logClientError('app/(dashboard)/history/page.js', e);
    }
  };

  const fetchHistory = async (page = currentPage) => {
    setLoading(true);
    try {
      const cursor = pageCursors[page - 1] || '';
      const res = await fetch(`/api/invoices?limit=${itemsPerPage}&startAfter=${cursor}`);
      if (!res.ok) throw new Error('Failed to fetch invoices');
      const data = await res.json();
      
      setInvoices(data.list);
      setTotalCount(data.totalCount);
      
      if (data.list.length === itemsPerPage) {
        const lastItem = data.list[data.list.length - 1];
        const nextCursor = `${lastItem.invoice_date}_${lastItem.created_at}`;
        setPageCursors(prev => {
          const nextCursors = [...prev];
          nextCursors[page] = nextCursor;
          return nextCursors;
        });
      }
    } catch (err) {
      toast.error('Failed to load invoice history');
      logClientError('app/(dashboard)/history/page.js', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    fetchHistory(currentPage);
  }, [currentPage]);

  const handleDeleteClick = (e, invoice) => {
    e.stopPropagation();
    setConfirmConfig({
      title: 'Delete Invoice',
      message: `Are you sure you want to delete invoice "${invoice.invoice_number}"? This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/invoices/${invoice.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete invoice');
          toast.success('Invoice deleted');
          
          const newTotalCount = totalCount - 1;
          const maxPage = Math.ceil(newTotalCount / itemsPerPage) || 1;
          if (currentPage > maxPage) {
            setCurrentPage(maxPage);
          } else {
            fetchHistory(currentPage);
          }
        } catch (err) {
          toast.error(err.message);
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  const handleShareClick = async (e, invoice) => {
    e.stopPropagation();
    setShareInvoice(invoice);
    setCopied(false);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/share`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate share link');
      const data = await res.json();
      const origin = window.location.origin;
      setShareUrl(`${origin}/share/${data.share_token}`);
    } catch (err) {
      toast.error(err.message);
      setShareInvoice(null);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Share link copied to clipboard!');
  };

  const handleItemClick = (invoice) => {
    const isCA = currentUser && currentUser.role === 'ca';
    if (isCA) {
      router.push(`/invoice?id=${invoice.id}&preview=true`);
    } else {
      router.push(`/invoice?id=${invoice.id}`);
    }
  };

  const isCA = currentUser && currentUser.role === 'ca';

  return (
    <section className="page active" id="pageHistory">
      <div className="page-header">
        <h1 className="page-title">🕐 Invoice History</h1>
      </div>
      
      <div className="page-body">
        <div className="history-list">
          {loading ? (
            <p className="page-empty-state">Loading invoices...</p>
          ) : totalCount === 0 ? (
            <p className="page-empty-state">
              No invoices generated yet.<br />
              Create your first invoice!
            </p>
          ) : (
            <>
              {invoices.map((inv) => (
                <div className="history-item" key={inv.id} onClick={() => handleItemClick(inv)}>
                  <div className="history-item-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14,2 14,8 20,8" />
                    </svg>
                  </div>
                  <div className="history-item-info">
                    <div className="history-item-number" style={{ display: 'flex', alignItems: 'center' }}>
                      {inv.invoice_number}
                      {/* Email badge disabled */}
                    </div>
                    <div className="history-item-detail">
                      {inv.buyer_name || 'No customer'} · {formatDateDisplay(inv.invoice_date)}
                    </div>
                  </div>
                  <div className="history-item-amount">₹{formatNumber(inv.grand_total || 0)}</div>
                  <div className="history-item-actions">
                    <button className="btn-share-invoice-hist" onClick={(e) => handleShareClick(e, inv)} title="Share">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                    </button>
                    {!isCA && (
                      <button className="btn btn-danger btn-del-invoice" onClick={(e) => handleDeleteClick(e, inv)} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3,6 5,6 21,6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* PAGINATION CONTROLS */}
              {totalCount > itemsPerPage && (
                (() => {
                  const totalPages = Math.ceil(totalCount / itemsPerPage);
                  const startItem = (currentPage - 1) * itemsPerPage + 1;
                  const endItem = Math.min(currentPage * itemsPerPage, totalCount);
                  
                  return (
                    <div className="pagination-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0.85rem 1.25rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Showing <strong>{startItem}</strong>-<strong>{endItem}</strong> of <strong>{totalCount}</strong> invoices
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                        >
                          ◀ Prev
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                          const isActive = page === currentPage;
                          return (
                            <button
                              key={page}
                              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                              onClick={() => setCurrentPage(page)}
                              style={{ minWidth: '32px', justifyContent: 'center' }}
                            >
                              {page}
                            </button>
                          );
                        })}
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                        >
                          Next ▶
                        </button>
                      </div>
                    </div>
                  );
                })()
              )}
            </>
          )}
        </div>
      </div>

      {/* ===== SHARE MODAL ===== */}
      {shareInvoice && (
        <div className="modal-overlay active" onClick={() => setShareInvoice(null)}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Share Invoice</h2>
              <div className="modal-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => setShareInvoice(null)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="modal-body share-modal-body">
              <p className="share-modal-desc">
                Share invoice {shareInvoice.invoice_number} with your customer. Anyone with this link can view the invoice online without logging in.
              </p>
              <div className="share-url-container">
                <input type="text" value={shareUrl} readOnly className="mono" />
                <button className="btn btn-primary" onClick={copyToClipboard}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="share-divider"><span>OR SHARE VIA</span></div>
              <div className="share-options-grid">
                <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Here is your invoice: ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer" className="share-option-btn whatsapp">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                  <span>WhatsApp</span>
                </a>
                <a href={`mailto:?subject=${encodeURIComponent(`Invoice ${shareInvoice.invoice_number} from our business`)}&body=${encodeURIComponent(`Dear Customer,\n\nPlease find your invoice shared at the link below:\n\n${shareUrl}\n\nThank you!`)}`} className="share-option-btn email">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <span>Email</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
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
