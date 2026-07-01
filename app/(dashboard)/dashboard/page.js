'use client';

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { formatNumber } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { logClientError } from '@/lib/logError';

// Email badge display disabled
// const getEmailBadge = (status) => {
//   switch (status) {
//     case 'sending':
//       return <span className="badge badge-email-sending" style={{ marginLeft: '0.5rem' }}>✉️ Sending</span>;
//     case 'sent':
//       return <span className="badge badge-email-sent" style={{ marginLeft: '0.5rem' }}>✉️ Emailed</span>;
//     case 'failed':
//       return <span className="badge badge-email-failed" style={{ marginLeft: '0.5rem' }}>✉️ Failed</span>;
//     case 'not_configured':
//       return <span className="badge badge-email-not_configured" style={{ marginLeft: '0.5rem' }} title="SMTP not configured. Link logged to server console.">✉️ Logged</span>;
//     case 'disabled':
//       return <span className="badge badge-email-disabled" style={{ marginLeft: '0.5rem' }} title="Automatic email sending is turned off in settings.">✉️ Disabled</span>;
//     default:
//       return null;
//   }
// };

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        toast.error('Failed to load dashboard data');
      logClientError('app/(dashboard)/dashboard/page.js', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  const initChart = () => {
    if (!data || !data.monthlySales || !window.Chart || !chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');
    const labels = data.monthlySales.map(m => {
      const [year, month] = m.month.split('-');
      return new Date(year, parseInt(month) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    });
    const salesData = data.monthlySales.map(m => m.sales);
    const countData = data.monthlySales.map(m => m.count);

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Sales (₹)',
            data: salesData,
            backgroundColor: 'rgba(99,102,241,0.7)',
            borderColor: 'rgba(99,102,241,0.9)',
            borderWidth: 1,
            borderRadius: 6,
            yAxisID: 'y',
          },
          {
            label: 'Invoices',
            data: countData,
            type: 'line',
            borderColor: 'rgba(45,212,191,0.8)',
            backgroundColor: 'rgba(45,212,191,0.15)',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: 'rgba(45,212,191,1)',
            pointRadius: 4,
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              boxWidth: 8,
              font: { family: "'Inter', sans-serif", size: 12 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { size: 13 },
            bodyFont: { size: 13 },
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.datasetIndex === 0 ? '₹' + formatNumber(context.parsed.y) : context.parsed.y;
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: "'Inter', sans-serif" } }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              font: { family: "'Inter', sans-serif" },
              callback: function(value) {
                return '₹' + formatCompact(value).replace('₹', '');
              }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              font: { family: "'Inter', sans-serif" },
              stepSize: 1
            }
          }
        }
      }
    });
  };

  useEffect(() => {
    if (data) {
      initChart();
    }
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [data]);

  function formatCompact(num) {
    if (num >= 10000000) return '₹' + (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return '₹' + (num / 100000).toFixed(2) + ' L';
    if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K';
    return '₹' + formatNumber(num);
  }

  if (loading) {
    return (
      <div className="page-body dash-body">
        <p className="page-empty-state">Loading sales dashboard...</p>
      </div>
    );
  }

  if (!data) return null;

  const t = data.totals;

  return (
    <>
      <Script 
        src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js" 
        strategy="lazyOnload"
        onLoad={initChart}
      />

      <section className="page active" id="pageDashboard">
        <div className="page-header">
          <h1 className="page-title">📊 Sales Dashboard</h1>
        </div>
        <div className="page-body dash-body">
          {/* KPI GRID */}
          <div className="dash-kpi-grid" id="dashKpiGrid">
            <div className="dash-kpi">
              <div className="dash-kpi-icon gradient-blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h12" />
                  <path d="M6 8h12" />
                  <path d="M6 13h8.5a4.5 4.5 0 0 0 0-9H6" />
                  <path d="M6 13h3l9 9" />
                </svg>
              </div>
              <div className="dash-kpi-data">
                <div className="dash-kpi-value" id="kpiTotalSalesVal">{formatCompact(t.total_sales)}</div>
                <div className="dash-kpi-label">Total Revenue</div>
              </div>
            </div>
            
            <div className="dash-kpi">
              <div className="dash-kpi-icon gradient-purple">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                </svg>
              </div>
              <div className="dash-kpi-data">
                <div className="dash-kpi-value" id="kpiInvoiceCountVal">{t.total_invoices}</div>
                <div className="dash-kpi-label">Total Invoices</div>
              </div>
            </div>

            <div className="dash-kpi">
              <div className="dash-kpi-icon gradient-green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" />
                  <polyline points="17,6 23,6 23,12" />
                </svg>
              </div>
              <div className="dash-kpi-data">
                <div className="dash-kpi-value" id="kpiAvgInvoiceVal">{formatCompact(t.avg_invoice)}</div>
                <div className="dash-kpi-label">Avg. Invoice</div>
              </div>
            </div>

            <div className="dash-kpi">
              <div className="dash-kpi-icon gradient-orange">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              </div>
              <div className="dash-kpi-data">
                <div className="dash-kpi-value" id="kpiTotalTaxVal">{formatCompact(t.total_tax)}</div>
                <div className="dash-kpi-label">GST Collected</div>
              </div>
            </div>
          </div>

          {/* CHART & THIS MONTH CARD */}
          <div className="dash-row">
            <div className="dash-card dash-chart-card">
              <h3>Monthly Sales (Last 12 Months)</h3>
              <div className="dash-chart-container">
                <canvas ref={chartRef} id="monthlySalesChart"></canvas>
              </div>
            </div>

            <div className="dash-card dash-month-card">
              <h3>This Month</h3>
              <div className="dash-month-stats">
                <div className="dash-month-stat">
                  <div className="dash-month-val" id="dashThisMonthSales">{formatCompact(data.currentMonth.sales)}</div>
                  <div className="dash-month-label">Sales</div>
                </div>
                <div className="dash-month-stat">
                  <div className="dash-month-val" id="dashThisMonthCount">{data.currentMonth.invoices}</div>
                  <div className="dash-month-label">Invoices</div>
                </div>
              </div>
              <div className="dash-month-comparison" id="dashMonthComparison">
                {data.prevMonth.sales > 0 ? (
                  (() => {
                    const pctChange = ((data.currentMonth.sales - data.prevMonth.sales) / data.prevMonth.sales * 100).toFixed(1);
                    return parseFloat(pctChange) >= 0 ? (
                      <span className="positive">▲ {pctChange}% vs last month</span>
                    ) : (
                      <span className="negative">▼ {Math.abs(pctChange)}% vs last month</span>
                    );
                  })()
                ) : data.currentMonth.sales > 0 ? (
                  <span className="positive">🎉 First month with sales!</span>
                ) : (
                  'No sales data to compare'
                )}
              </div>

              <h3 style={{ marginTop: '1.25rem' }}>GST Breakdown</h3>
              <div className="dash-tax-grid">
                <div className="dash-tax-item">
                  <span className="dash-tax-label">CGST</span>
                  <span className="dash-tax-val" id="dashTotalCgst">₹{formatNumber(t.total_cgst)}</span>
                </div>
                <div className="dash-tax-item">
                  <span className="dash-tax-label">SGST</span>
                  <span className="dash-tax-val" id="dashTotalSgst">₹{formatNumber(t.total_sgst)}</span>
                </div>
                <div className="dash-tax-item">
                  <span className="dash-tax-label">IGST</span>
                  <span className="dash-tax-val" id="dashTotalIgst">₹{formatNumber(t.total_igst)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* TABLES */}
          <div className="dash-row">
            <div className="dash-card">
              <h3>🏆 Top Products by Revenue</h3>
              <div id="dashTopProducts" className="dash-table-container">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Sales</th>
                    </tr>
                  </thead>
                  <tbody id="topProductsBody">
                    {data.topProducts && data.topProducts.length > 0 ? (
                      data.topProducts.map((p, idx) => (
                        <tr key={idx}>
                          <td>
                            <div className="product-name-cell" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div className="avatar-sm" style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>
                              <div>
                                <div style={{ fontWeight: 600 }}>{p.description || 'Unknown'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.hsn_sac || 'No HSN'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>{p.total_qty}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{formatNumber(p.total_sales)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="page-empty-state" style={{ padding: '2rem' }}>No products sold yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="dash-card">
              <h3>👥 Top Customers</h3>
              <div id="dashTopCustomers" className="dash-table-container">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th style={{ textAlign: 'right' }}>Invoices</th>
                      <th style={{ textAlign: 'right' }}>Spending</th>
                    </tr>
                  </thead>
                  <tbody id="topCustomersBody">
                    {data.topCustomers && data.topCustomers.length > 0 ? (
                      data.topCustomers.map((c, idx) => (
                        <tr key={idx}>
                          <td>
                            <div className="customer-name-cell" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div className="avatar-sm" style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-green)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {(c.buyer_name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600 }}>{c.buyer_name || 'Cash Customer'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.buyer_gstin || ''}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>{c.invoice_count}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{formatNumber(c.total_sales)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="page-empty-state" style={{ padding: '2rem' }}>No customer data yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="dash-card">
            <h3>📄 Recent Invoices</h3>
            <div id="dashRecentInvoices" className="dash-table-container">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody id="recentInvoicesBody">
                  {data.recentInvoices && data.recentInvoices.length > 0 ? (
                    data.recentInvoices.map((inv, idx) => (
                      <tr key={idx}>
                        <td className="mono" style={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                          {inv.invoice_number}
                          {/* Email badge disabled */}
                        </td>
                        <td>{new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td>{inv.buyer_name || 'Cash Customer'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent-blue)' }}>₹{formatNumber(inv.grand_total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="page-empty-state" style={{ padding: '2rem' }}>No recent invoices found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
