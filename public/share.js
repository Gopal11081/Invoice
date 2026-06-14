document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    showError('No sharing token was provided in the link. Please check the URL.');
    return;
  }

  try {
    const res = await fetch(`/api/public/invoices/${token}`);
    if (!res.ok) {
      if (res.status === 404) {
        showError('This invoice link is invalid, expired, or has been revoked.');
      } else {
        showError('An error occurred while loading this invoice. Please try again later.');
      }
      return;
    }

    const invoice = await res.json();
    renderInvoice(invoice);
  } catch (err) {
    console.error('Error loading invoice:', err);
    showError('Unable to connect to the server. Please check your internet connection.');
  }
});

function renderInvoice(inv) {
  const loading = document.getElementById('loadingContainer');
  const cardWrapper = document.getElementById('invoiceCardWrapper');
  const preview = document.getElementById('invoicePreview');

  const formatNum = (num) => num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const numberToWords = (num) => {
    if (num === 0) return 'Zero Rupees Only';
    if (num < 0) return 'Negative ' + numberToWords(-num);
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    function convert(n) {
      if (n === 0) return '';
      if (n < 20) return ones[n] + ' ';
      if (n < 100) return tens[Math.floor(n / 10)] + ' ' + convert(n % 10);
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + convert(n % 100);
      if (n < 100000) return convert(Math.floor(n / 1000)) + 'Thousand ' + convert(n % 1000);
      if (n < 10000000) return convert(Math.floor(n / 100000)) + 'Lakh ' + convert(n % 100000);
      return convert(Math.floor(n / 10000000)) + 'Crore ' + convert(n % 10000000);
    }
    const intPart = Math.floor(num);
    const paise = Math.round((num - intPart) * 100);
    let result = convert(intPart).trim() + ' Rupees';
    if (paise > 0) result += ' and ' + convert(paise).trim() + ' Paise';
    return result + ' Only';
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    let d;
    if (dateStr.includes('T')) {
      d = new Date(dateStr);
    } else {
      d = new Date(dateStr + 'T00:00:00');
    }
    if (isNaN(d.getTime())) {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStateName = (code) => {
    const states = [
      { code: '01', name: 'Jammu & Kashmir' },{ code: '02', name: 'Himachal Pradesh' },{ code: '03', name: 'Punjab' },
      { code: '04', name: 'Chandigarh' },{ code: '05', name: 'Uttarakhand' },{ code: '06', name: 'Haryana' },
      { code: '07', name: 'Delhi' },{ code: '08', name: 'Rajasthan' },{ code: '09', name: 'Uttar Pradesh' },
      { code: '10', name: 'Bihar' },{ code: '11', name: 'Sikkim' },{ code: '12', name: 'Arunachal Pradesh' },
      { code: '13', name: 'Nagaland' },{ code: '14', name: 'Manipur' },{ code: '15', name: 'Mizoram' },
      { code: '16', name: 'Tripura' },{ code: '17', name: 'Meghalaya' },{ code: '18', name: 'Assam' },
      { code: '19', name: 'West Bengal' },{ code: '20', name: 'Jharkhand' },{ code: '21', name: 'Odisha' },
      { code: '22', name: 'Chhattisgarh' },{ code: '23', name: 'Madhya Pradesh' },{ code: '24', name: 'Gujarat' },
      { code: '25', name: 'Daman & Diu' },{ code: '26', name: 'Dadra & Nagar Haveli' },{ code: '27', name: 'Maharashtra' },
      { code: '28', name: 'Andhra Pradesh (Old)' },{ code: '29', name: 'Karnataka' },{ code: '30', name: 'Goa' },
      { code: '31', name: 'Lakshadweep' },{ code: '32', name: 'Kerala' },{ code: '33', name: 'Tamil Nadu' },
      { code: '34', name: 'Puducherry' },{ code: '35', name: 'Andaman & Nicobar Islands' },
      { code: '36', name: 'Telangana' },{ code: '37', name: 'Andhra Pradesh' },{ code: '38', name: 'Ladakh' }
    ];
    const s = states.find(st => st.code === code);
    return s ? s.name : '';
  };

  const escapeHtml = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  const invNum = inv.invoice_number || 'BE-0001';
  const invDate = formatDateDisplay(inv.invoice_date);
  const dueDate = formatDateDisplay(inv.due_date);
  
  const seller = inv.business || {};
  const buyer = {
    name: inv.buyer_name || 'N/A', gstin: inv.buyer_gstin, address: inv.buyer_address,
    state: getStateName(inv.buyer_state), phone: inv.buyer_phone, email: inv.buyer_email
  };

  const supplyType = 'intra';

  let subtotal = 0, totalDiscount = 0, taxableTotal = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
  const gstMap = {};

  const itemRows = (inv.items || []).map((item, i) => {
    const gross = item.qty * item.rate; 
    const discAmt = gross * (item.discount_percent / 100); 
    const taxable = gross - discAmt;
    subtotal += gross; 
    totalDiscount += discAmt; 
    taxableTotal += taxable;
    const rate = item.gst_rate;
    if (!gstMap[rate]) gstMap[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    gstMap[rate].taxable += taxable;
    if (supplyType === 'intra') {
      const c = taxable * (rate / 2 / 100); 
      const s = c;
      gstMap[rate].cgst += c; 
      gstMap[rate].sgst += s; 
      gstMap[rate].total += c + s;
      totalCgst += c; 
      totalSgst += s;
    } else {
      const ig = taxable * (rate / 100);
      gstMap[rate].igst += ig; 
      gstMap[rate].total += ig; 
      totalIgst += ig;
    }
    const descText = escapeHtml(item.description) + (item.qty_per_unit && item.qty_per_unit > 1 ? `<br><small style="color:#64748b; font-size:0.75rem;">(Qty/Unit: ${item.qty_per_unit})</small>` : '');
    return `<tr><td class="text-center">${i + 1}</td><td>${descText || '—'}</td><td class="text-center">${item.hsn_sac || '—'}</td><td class="text-center">${item.qty}</td><td class="text-center">${item.unit}</td><td class="text-right">₹${formatNum(item.rate)}</td><td class="text-center">${item.discount_percent}%</td><td class="text-center">${item.gst_rate}%</td><td class="text-right">₹${formatNum(taxable)}</td></tr>`;
  }).join('');

  const totalTax = supplyType === 'intra' ? totalCgst + totalSgst : totalIgst;
  const grandTotal = taxableTotal + totalTax;

  const gstTableHeaders = supplyType === 'intra'
    ? '<th>Rate</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>Total Tax</th>'
    : '<th>Rate</th><th>Taxable</th><th>IGST</th><th>Total Tax</th>';

  const gstRows = Object.keys(gstMap).sort((a, b) => parseFloat(a) - parseFloat(b)).map(rate => {
    const r = gstMap[rate]; 
    if (r.taxable === 0) return '';
    return supplyType === 'intra'
      ? `<tr><td>${rate}%</td><td>₹${formatNum(r.taxable)}</td><td>₹${formatNum(r.cgst)}</td><td>₹${formatNum(r.sgst)}</td><td>₹${formatNum(r.total)}</td></tr>`
      : `<tr><td>${rate}%</td><td>₹${formatNum(r.taxable)}</td><td>₹${formatNum(r.igst)}</td><td>₹${formatNum(r.total)}</td></tr>`;
  }).join('');

  const taxRows = supplyType === 'intra'
    ? `<div class="inv-totals-row"><span>CGST</span><span class="val">₹${formatNum(totalCgst)}</span></div><div class="inv-totals-row"><span>SGST</span><span class="val">₹${formatNum(totalSgst)}</span></div>`
    : `<div class="inv-totals-row"><span>IGST</span><span class="val">₹${formatNum(totalIgst)}</span></div>`;

  const terms = (seller.terms || '').replace(/\\n/g, '\n');

  preview.innerHTML = `
    <div class="inv-header">
      <div><div class="inv-company-name">${escapeHtml(seller.name || 'Seller Business')}</div><div class="inv-company-detail">${seller.address ? escapeHtml(seller.address) + '<br>' : ''}${seller.state_code ? escapeHtml(getStateName(seller.state_code)) + '<br>' : ''}${seller.phone ? '📞 ' + escapeHtml(seller.phone) : ''} ${seller.email ? '✉️ ' + escapeHtml(seller.email) : ''}<br><strong>GSTIN:</strong> ${escapeHtml(seller.gstin || 'N/A')}</div></div>
      <div class="inv-title-block"><div class="inv-title">Tax Invoice</div><div class="inv-meta"><strong>Invoice #:</strong> ${escapeHtml(invNum)}<br><strong>Date:</strong> ${invDate}<br><strong>Due Date:</strong> ${dueDate}<br><strong>Place of Supply:</strong> ${escapeHtml(getStateName(inv.place_of_supply))}</div></div>
    </div>
    <div class="inv-parties"><div><div class="inv-party-label">Bill To</div><div class="inv-party-name">${escapeHtml(buyer.name)}</div><div class="inv-party-info">${buyer.address ? escapeHtml(buyer.address) + '<br>' : ''}${buyer.state ? escapeHtml(buyer.state) + '<br>' : ''}${buyer.phone ? '📞 ' + escapeHtml(buyer.phone) + '<br>' : ''}${buyer.gstin ? '<strong>GSTIN:</strong> ' + escapeHtml(buyer.gstin) : ''}</div></div><div><div class="inv-party-label">Ship To</div><div class="inv-party-name">${escapeHtml(buyer.name)}</div><div class="inv-party-info">${buyer.address ? escapeHtml(buyer.address) : 'Same as billing'}</div></div></div>
    <table class="inv-items-table"><thead><tr><th class="text-center">#</th><th>Description</th><th class="text-center">HSN/SAC</th><th class="text-center">Qty</th><th class="text-center">Unit</th><th class="text-right">Rate</th><th class="text-center">Disc%</th><th class="text-center">GST%</th><th class="text-right">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
    <div class="inv-totals"><div class="inv-totals-table"><div class="inv-totals-row"><span>Subtotal</span><span class="val">₹${formatNum(subtotal)}</span></div>${totalDiscount > 0 ? `<div class="inv-totals-row discount"><span>Discount</span><span class="val">−₹${formatNum(totalDiscount)}</span></div>` : ''}<div class="inv-totals-row"><span>Taxable Amount</span><span class="val">₹${formatNum(taxableTotal)}</span></div><hr class="inv-totals-divider">${taxRows}<div class="inv-totals-row total"><span>Grand Total</span><span class="val">₹${formatNum(grandTotal)}</span></div></div></div>
    <div class="inv-amount-words"><strong>Amount in Words:</strong> ${numberToWords(Math.round(grandTotal))}</div>
    <table class="inv-gst-table"><thead><tr>${gstTableHeaders}</tr></thead><tbody>${gstRows}</tbody></table>
    ${terms ? `<div class="inv-bank-section"><div style="grid-column: 1/-1;"><div class="inv-terms-title">Terms & Conditions</div><div class="inv-terms-text">${escapeHtml(terms)}</div></div></div>` : ''}
    <div class="inv-signature"><div class="inv-sig-line"></div><div class="inv-sig-label">Authorized Signatory</div></div>
    <div class="inv-footer">This is a computer-generated invoice. Generated by InvoiceGST.</div>
  `;

  loading.style.display = 'none';
  cardWrapper.style.display = 'block';

  document.getElementById('btnPrint').onclick = () => window.print();
  document.getElementById('btnDownloadPdf').onclick = () => {
    const opt = {
      margin: [0.3, 0.3, 0.3, 0.3], filename: `${invNum}.pdf`,
      image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    };
    html2pdf().set(opt).from(preview).save();
  };
}

function showError(msg) {
  document.getElementById('loadingContainer').style.display = 'none';
  document.getElementById('errorCard').style.display = 'flex';
  document.getElementById('errorMessage').textContent = msg;
}
