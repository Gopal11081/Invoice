'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import { INDIAN_STATES, GST_RATES, UNITS, getStateName, formatNumber, numberToWords, formatDateISO, formatDateDisplay } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { logClientError } from '@/lib/logError';

function InvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const previewOnly = searchParams.get('preview') === 'true';

  // Config and Autocomplete databases
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sellerConfig, setSellerConfig] = useState(null);

  // Form states
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('29'); // Force Karnataka
  const [supplyType, setSupplyType] = useState('intra'); // Force Intrastate

  const [buyerName, setBuyerName] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerState, setBuyerState] = useState('29'); // Force Karnataka
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');

  const [notes, setNotes] = useState('');

  // Items list state
  const [items, setItems] = useState([
    { id: 1, productId: '', description: '', hsn: '', qty: 1, unit: 'Nos', rate: 0, discount: 0, gstRate: 18, qtyPerUnit: 1 }
  ]);
  const [nextItemId, setNextItemId] = useState(2);

  // Modal states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Load configuration
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [prodRes, custRes, bizRes] = await Promise.all([
          fetch('/api/products').then((r) => r.json()),
          fetch('/api/customers').then((r) => r.json()),
          fetch('/api/business').then((r) => r.json())
        ]);

        setProducts(prodRes || []);
        setCustomers(custRes || []);
        setSellerConfig(bizRes || null);

        // Populate business details
        if (bizRes) {
          setNotes(bizRes.terms || '');
          if (!editId) {
            const defaultState = bizRes.state_code || '29';
            setPlaceOfSupply(defaultState);
            setBuyerState(defaultState);
            setSupplyType('intra');
          }
        }

        // Check if editing
        if (editId) {
          const invRes = await fetch(`/api/invoices/${editId}`);
          if (!invRes.ok) throw new Error('Invoice not found');
          const inv = await invRes.json();

          setInvoiceNumber(inv.invoice_number || '');
          setInvoiceDate(inv.invoice_date || '');
          setDueDate(inv.due_date || '');
          setPlaceOfSupply(inv.place_of_supply || '29');
          setSupplyType(inv.supply_type || 'intra');

          setBuyerName(inv.buyer_name || '');
          setBuyerGstin(inv.buyer_gstin || '');
          setBuyerAddress(inv.buyer_address || '');
          setBuyerState(inv.buyer_state || '29');
          setBuyerPhone(inv.buyer_phone || '');
          setBuyerEmail(inv.buyer_email || '');
          setNotes(inv.notes || '');

          if (inv.items && inv.items.length > 0) {
            const mappedItems = inv.items.map((it, idx) => ({
              id: idx + 1,
              productId: '', // Reset to custom item style unless product description matches
              description: it.description || '',
              hsn: it.hsn_sac || '',
              qty: it.qty || 1,
              unit: it.unit || 'Nos',
              rate: it.rate || 0,
              discount: it.discount_percent || 0,
              gstRate: it.gst_rate || 18,
              qtyPerUnit: it.qty_per_unit || 1
            }));
            setItems(mappedItems);
            setNextItemId(mappedItems.length + 1);
          }

          if (previewOnly) {
            setPreviewOpen(true);
          }
        } else {
          // New invoice defaults
          setDefaultDates();
          fetchNextInvoiceNumber();
        }
      } catch (err) {
        toast.error('Failed to load catalog configurations');
      logClientError('app/(dashboard)/invoice/page.js', err);
      }
    }
    loadInitialData();
  }, [editId, previewOnly]);

  const setDefaultDates = () => {
    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + 30);
    setInvoiceDate(formatDateISO(today));
    setDueDate(formatDateISO(due));
  };

  const fetchNextInvoiceNumber = async () => {
    try {
      const res = await fetch('/api/invoices/next-number');
      const data = await res.json();
      setInvoiceNumber(data.invoice_number);
    } catch (e) {
      logClientError('app/(dashboard)/invoice/page.js', e);
    }
  };

  // Customer selection helper
  const handleBuyerNameChange = (e) => {
    const val = e.target.value;
    setBuyerName(val);

    const match = customers.find((c) => c.name.toLowerCase() === val.trim().toLowerCase());
    if (match) {
      setBuyerGstin(match.gstin || '');
      setBuyerAddress(match.address || '');
      const bState = match.state_code || sellerConfig?.state_code || '29';
      setBuyerState(bState);
      setPlaceOfSupply(bState);
      if (sellerConfig) {
        setSupplyType(bState === sellerConfig.state_code ? 'intra' : 'inter');
      }
      setBuyerPhone(match.phone || '');
      setBuyerEmail(match.email || '');
    }
  };

  // Item helpers
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: nextItemId, productId: '', description: '', hsn: '', qty: 1, unit: 'Nos', rate: 0, discount: 0, gstRate: 18, qtyPerUnit: 1 }
    ]);
    setNextItemId((prev) => prev + 1);
  };

  const handleRemoveItem = (id) => {
    if (items.length <= 1) {
      toast.error('At least one item is required');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleUpdateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item };
        if (['qty', 'rate', 'discount', 'gstRate'].includes(field)) {
          updated[field] = parseFloat(value) || 0;
        } else {
          updated[field] = value;
        }
        return updated;
      })
    );
  };

  const handleProductSelect = (itemId, productId) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (productId === '__custom__' || !productId) {
          return {
            ...item,
            productId: '',
            description: productId === '__custom__' ? 'Custom Item' : '',
            hsn: '',
            unit: 'Nos',
            rate: 0,
            gstRate: 18,
            qtyPerUnit: 1
          };
        } else {
          const prod = products.find((p) => p.id === parseInt(productId));
          if (prod) {
            return {
              ...item,
              productId: prod.id,
              description: prod.description,
              hsn: prod.hsn_sac,
              unit: prod.unit,
              rate: prod.rate,
              gstRate: prod.gst_rate,
              qtyPerUnit: prod.qty_per_unit || 1
            };
          }
        }
        return item;
      })
    );
  };

  const calcItemTotal = (item) => {
    const grossInclusive = item.qty * item.rate;
    return grossInclusive - grossInclusive * (item.discount / 100);
  };

  const calcItemTaxable = (item) => {
    const totalInclusive = calcItemTotal(item);
    return totalInclusive / (1 + (item.gstRate / 100));
  };

  // Real-time invoice aggregation calculation
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let taxableTotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    const gstBreakdown = {};

    items.forEach((item) => {
      const grossInclusive = item.qty * item.rate;
      const discountAmtInclusive = grossInclusive * (item.discount / 100);
      const totalInclusive = grossInclusive - discountAmtInclusive;

      const taxable = totalInclusive / (1 + (item.gstRate / 100));
      const taxAmount = totalInclusive - taxable;

      subtotal += grossInclusive;
      totalDiscount += discountAmtInclusive;
      taxableTotal += taxable;

      const rate = item.gstRate;
      if (!gstBreakdown[rate]) {
        gstBreakdown[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
      }
      gstBreakdown[rate].taxable += taxable;

      if (supplyType === 'intra') {
        const cgst = taxAmount / 2;
        const sgst = taxAmount / 2;
        gstBreakdown[rate].cgst += cgst;
        gstBreakdown[rate].sgst += sgst;
        gstBreakdown[rate].totalTax += taxAmount;
        totalCgst += cgst;
        totalSgst += sgst;
      } else {
        const igst = taxAmount;
        gstBreakdown[rate].igst += igst;
        gstBreakdown[rate].totalTax += taxAmount;
        totalIgst += igst;
      }
    });

    const totalTax = supplyType === 'intra' ? totalCgst + totalSgst : totalIgst;
    const grandTotal = taxableTotal + totalTax;

    return {
      subtotal,
      totalDiscount,
      taxableTotal,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      grandTotal,
      gstBreakdown
    };
  }, [items, supplyType]);

  const handleReset = () => {
    setItems([{ id: 1, productId: '', description: '', hsn: '', qty: 1, unit: 'Nos', rate: 0, discount: 0, gstRate: 18, qtyPerUnit: 1 }]);
    setNextItemId(2);
    setBuyerName('');
    setBuyerGstin('');
    setBuyerAddress('');
    setBuyerPhone('');
    setBuyerEmail('');
    setNotes(sellerConfig?.terms || '');
    const defaultState = sellerConfig?.state_code || '29';
    setPlaceOfSupply(defaultState);
    setBuyerState(defaultState);
    setSupplyType('intra');
    setDefaultDates();
    fetchNextInvoiceNumber();
    toast.success('Invoice form reset');
  };

  const validateInvoice = () => {
    if (!buyerName.trim()) { toast.error('Customer Name is required'); return false; }
    if (!invoiceDate) { toast.error('Invoice Date is required'); return false; }
    if (!dueDate) { toast.error('Due Date is required'); return false; }
    if (buyerGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(buyerGstin.trim())) {
      toast.error('Invalid Buyer GSTIN format (e.g. 22AAAAA0000A1Z5)');
      return false;
    }
    if (buyerPhone && !/^\d{10}$/.test(buyerPhone.trim())) {
      toast.error('Buyer phone number must be a valid 10-digit number.');
      return false;
    }
    if (buyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim())) {
      toast.error('Invalid buyer email address format');
      return false;
    }

    if (items.length === 0) { toast.error('Please add at least one item'); return false; }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.description || !item.description.trim()) {
        toast.error(`Item #${i + 1} must have a description`);
        return false;
      }
      if (item.qty <= 0) {
        toast.error(`Item #${i + 1} quantity must be greater than zero`);
        return false;
      }
      if (item.rate < 0) {
        toast.error(`Item #${i + 1} rate cannot be negative`);
        return false;
      }
    }
    return true;
  };

  const handleSaveInvoice = async (quiet = false) => {
    if (!validateInvoice()) return null;

    const dbItems = items.map((item) => ({
      description: item.description,
      hsn_sac: item.hsn,
      qty: item.qty,
      unit: item.unit,
      rate: item.rate,
      discount_percent: item.discount,
      gst_rate: item.gstRate,
      taxable_amount: calcItemTaxable(item),
      qty_per_unit: item.qtyPerUnit || 1
    }));

    const data = {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      place_of_supply: placeOfSupply,
      supply_type: supplyType,
      buyer_name: buyerName.trim(),
      buyer_gstin: buyerGstin.trim().toUpperCase(),
      buyer_address: buyerAddress.trim(),
      buyer_state: buyerState,
      buyer_phone: buyerPhone.trim(),
      buyer_email: buyerEmail.trim(),
      subtotal: calculations.subtotal,
      total_discount: calculations.totalDiscount,
      taxable_amount: calculations.taxableTotal,
      cgst: calculations.totalCgst,
      sgst: calculations.totalSgst,
      igst: calculations.totalIgst,
      grand_total: calculations.grandTotal,
      amount_in_words: numberToWords(Math.round(calculations.grandTotal)),
      notes: notes.trim(),
      items: dbItems
    };

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      const result = await res.json();

      // Auto email sending disabled — uncomment below to re-enable
      // if (sellerConfig?.send_emails !== false) {
      //   fetch('/api/invoices/email', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({ id: result.id, isUpdate: !!result.updated })
      //   }).catch((e) => {
      //     console.error("Failed to trigger background invoice email:", e);
      //   });
      // }

      if (!quiet) {
        toast.success(result.updated ? 'Invoice updated successfully!' : 'Invoice saved successfully!');
        router.push('/history');
      }
      return result;
    } catch (e) {
      toast.error('Failed to save invoice: ' + e.message);
      logClientError('app/(dashboard)/invoice/page.js', e);
      return null;
    }
  };

  const handlePrint = async () => {
    const saved = await handleSaveInvoice(true);
    if (saved) {
      setPreviewOpen(true);
      setTimeout(() => window.print(), 300);
    }
  };

  const handleDownloadPdf = async () => {
    const saved = await handleSaveInvoice(true);
    if (saved) {
      setPreviewOpen(true);
      try {
        const html2pdf = (await import('html2pdf.js')).default;
        const element = document.getElementById('invoicePreview');
        const opt = {
          margin: [0.3, 0.3, 0.3, 0.3],
          filename: `${invoiceNumber || 'Invoice'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        };
        html2pdf().set(opt).from(element).save().then(() => {
          toast.success('PDF downloaded!');
        });
      } catch (err) {
        toast.error('Failed to generate PDF: ' + err.message);
      }
    }
  };

  const handleShare = async () => {
    const saved = await handleSaveInvoice(true);
    if (!saved) return;
    try {
      const shareRes = await fetch(`/api/invoices/${saved.id}/share`, { method: 'POST' });
      if (!shareRes.ok) throw new Error('Failed to generate share link');
      const shareData = await shareRes.json();
      const origin = window.location.origin;
      const url = `${origin}/share/${shareData.share_token}`;
      setShareUrl(url);
      setCopied(false);
      setShareOpen(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>

      <section className="page active" id="pageInvoice">
        <div className="page-header">
          <h1 className="page-title">{editId ? '✏️ Edit Invoice' : '✏️ Create Invoice'}</h1>
          <div className="page-actions">
            {!previewOnly && (
              <button className="btn btn-ghost" onClick={handleReset} title="Reset Form">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg> New
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setPreviewOpen(true)} title="Preview Invoice">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg> Preview
            </button>
          </div>
        </div>

        <div className="page-body">
          <div className="main-grid">
            {/* LEFT: FORM */}
            <div className="form-column">
              {/* DETAILS */}
              <section className="card card-glow" id="sectionInvoiceMeta">
                <div className="card-header">
                  <div className="card-icon gradient-blue">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <h2>Invoice Details</h2>
                </div>
                <div className="card-body">
                  <div className="form-grid cols-3">
                    <div className="form-group">
                      <label htmlFor="invoiceNumber">Invoice Number</label>
                      <input 
                        type="text" 
                        id="invoiceNumber" 
                        value={invoiceNumber} 
                        readOnly 
                        style={{ background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-muted)', cursor: 'not-allowed' }} 
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="invoiceDate">Invoice Date</label>
                      <input 
                        type="date" 
                        id="invoiceDate" 
                        value={invoiceDate} 
                        onChange={(e) => setInvoiceDate(e.target.value)} 
                        disabled={previewOnly}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="dueDate">Due Date</label>
                      <input 
                        type="date" 
                        id="dueDate" 
                        value={dueDate} 
                        onChange={(e) => setDueDate(e.target.value)} 
                        disabled={previewOnly}
                      />
                    </div>
                  </div>
                  <div className="form-grid cols-3" style={{ marginTop: '1rem' }}>
                    <div className="form-group">
                      <label htmlFor="placeOfSupply">Place of Supply</label>
                      <select
                        id="placeOfSupply"
                        value={placeOfSupply}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPlaceOfSupply(val);
                          if (sellerConfig) {
                            setSupplyType(val === sellerConfig.state_code ? 'intra' : 'inter');
                          }
                        }}
                        disabled={previewOnly}
                      >
                        {INDIAN_STATES.map((state) => (
                          <option key={state.code} value={state.code}>
                            {state.code} - {state.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* SELLER CONFIG DISPLAY */}
              <section className="card card-glow card-readonly" id="sectionSeller">
                <div className="card-header">
                  <div className="card-icon gradient-purple">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      <polyline points="9,22 9,12 15,12 15,22" />
                    </svg>
                  </div>
                  <h2>Your Business</h2>
                  <span className="badge badge-seller">Auto-filled</span>
                </div>
                <div className="card-body seller-display" id="sellerDisplay">
                  {sellerConfig ? (
                    <div className="seller-info-grid">
                      <div className="seller-main">
                        <div className="seller-name">{sellerConfig.name}</div>
                        <div className="seller-detail">
                          {[sellerConfig.address, getStateName(sellerConfig.state_code)].filter(Boolean).join(', ')}
                        </div>
                        <div className="seller-detail" style={{ marginTop: '0.25rem' }}>
                          {[sellerConfig.phone && `📞 ${sellerConfig.phone}`, sellerConfig.email && `✉️ ${sellerConfig.email}`].filter(Boolean).join('  ·  ')}
                        </div>
                      </div>
                      <div className="seller-gstin-block">
                        <div className="seller-gstin-label">GSTIN</div>
                        <div className="seller-gstin-value mono">{sellerConfig.gstin}</div>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)' }}>Loading business configurations...</p>
                  )}
                </div>
              </section>

              {/* BUYER CARD */}
              <section className="card card-glow" id="sectionBuyer">
                <div className="card-header">
                  <div className="card-icon gradient-green">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <h2>Bill To</h2>
                  <span className="badge badge-buyer">Customer</span>
                </div>
                <div className="card-body">
                  <div className="form-grid cols-2">
                    <div className="form-group">
                      <label htmlFor="buyerName">Customer Name *</label>
                      <input
                        type="text"
                        id="buyerName"
                        placeholder="Customer Name / Company"
                        value={buyerName}
                        onChange={handleBuyerNameChange}
                        list="customerList"
                        required
                        disabled={previewOnly}
                      />
                      <datalist id="customerList">
                        {customers.map((c) => (
                          <option key={c.id} value={c.name} />
                        ))}
                      </datalist>
                    </div>
                    <div className="form-group">
                      <label htmlFor="buyerGstin">GSTIN</label>
                      <input
                        type="text"
                        id="buyerGstin"
                        placeholder="22BBBBB0000B1Z5"
                        maxLength="15"
                        className="mono"
                        value={buyerGstin}
                        onChange={(e) => setBuyerGstin(e.target.value)}
                        disabled={previewOnly}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label htmlFor="buyerAddress">Address</label>
                    <textarea
                      id="buyerAddress"
                      rows="2"
                      placeholder="456 Market Road, City, State - 500001"
                      value={buyerAddress}
                      onChange={(e) => setBuyerAddress(e.target.value)}
                      disabled={previewOnly}
                    />
                  </div>
                  <div className="form-grid cols-3" style={{ marginTop: '1rem' }}>
                    <div className="form-group">
                      <label htmlFor="buyerState">State</label>
                      <select
                        id="buyerState"
                        value={buyerState}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBuyerState(val);
                          setPlaceOfSupply(val);
                          if (sellerConfig) {
                            setSupplyType(val === sellerConfig.state_code ? 'intra' : 'inter');
                          }
                        }}
                        disabled={previewOnly}
                      >
                        {INDIAN_STATES.map((state) => (
                          <option key={state.code} value={state.code}>
                            {state.code} - {state.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="buyerPhone">Phone</label>
                      <input
                        type="tel"
                        id="buyerPhone"
                        placeholder="+91 91234 56789"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        disabled={previewOnly}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="buyerEmail">Email</label>
                      <input
                        type="email"
                        id="buyerEmail"
                        placeholder="customer@email.com"
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        disabled={previewOnly}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* LINE ITEMS */}
              <section className="card card-glow" id="sectionItems">
                <div className="card-header">
                  <div className="card-icon gradient-orange">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  </div>
                  <h2>Items / Services</h2>
                  {!previewOnly && (
                    <button className="btn btn-sm btn-accent" onClick={handleAddItem}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add Item
                    </button>
                  )}
                </div>
                <div className="card-body">
                  <div className="items-table-wrapper">
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th className="col-sno">#</th>
                          <th className="col-desc">Description</th>
                          <th className="col-hsn">HSN/SAC</th>
                          <th className="col-qty">Qty</th>
                          <th className="col-unit">Unit</th>
                          <th className="col-rate">Rate (₹)</th>
                          <th className="col-discount">Disc %</th>
                          <th className="col-gst">GST %</th>
                          <th className="col-amount">Amount (₹)</th>
                          <th className="col-action"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => {
                          const isCustom = !item.productId;
                          const rowTotal = calcItemTotal(item);

                          return (
                            <tr key={item.id}>
                              <td className="item-sno">{idx + 1}</td>
                              <td>
                                <select
                                  className="item-desc-select"
                                  value={item.productId || (isCustom && item.description ? '__custom__' : '')}
                                  onChange={(e) => handleProductSelect(item.id, e.target.value)}
                                  style={{ marginBottom: isCustom && item.description ? '4px' : '0' }}
                                  disabled={previewOnly}
                                >
                                  <option value="">— Select Product —</option>
                                  {products.map((p) => {
                                    const lbl = p.description + (p.qty_per_unit && p.qty_per_unit > 1 ? ` (${p.qty_per_unit})` : '');
                                    return <option key={p.id} value={p.id}>{lbl}</option>;
                                  })}
                                  <option value="__custom__">✏️ Custom Item...</option>
                                </select>
                                {isCustom && (
                                  <input
                                    type="text"
                                    placeholder="Enter description"
                                    value={item.description}
                                    onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                                    style={{ fontSize: '0.78rem' }}
                                    disabled={previewOnly}
                                  />
                                )}
                              </td>
                              <td>
                                <input
                                  type="text"
                                  placeholder="HSN/SAC"
                                  className="mono"
                                  value={item.hsn}
                                  onChange={(e) => handleUpdateItem(item.id, 'hsn', e.target.value)}
                                  readOnly={!!item.productId}
                                  style={item.productId ? { opacity: 0.6 } : {}}
                                  disabled={previewOnly}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.qty}
                                  onChange={(e) => handleUpdateItem(item.id, 'qty', e.target.value)}
                                  disabled={previewOnly}
                                />
                              </td>
                              <td>
                                <select
                                  value={item.unit}
                                  onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                                  disabled={!!item.productId || previewOnly}
                                  style={item.productId ? { opacity: 0.6 } : {}}
                                >
                                  {UNITS.map((u) => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.rate}
                                  onChange={(e) => handleUpdateItem(item.id, 'rate', e.target.value)}
                                  readOnly={!!item.productId}
                                  style={item.productId ? { opacity: 0.6 } : {}}
                                  disabled={previewOnly}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.5"
                                  value={item.discount}
                                  onChange={(e) => handleUpdateItem(item.id, 'discount', e.target.value)}
                                  disabled={previewOnly}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={item.gstRate}
                                  onChange={(e) => handleUpdateItem(item.id, 'gstRate', e.target.value)}
                                  readOnly={!!item.productId}
                                  style={item.productId ? { opacity: 0.6 } : {}}
                                  disabled={previewOnly}
                                />
                              </td>
                              <td className="item-amount">₹{formatNumber(rowTotal)}</td>
                              <td>
                                {!previewOnly && (
                                  <button className="btn btn-danger btn-remove" onClick={() => handleRemoveItem(item.id)} title="Remove item">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                      <polyline points="3,6 5,6 21,6" />
                                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                    </svg>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT: SUMMARY */}
            <div className="summary-column">
              <div className="sticky-summary">
                <section className="card card-glow summary-card" id="sectionSummary">
                  <div className="card-header">
                    <div className="card-icon gradient-pink">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 3h12" />
                        <path d="M6 8h12" />
                        <path d="M6 13h8.5a4.5 4.5 0 0 0 0-9H6" />
                        <path d="M6 13h3l9 9" />
                      </svg>
                    </div>
                    <h2>Invoice Summary</h2>
                  </div>
                  <div className="card-body">
                    <div className="summary-rows">
                      <div className="summary-row">
                        <span className="summary-label">Subtotal</span>
                        <span className="summary-value">₹{formatNumber(calculations.subtotal)}</span>
                      </div>
                      <div className="summary-row">
                        <span className="summary-label">Discount</span>
                        <span className="summary-value discount">−₹{formatNumber(calculations.totalDiscount)}</span>
                      </div>
                      <div className="summary-row">
                        <span className="summary-label">Taxable Amount</span>
                        <span className="summary-value">₹{formatNumber(calculations.taxableTotal)}</span>
                      </div>
                      
                      <div className="summary-divider"></div>
                      
                      {supplyType === 'intra' ? (
                        <div id="taxBreakdownIntra">
                          <div className="summary-row tax-row">
                            <span className="summary-label">CGST</span>
                            <span className="summary-value">₹{formatNumber(calculations.totalCgst)}</span>
                          </div>
                          <div className="summary-row tax-row">
                            <span className="summary-label">SGST</span>
                            <span className="summary-value">₹{formatNumber(calculations.totalSgst)}</span>
                          </div>
                        </div>
                      ) : (
                        <div id="taxBreakdownInter">
                          <div className="summary-row tax-row">
                            <span className="summary-label">IGST</span>
                            <span className="summary-value">₹{formatNumber(calculations.totalIgst)}</span>
                          </div>
                        </div>
                      )}

                      <div className="summary-divider"></div>

                      <div className="summary-row total-row">
                        <span className="summary-label">Total Amount</span>
                        <span className="summary-value">₹{formatNumber(calculations.grandTotal)}</span>
                      </div>
                      <div className="summary-row total-words">
                        <span className="amount-words">{numberToWords(Math.round(calculations.grandTotal))}</span>
                      </div>
                    </div>

                    <div className="gst-breakdown" id="gstBreakdown">
                      <h3>GST Breakdown</h3>
                      <table className="gst-table">
                        <thead>
                          <tr>
                            <th>Rate</th>
                            <th>Taxable</th>
                            <th>CGST</th>
                            <th>SGST</th>
                            <th>Total Tax</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(calculations.gstBreakdown)
                            .sort((a, b) => parseFloat(a) - parseFloat(b))
                            .map((rate) => {
                              const row = calculations.gstBreakdown[rate];
                              if (row.taxable === 0) return null;
                              return (
                                <tr key={rate}>
                                  <td>{rate}%</td>
                                  <td>₹{formatNumber(row.taxable)}</td>
                                  <td>₹{formatNumber(row.cgst)}</td>
                                  <td>₹{formatNumber(row.sgst)}</td>
                                  <td>₹{formatNumber(row.totalTax)}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <div className="action-buttons">
                  {!previewOnly && (
                    <button className="btn btn-large btn-primary" onClick={() => handleSaveInvoice(false)}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                        <polyline points="17,21 17,13 7,13 7,21" />
                        <polyline points="7,3 7,8 15,8" />
                      </svg> 
                      Save Invoice
                    </button>
                  )}
                  <button className="btn btn-large btn-gradient" onClick={handleDownloadPdf}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7,10 12,15 17,10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg> 
                    Download PDF
                  </button>
                  <button className="btn btn-large btn-outline" onClick={handlePrint}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="6,9 6,2 18,2 18,9" />
                      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg> 
                    Print Invoice
                  </button>
                  {!previewOnly && (
                    <button className="btn btn-large btn-accent" onClick={handleShare}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg> 
                      Share Invoice
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== INVOICE PREVIEW MODAL ===== */}
      {previewOpen && (
        <div className="modal-overlay active" onClick={() => setPreviewOpen(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Invoice Preview</h2>
              <div className="modal-actions">
                <button className="btn btn-sm btn-primary" onClick={handleDownloadPdf}>PDF</button>
                <button className="btn btn-sm btn-ghost" onClick={handlePrint}>Print</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setPreviewOpen(false)}>Close</button>
              </div>
            </div>
            <div className="modal-body" id="invoicePreviewContainer">
              <div id="invoicePreview">
                <div className="inv-header">
                  <div>
                    <div className="inv-company-name">{sellerConfig?.name || 'Seller Business'}</div>
                    <div className="inv-company-detail">
                      {sellerConfig?.address && <>{sellerConfig.address}<br /></>}
                      {sellerConfig?.state_code && <>{getStateName(sellerConfig.state_code)}<br /></>}
                      {(sellerConfig?.phone || sellerConfig?.email) && (
                        <>{sellerConfig.phone && `📞 ${sellerConfig.phone}`} {sellerConfig.email && `✉️ ${sellerConfig.email}`}<br /></>
                      )}
                      <strong>GSTIN:</strong> {sellerConfig?.gstin || 'N/A'}
                    </div>
                  </div>
                  <div className="inv-title-block">
                    <div className="inv-title">Tax Invoice</div>
                    <div className="inv-meta">
                      <strong>Invoice #:</strong> {invoiceNumber}<br />
                      <strong>Date:</strong> {formatDateDisplay(invoiceDate)}<br />
                      {dueDate && <><strong>Due Date:</strong> {formatDateDisplay(dueDate)}<br /></>}
                      <strong>Place of Supply:</strong> {getStateName(placeOfSupply)}
                    </div>
                  </div>
                </div>

                <div className="inv-parties">
                  <div>
                    <div className="inv-party-label">Bill To</div>
                    <div className="inv-party-name">{buyerName || 'N/A'}</div>
                    <div className="inv-party-info">
                      {buyerAddress && <>{buyerAddress}<br /></>}
                      {buyerState && <>{getStateName(buyerState)}<br /></>}
                      {buyerPhone && <>📞 {buyerPhone}<br /></>}
                      {buyerGstin && <><strong>GSTIN:</strong> {buyerGstin}</>}
                    </div>
                  </div>
                  <div>
                    <div className="inv-party-label">Ship To</div>
                    <div className="inv-party-name">{buyerName || 'N/A'}</div>
                    <div className="inv-party-info">
                      {buyerAddress ? buyerAddress : 'Same as billing'}
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
                      const gross = item.qty * item.rate;
                      const discAmt = gross * (item.discount / 100);
                      const rowTotal = gross - discAmt;

                      return (
                        <tr key={item.id}>
                          <td className="text-center">{idx + 1}</td>
                          <td>
                            {item.description}
                            {item.qtyPerUnit && item.qtyPerUnit > 1 && (
                              <>
                                <br />
                                <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                  (Qty/Unit: {item.qtyPerUnit})
                                </small>
                              </>
                            )}
                          </td>
                          <td className="text-center">{item.hsn || '—'}</td>
                          <td className="text-center">{item.qty}</td>
                          <td className="text-center">{item.unit}</td>
                          <td className="text-right">₹{formatNumber(item.rate)}</td>
                          <td className="text-center">{item.discount}%</td>
                          <td className="text-center">{item.gstRate}%</td>
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
                      <span className="val">₹{formatNumber(calculations.subtotal)}</span>
                    </div>
                    {calculations.totalDiscount > 0 && (
                      <div className="inv-totals-row discount">
                        <span>Discount</span>
                        <span className="val">−₹{formatNumber(calculations.totalDiscount)}</span>
                      </div>
                    )}
                    <div className="inv-totals-row">
                      <span>Taxable Amount</span>
                      <span className="val">₹{formatNumber(calculations.taxableTotal)}</span>
                    </div>
                    <hr className="inv-totals-divider" />
                    {supplyType === 'intra' ? (
                      <>
                        <div className="inv-totals-row">
                          <span>CGST</span>
                          <span className="val">₹{formatNumber(calculations.totalCgst)}</span>
                        </div>
                        <div className="inv-totals-row">
                          <span>SGST</span>
                          <span className="val">₹{formatNumber(calculations.totalSgst)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="inv-totals-row">
                        <span>IGST</span>
                        <span className="val">₹{formatNumber(calculations.totalIgst)}</span>
                      </div>
                    )}
                    <div className="inv-totals-row total">
                      <span>Grand Total</span>
                      <span className="val">₹{formatNumber(calculations.grandTotal)}</span>
                    </div>
                  </div>
                </div>

                <div className="inv-amount-words">
                  <strong>Amount in Words:</strong> {numberToWords(Math.round(calculations.grandTotal))}
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
                    {Object.keys(calculations.gstBreakdown)
                      .sort((a, b) => parseFloat(a) - parseFloat(b))
                      .map((rate) => {
                        const r = calculations.gstBreakdown[rate];
                        if (r.taxable === 0) return null;
                        return supplyType === 'intra' ? (
                          <tr key={rate}>
                            <td>{rate}%</td>
                            <td>₹{formatNumber(r.taxable)}</td>
                            <td>₹{formatNumber(r.cgst)}</td>
                            <td>₹{formatNumber(r.sgst)}</td>
                            <td>₹{formatNumber(r.totalTax)}</td>
                          </tr>
                        ) : (
                          <tr key={rate}>
                            <td>{rate}%</td>
                            <td>₹{formatNumber(r.taxable)}</td>
                            <td>₹{formatNumber(r.igst)}</td>
                            <td>₹{formatNumber(r.totalTax)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>

                {notes && (
                  <div className="inv-bank-section">
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div className="inv-terms-title">Terms & Conditions</div>
                      <div className="inv-terms-text">{notes}</div>
                    </div>
                  </div>
                )}

                <div className="inv-signature">
                  <div className="inv-sig-line"></div>
                  <div className="inv-sig-label">Authorized Signatory</div>
                </div>
                <div className="inv-footer">This is a computer-generated invoice. Generated by InvoiceGST.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SHARE MODAL ===== */}
      {shareOpen && (
        <div className="modal-overlay active" onClick={() => setShareOpen(false)}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Share Invoice</h2>
              <div className="modal-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => setShareOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="modal-body share-modal-body">
              <p className="share-modal-desc">Share this invoice with your customer. Anyone with this link can view the invoice online without logging in.</p>
              <div className="share-url-container">
                <input type="text" value={shareUrl} readOnly className="mono" />
                <button className="btn btn-primary" onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  toast.success('Link copied!');
                }}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="share-divider"><span>OR SHARE VIA</span></div>
              <div className="share-options-grid">
                <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Hi, please find your GST Tax Invoice here: ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer" className="share-option-btn whatsapp">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                  <span>WhatsApp</span>
                </a>
                <a href={`mailto:?subject=GST%20Tax%20Invoice%20-%20${encodeURIComponent(invoiceNumber)}&body=${encodeURIComponent(`Hi, please find your GST Tax Invoice here: ${shareUrl}`)}`} className="share-option-btn email">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span>Email</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div className="page-body"><p className="page-empty-state">Loading invoice editor...</p></div>}>
      <InvoiceForm />
    </Suspense>
  );
}
