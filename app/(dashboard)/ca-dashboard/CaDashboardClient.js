'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateDisplay, formatNumber, formatDateISO } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { logClientError } from '@/lib/logError';

export default function CaDashboardClient() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [renderLimit, setRenderLimit] = useState(20);

  useEffect(() => {
    // Default to current month
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    setStartDate(formatDateISO(start));
    setEndDate(formatDateISO(end));

    async function fetchCaData() {
      try {
        const res = await fetch('/api/ca/gst-report');
        if (!res.ok) throw new Error('Failed to load CA reports');
        const data = await res.json();
        setInvoices(data);
      } catch (err) {
        toast.error('Failed to load audit ledger data');
      logClientError('app/(dashboard)/ca-dashboard/CaDashboardClient.js', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCaData();
  }, []);

  const handleFilterThisMonth = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setStartDate(formatDateISO(start));
    setEndDate(formatDateISO(end));
    setRenderLimit(20);
  };

  const handleFilterLastMonth = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    setStartDate(formatDateISO(start));
    setEndDate(formatDateISO(end));
    setRenderLimit(20);
  };

  const handleFilterThisFY = () => {
    const today = new Date();
    let startYear = today.getFullYear();
    if (today.getMonth() < 3) {
      startYear = startYear - 1;
    }
    const start = new Date(startYear, 3, 1); // April 1st
    const end = new Date(startYear + 1, 2, 31); // March 31st
    setStartDate(formatDateISO(start));
    setEndDate(formatDateISO(end));
    setRenderLimit(20);
  };

  // Filter invoices on client side
  const filteredInvoices = useMemo(() => {
    if (!startDate || !endDate) return invoices;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');

    return invoices.filter((inv) => {
      const d = new Date(inv.invoice_date + 'T00:00:00');
      return d >= start && d <= end;
    });
  }, [invoices, startDate, endDate]);

  // Aggregate totals
  const aggregates = useMemo(() => {
    let gross = 0, taxable = 0, cgst = 0, sgst = 0, igst = 0;
    filteredInvoices.forEach((inv) => {
      gross += inv.grand_total || 0;
      taxable += inv.taxable_amount || 0;
      cgst += inv.cgst || 0;
      sgst += inv.sgst || 0;
      igst += inv.igst || 0;
    });
    return {
      gross,
      taxable,
      cgst,
      sgst,
      igst,
      gstTotal: cgst + sgst + igst,
    };
  }, [filteredInvoices]);

  const pagedInvoices = useMemo(() => {
    return filteredInvoices.slice(0, renderLimit);
  }, [filteredInvoices, renderLimit]);

  // CSV EXPORTS
  const triggerDownload = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded ${filename}`);
  };

  const exportGstr1B2B = () => {
    const filteredB2B = filteredInvoices.filter((inv) => inv.buyer_gstin);
    if (!filteredB2B.length) {
      toast.error('No B2B invoices found in the selected date range.');
      return;
    }

    let csv = 'GSTIN of Receiver,Receiver Name,Invoice Number,Invoice Date,Invoice Value,Place Of Supply,Reverse Charge,Invoice Type,Rate,Taxable Value,CGST,SGST,IGST\n';

    filteredB2B.forEach((inv) => {
      const rates = [...new Set((inv.items || []).map((item) => item.gst_rate || 18))];
      rates.forEach((rate) => {
        let rateTaxable = 0, rateCgst = 0, rateSgst = 0, rateIgst = 0;
        (inv.items || []).forEach((item) => {
          if ((item.gst_rate || 18) === rate) {
            const gross = (item.qty || 1) * (item.rate || 0);
            const disc = gross * ((item.discount_percent || 0) / 100);
            const taxable = gross - disc;
            rateTaxable += taxable;
            if (inv.supply_type === 'inter') {
              rateIgst += taxable * (rate / 100);
            } else {
              const half = rate / 2;
              rateCgst += taxable * (half / 100);
              rateSgst += taxable * (half / 100);
            }
          }
        });
        if (rateTaxable > 0) {
          csv += `"${inv.buyer_gstin}","${(inv.buyer_name || '').replace(/"/g, '""')}","${inv.invoice_number}","${inv.invoice_date}",${inv.grand_total},"29-Karnataka","N","Regular",${rate},${rateTaxable.toFixed(2)},${rateCgst.toFixed(2)},${rateSgst.toFixed(2)},${rateIgst.toFixed(2)}\n`;
        }
      });
    });

    triggerDownload(csv, `GSTR1_B2B_${startDate}_to_${endDate}.csv`);
  };

  const exportGstr1B2CS = () => {
    const filteredB2CS = filteredInvoices.filter((inv) => !inv.buyer_gstin);
    if (!filteredB2CS.length) {
      toast.error('No B2CS invoices found in the selected date range.');
      return;
    }

    let csv = 'Type,Place Of Supply,Rate,Taxable Value,CGST,SGST,IGST,Total Value\n';
    const groups = {};
    filteredB2CS.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        const rate = item.gst_rate || 18;
        const key = `29-Karnataka_${rate}`;
        const gross = (item.qty || 1) * (item.rate || 0);
        const disc = gross * ((item.discount_percent || 0) / 100);
        const taxable = gross - disc;
        let cgst = 0, sgst = 0, igst = 0;
        if (inv.supply_type === 'inter') {
          igst = taxable * (rate / 100);
        } else {
          const half = rate / 2;
          cgst = taxable * (half / 100);
          sgst = taxable * (half / 100);
        }
        if (!groups[key]) {
          groups[key] = { pos: '29-Karnataka', rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
        }
        groups[key].taxable += taxable;
        groups[key].cgst += cgst;
        groups[key].sgst += sgst;
        groups[key].igst += igst;
        groups[key].total += taxable + cgst + sgst + igst;
      });
    });

    Object.values(groups).forEach((g) => {
      csv += `OE,"${g.pos}",${g.rate},${g.taxable.toFixed(2)},${g.cgst.toFixed(2)},${g.sgst.toFixed(2)},${g.igst.toFixed(2)},${g.total.toFixed(2)}\n`;
    });

    triggerDownload(csv, `GSTR1_B2CS_${startDate}_to_${endDate}.csv`);
  };

  const downloadDetailedGstReport = () => {
    if (!filteredInvoices.length) {
      toast.error('No invoices found in the selected date range.');
      return;
    }

    let csv = 'Invoice Date,Invoice Number,Buyer Name,Buyer GSTIN,Supply Type,Item Description,HSN/SAC,Qty,Unit,Rate,Discount %,Taxable Value,GST Rate %,CGST,SGST,IGST,Total GST,Grand Total\n';
    filteredInvoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        const gross = (item.qty || 1) * (item.rate || 0);
        const disc = gross * ((item.discount_percent || 0) / 100);
        const taxable = gross - disc;
        const rate = item.gst_rate || 18;
        let cgst = 0, sgst = 0, igst = 0;
        if (inv.supply_type === 'inter') {
          igst = taxable * (rate / 100);
        } else {
          const half = rate / 2;
          cgst = taxable * (half / 100);
          sgst = taxable * (half / 100);
        }
        const itemGst = cgst + sgst + igst;
        const itemTotal = taxable + itemGst;
        csv += `"${inv.invoice_date}","${inv.invoice_number}","${(inv.buyer_name || '').replace(/"/g, '""')}","${inv.buyer_gstin || ''}","${inv.supply_type}","${(item.description || '').replace(/"/g, '""')}","${item.hsn_sac || ''}",${item.qty},"${item.unit}",${item.rate},${item.discount_percent || 0},${taxable.toFixed(2)},${rate},${cgst.toFixed(2)},${sgst.toFixed(2)},${igst.toFixed(2)},${itemGst.toFixed(2)},${itemTotal.toFixed(2)}\n`;
      });
    });

    triggerDownload(csv, `Detailed_GST_Report_${startDate}_to_${endDate}.csv`);
  };

  if (loading) {
    return (
      <div className="page-body">
        <p className="page-empty-state">Loading audit dashboard...</p>
      </div>
    );
  }

  return (
    <section className="page active" id="pageCaDashboard">
      <div className="page-header">
        <h1 className="page-title">💼 CA & GST Audit Dashboard</h1>
        <div className="page-actions">
          <button className="btn btn-accent" onClick={exportGstr1B2B} title="Export GSTR-1 B2B CSV">Export B2B (CSV)</button>
          <button className="btn btn-accent" onClick={exportGstr1B2CS} title="Export GSTR-1 B2CS CSV">Export B2CS (CSV)</button>
          <button className="btn btn-primary" onClick={downloadDetailedGstReport} title="Download Detailed GST Audit Sheet">Detailed Report</button>
        </div>
      </div>
      
      <div className="page-body">
        {/* Filters Card */}
        <div className="card card-glow" style={{ marginBottom: '1.5rem' }}>
          <div className="card-body">
            <div className="form-grid cols-3" style={{ alignItems: 'flex-end' }}>
              <div className="form-group">
                <label htmlFor="caStartDate">Start Date</label>
                <input 
                  type="date" 
                  id="caStartDate" 
                  value={startDate} 
                  onChange={(e) => { setStartDate(e.target.value); setRenderLimit(20); }} 
                />
              </div>
              <div className="form-group">
                <label htmlFor="caEndDate">End Date</label>
                <input 
                  type="date" 
                  id="caEndDate" 
                  value={endDate} 
                  onChange={(e) => { setEndDate(e.target.value); setRenderLimit(20); }} 
                />
              </div>
              <div className="form-group" style={{ flexDirection: 'row', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleFilterThisMonth}>This Month</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleFilterLastMonth}>Last Month</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleFilterThisFY}>This FY</button>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="dash-kpi-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: '1.5rem' }} id="caKpiGrid">
          <div className="dash-kpi">
            <div className="dash-kpi-icon gradient-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </div>
            <div className="dash-kpi-data">
              <div className="dash-kpi-value" id="caKpiGross">₹{formatNumber(aggregates.gross)}</div>
              <div className="dash-kpi-label">Gross Total</div>
            </div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-icon gradient-purple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </div>
            <div className="dash-kpi-data">
              <div className="dash-kpi-value" id="caKpiTaxable">₹{formatNumber(aggregates.taxable)}</div>
              <div className="dash-kpi-label">Taxable Value</div>
            </div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-icon gradient-green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div className="dash-kpi-data">
              <div className="dash-kpi-value" id="caKpiCgst">₹{formatNumber(aggregates.cgst)}</div>
              <div className="dash-kpi-label">CGST</div>
            </div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-icon gradient-orange">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div className="dash-kpi-data">
              <div className="dash-kpi-value" id="caKpiSgst">₹{formatNumber(aggregates.sgst)}</div>
              <div className="dash-kpi-label">SGST</div>
            </div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-icon gradient-pink">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div className="dash-kpi-data">
              <div className="dash-kpi-value" id="caKpiIgst">₹{formatNumber(aggregates.igst)}</div>
              <div className="dash-kpi-label">IGST</div>
            </div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-icon gradient-teal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div className="dash-kpi-data">
              <div className="dash-kpi-value" id="caKpiGstTotal">₹{formatNumber(aggregates.gstTotal)}</div>
              <div className="dash-kpi-label">Total GST</div>
            </div>
          </div>
        </div>

        {/* Ledger Card */}
        <div className="card card-glow">
          <div className="card-header">
            <h2>GST Audit Ledger</h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="items-table-wrapper" style={{ margin: 0 }}>
              <table className="items-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice No</th>
                    <th>Buyer Name</th>
                    <th>Buyer GSTIN</th>
                    <th>Supply Type</th>
                    <th className="text-right">Taxable Amt (₹)</th>
                    <th className="text-right">CGST (₹)</th>
                    <th className="text-right">SGST (₹)</th>
                    <th className="text-right">IGST (₹)</th>
                    <th className="text-right">Grand Total (₹)</th>
                  </tr>
                </thead>
                <tbody id="caLedgerBody">
                  {pagedInvoices.length > 0 ? (
                    pagedInvoices.map((inv) => (
                      <tr 
                        key={inv.id} 
                        style={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/invoice?id=${inv.id}&preview=true`)}
                      >
                        <td>{formatDateDisplay(inv.invoice_date)}</td>
                        <td className="mono" style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                        <td>{inv.buyer_name || 'No customer'}</td>
                        <td className="mono">{inv.buyer_gstin || '—'}</td>
                        <td>
                          <span className={`badge ${inv.supply_type === 'inter' ? 'badge-buyer' : 'badge-seller'}`}>
                            {inv.supply_type === 'inter' ? 'Interstate' : 'Intrastate'}
                          </span>
                        </td>
                        <td className="text-right font-mono">₹{formatNumber(inv.taxable_amount || 0)}</td>
                        <td className="text-right font-mono" style={{ color: 'var(--text-secondary)' }}>₹{formatNumber(inv.cgst || 0)}</td>
                        <td className="text-right font-mono" style={{ color: 'var(--text-secondary)' }}>₹{formatNumber(inv.sgst || 0)}</td>
                        <td className="text-right font-mono" style={{ color: 'var(--text-secondary)' }}>₹{formatNumber(inv.igst || 0)}</td>
                        <td className="text-right font-mono" style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>₹{formatNumber(inv.grand_total || 0)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" className="page-empty-state">No invoices found for the selected date range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {filteredInvoices.length > renderLimit && (
              <div id="caLoadMoreContainer" style={{ display: 'flex', justifyContent: 'center', padding: '1.25rem', width: '100%', borderTop: '1px solid var(--border-subtle)' }}>
                <button 
                  id="btnLoadMoreCa" 
                  className="btn" 
                  onClick={() => setRenderLimit((prev) => prev + 20)}
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontWeight: '500', fontSize: '0.875rem', padding: '0.5rem 1.5rem' }}
                >
                  Load More Invoices (Showing {renderLimit} of {filteredInvoices.length})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
