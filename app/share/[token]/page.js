'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { getStateName, formatNumber, numberToWords, formatDateDisplay } from '@/lib/utils';
import '@/styles/share.css';
import { logClientError } from '@/lib/logError';

export default function ShareInvoicePage({ params }) {
  const { token } = params;
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadInvoice() {
      if (!token) {
        setError('No sharing token was provided in the link. Please check the URL.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/public/invoices/${token}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('This invoice link is invalid, expired, or has been revoked.');
          } else {
            setError('An error occurred while loading this invoice. Please try again later.');
          }
          return;
        }

        const data = await res.json();
        setInvoice(data);
      } catch (err) {
      logClientError('Share invoice page', err);
        setError('Unable to connect to the server. Please check your internet connection.');
      } finally {
        setLoading(false);
      }
    }
    loadInvoice();
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!invoice || !window.html2pdf) return;
    const invNum = invoice.invoice_number || 'BE-0001';
    const element = document.getElementById('invoicePreview');
    const opt = {
      margin: [0.3, 0.3, 0.3, 0.3],
      filename: `${invNum}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    };
    window.html2pdf().set(opt).from(element).save();
  };

  if (loading) {
    return (
      <div className="share-container">
        <div className="loading-container" id="loadingContainer">
          <div className="spinner"></div>
          <p>Loading secure invoice link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="share-container">
        <div className="error-card" id="errorCard">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <h2>Link Revoked or Expired</h2>
          <p id="errorMessage">{error}</p>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const invNum = invoice.invoice_number || 'BE-0001';
  const invDate = formatDateDisplay(invoice.invoice_date);
  const dueDate = formatDateDisplay(invoice.due_date);
  const seller = invoice.business || {};
  const buyer = {
    name: invoice.buyer_name || 'N/A',
    gstin: invoice.buyer_gstin,
    address: invoice.buyer_address,
    state: getStateName(invoice.buyer_state),
    phone: invoice.buyer_phone,
    email: invoice.buyer_email
  };

  const supplyType = invoice.supply_type || 'intra';

  let subtotal = 0;
  let totalDiscount = 0;
  let taxableTotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  const gstMap = {};

  const items = invoice.items || [];
  items.forEach((item) => {
    const gross = (item.qty || 1) * (item.rate || 0);
    const discAmt = gross * ((item.discount_percent || 0) / 100);
    const rowTotal = gross - discAmt;
    const taxable = rowTotal / (1 + (item.gst_rate || 18) / 100);
    const rowTax = rowTotal - taxable;

    subtotal += gross;
    totalDiscount += discAmt;
    taxableTotal += taxable;

    const rate = item.gst_rate || 18;
    if (!gstMap[rate]) gstMap[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    gstMap[rate].taxable += taxable;

    if (supplyType === 'intra') {
      const c = rowTax / 2;
      const s = c;
      gstMap[rate].cgst += c;
      gstMap[rate].sgst += s;
      gstMap[rate].total += rowTax;
      totalCgst += c;
      totalSgst += s;
    } else {
      const ig = rowTax;
      gstMap[rate].igst += ig;
      gstMap[rate].total += rowTax;
      totalIgst += ig;
    }
  });

  const totalTax = supplyType === 'intra' ? totalCgst + totalSgst : totalIgst;
  const grandTotal = taxableTotal + totalTax;
  const terms = (seller.terms || '').replace(/\\n/g, '\n');

  return (
    <>
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" 
        strategy="lazyOnload"
      />

      <div className="share-container">
        {/* Toolbar */}
        <div className="share-toolbar">
          <div className="share-toolbar-logo">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="6" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="2.5" />
              <path d="M4 14H36" stroke="currentColor" strokeWidth="2.5" />
              <path d="M12 6V14" stroke="currentColor" strokeWidth="2.5" />
              <path d="M28 6V14" stroke="currentColor" strokeWidth="2.5" />
              <path d="M12 22H20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M12 28H28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="30" cy="22" r="3" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span>InvoiceGST</span>
          </div>
          <div className="share-toolbar-actions">
            <button className="btn btn-ghost" onClick={handlePrint} id="btnPrint">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6,9 6,2 18,2 18,9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              Print
            </button>
            <button className="btn btn-primary" onClick={handleDownloadPdf} id="btnDownloadPdf">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7,10 12,15 17,10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              Download PDF
            </button>
          </div>
        </div>

        {/* Invoice Page Card */}
        <div className="invoice-card-wrapper" id="invoiceCardWrapper">
          <div id="invoicePreview">
            <div className="inv-header">
              <div>
                <div className="inv-company-name">{seller.name || 'Seller Business'}</div>
                <div className="inv-company-detail">
                  {seller.address && <>{seller.address}<br /></>}
                  {seller.state_code && <>{getStateName(seller.state_code)}<br /></>}
                  {(seller.phone || seller.email) && (
                    <>{seller.phone && `📞 ${seller.phone}`} {seller.email && `✉️ ${seller.email}`}<br /></>
                  )}
                  <strong>GSTIN:</strong> {seller.gstin || 'N/A'}
                </div>
              </div>
              <div className="inv-title-block">
                <div className="inv-title">Tax Invoice</div>
                <div className="inv-meta">
                  <strong>Invoice #:</strong> {invNum}<br />
                  <strong>Date:</strong> {invDate}<br />
                  {dueDate && <><strong>Due Date:</strong> {dueDate}<br /></>}
                  <strong>Place of Supply:</strong> {getStateName(invoice.place_of_supply)}
                </div>
              </div>
            </div>

            <div className="inv-parties">
              <div>
                <div className="inv-party-label">Bill To</div>
                <div className="inv-party-name">{buyer.name}</div>
                <div className="inv-party-info">
                  {buyer.address && <>{buyer.address}<br /></>}
                  {buyer.state && <>{buyer.state}<br /></>}
                  {buyer.phone && <>📞 {buyer.phone}<br /></>}
                  {buyer.gstin && <><strong>GSTIN:</strong> {buyer.gstin}</>}
                </div>
              </div>
              <div>
                <div className="inv-party-label">Ship To</div>
                <div className="inv-party-name">{buyer.name}</div>
                <div className="inv-party-info">
                  {buyer.address ? buyer.address : 'Same as billing'}
                </div>
              </div>
            </div>

            <table className="inv-items-table">
              <thead>
                <tr>
                  <th className="text-center">#</th>
                  <th>Description</th>
                  <th className="text-center">HSN/SAC</th>
                  <th className="text-center">Qty</th>
                  <th className="text-center">Unit</th>
                  <th className="text-right">Rate</th>
                  <th className="text-center">Disc%</th>
                  <th className="text-center">GST%</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const gross = (item.qty || 1) * (item.rate || 0);
                  const discAmt = gross * ((item.discount_percent || 0) / 100);
                  const rowTotal = gross - discAmt;

                  return (
                    <tr key={idx}>
                      <td className="text-center">{idx + 1}</td>
                      <td>
                        {item.description}
                        {item.qty_per_unit && item.qty_per_unit > 1 && (
                          <>
                            <br />
                            <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                              (Qty/Unit: {item.qty_per_unit})
                            </small>
                          </>
                        )}
                      </td>
                      <td className="text-center">{item.hsn_sac || '—'}</td>
                      <td className="text-center">{item.qty}</td>
                      <td className="text-center">{item.unit}</td>
                      <td className="text-right">₹{formatNumber(item.rate)}</td>
                      <td className="text-center">{item.discount_percent}%</td>
                      <td className="text-center">{item.gst_rate}%</td>
                      <td className="text-right">₹{formatNumber(rowTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="inv-totals">
              <div className="inv-totals-table">
                <div className="inv-totals-row">
                  <span>Subtotal</span>
                  <span className="val">₹{formatNumber(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="inv-totals-row discount">
                    <span>Discount</span>
                    <span className="val">−₹{formatNumber(totalDiscount)}</span>
                  </div>
                )}
                <div className="inv-totals-row">
                  <span>Taxable Amount</span>
                  <span className="val">₹{formatNumber(taxableTotal)}</span>
                </div>
                <hr className="inv-totals-divider" />
                {supplyType === 'intra' ? (
                  <>
                    <div className="inv-totals-row">
                      <span>CGST</span>
                      <span className="val">₹{formatNumber(totalCgst)}</span>
                    </div>
                    <div className="inv-totals-row">
                      <span>SGST</span>
                      <span className="val">₹{formatNumber(totalSgst)}</span>
                    </div>
                  </>
                ) : (
                  <div className="inv-totals-row">
                    <span>IGST</span>
                    <span className="val">₹{formatNumber(totalIgst)}</span>
                  </div>
                )}
                <div className="inv-totals-row total">
                  <span>Grand Total</span>
                  <span className="val">₹{formatNumber(grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="inv-amount-words">
              <strong>Amount in Words:</strong> {numberToWords(Math.round(grandTotal))}
            </div>

            <table className="inv-gst-table">
              <thead>
                <tr>
                  {supplyType === 'intra' ? (
                    <>
                      <th>Rate</th>
                      <th>Taxable</th>
                      <th>CGST</th>
                      <th>SGST</th>
                      <th>Total Tax</th>
                    </>
                  ) : (
                    <>
                      <th>Rate</th>
                      <th>Taxable</th>
                      <th>IGST</th>
                      <th>Total Tax</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {Object.keys(gstMap)
                  .sort((a, b) => parseFloat(a) - parseFloat(b))
                  .map((rate) => {
                    const r = gstMap[rate];
                    if (r.taxable === 0) return null;
                    return supplyType === 'intra' ? (
                      <tr key={rate}>
                        <td>{rate}%</td>
                        <td>₹{formatNumber(r.taxable)}</td>
                        <td>₹{formatNumber(r.cgst)}</td>
                        <td>₹{formatNumber(r.sgst)}</td>
                        <td>₹{formatNumber(r.total)}</td>
                      </tr>
                    ) : (
                      <tr key={rate}>
                        <td>{rate}%</td>
                        <td>₹{formatNumber(r.taxable)}</td>
                        <td>₹{formatNumber(r.igst)}</td>
                        <td>₹{formatNumber(r.total)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            {terms && (
              <div className="inv-bank-section">
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="inv-terms-title">Terms & Conditions</div>
                  <div className="inv-terms-text">{terms}</div>
                </div>
              </div>
            )}

            <div className="inv-signature">
              <div className="inv-sig-line"></div>
              <div className="inv-sig-label">Authorized Signatory</div>
            </div>
            <div className="inv-footer">This is a computer-generated invoice. Shared via InvoiceGST.</div>
          </div>
        </div>
      </div>
    </>
  );
}
