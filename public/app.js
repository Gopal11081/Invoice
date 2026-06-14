/* ============================================
   GST INVOICE GENERATOR — Application Logic
   Sidebar Layout + Hash-Based Routing
   ============================================ */

// ===== INDIAN STATES LIST =====
const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' }, { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' }, { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' }, { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' }, { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' }, { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' }, { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' }, { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' }, { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' }, { code: '26', name: 'Dadra & Nagar Haveli' }, { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)' }, { code: '29', name: 'Karnataka' }, { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' }, { code: '32', name: 'Kerala' }, { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' }, { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' }, { code: '37', name: 'Andhra Pradesh' }, { code: '38', name: 'Ladakh' },
];

const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];
const UNITS = ['Nos', 'Pcs', 'Kg', 'Gm', 'Ltr', 'Mtr', 'Sq.ft', 'Hrs', 'Box', 'Case', 'Set', 'Pair', 'Bag', 'Roll'];

//===== STATE MANAGEMENT =====
let items = [];
let supplyType = 'intra';
let nextItemId = 1;
let products = [];
let customers = [];
let businessConfig = {};
let currentPage = 'dashboard';
let currentUser = null;

// ===== DOM REFERENCES =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== API HELPERS =====
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth first
  try {
    const auth = await api('/api/auth/check');
    if (!auth.authenticated || !auth.user) {
      window.location.href = '/login';
      return;
    }
    currentUser = auth.user;
    updateSidebarAndAccessControls();
  } catch (e) {
    window.location.href = '/login';
    return;
  }

  populateStateDropdowns();
  bindEvents();
  initRouter();

  try {
    await Promise.all([loadBusinessConfig(), loadProducts(), loadCustomers(), loadNextInvoiceNumber()]);
  } catch (e) {
    console.error('Failed to load initial data:', e);
    showToast('Failed to connect to server. Make sure the server is running.', 'error');
  }

  setDefaultDates();
  addItem();
  recalculate();
});

// ===== AUTH =====
function updateSidebarAndAccessControls() {
  if (!currentUser) return;
  const name = currentUser.display_name || currentUser.username;
  $('#sidebarUserName').textContent = name;
  $('#sidebarUserAvatar').textContent = (name.charAt(0) || 'U').toUpperCase();

  const roleDisplay = currentUser.role === 'admin' ? 'Administrator' : 'Staff';
  const roleEl = $('#sidebarUserRole');
  if (roleEl) roleEl.textContent = roleDisplay;

  const isAdmin = currentUser.role === 'admin';

  const usersLink = $('#sidebarLinkUsers');
  if (usersLink) usersLink.style.display = isAdmin ? 'flex' : 'none';

  const settingsLink = $('#sidebarLinkSettings');
  if (settingsLink) settingsLink.style.display = isAdmin ? 'flex' : 'none';

  const editSettingsBtn = $('#btnEditSettings');
  if (editSettingsBtn) editSettingsBtn.style.display = isAdmin ? 'inline-flex' : 'none';
}

async function loadCurrentUser() {
  try {
    const data = await api('/api/auth/check');
    if (data.authenticated && data.user) {
      currentUser = data.user;
      updateSidebarAndAccessControls();
    }
  } catch (e) { /* redirect handled by api() */ }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) { }
  window.location.href = '/login';
}

// ===== ROUTER =====
function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash || '#/dashboard';
  const page = hash.replace('#/', '') || 'dashboard';
  navigateTo(page);
}

function navigateTo(page) {
  const validPages = ['dashboard', 'invoice', 'history', 'products', 'customers', 'settings', 'users'];
  if (!validPages.includes(page)) page = 'dashboard';

  // Guard users and settings page (admin only)
  if ((page === 'users' || page === 'settings') && (!currentUser || currentUser.role !== 'admin')) {
    page = 'dashboard';
    window.location.hash = '#/dashboard';
  }

  currentPage = page;

  // Update pages
  $$('.page').forEach(p => p.classList.remove('active'));
  const pageEl = $(`#page${page.charAt(0).toUpperCase() + page.slice(1)}`);
  if (pageEl) pageEl.classList.add('active');

  // Update sidebar links
  $$('.sidebar-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  // Close mobile sidebar
  closeMobileSidebar();

  // Load page-specific data
  if (page === 'dashboard') loadDashboard();
  if (page === 'history') loadHistory();
  if (page === 'products') { hideProductForm(); renderProductsList(); }
  if (page === 'customers') { hideCustomerForm(); renderCustomersList(); }
  if (page === 'settings') populateSettingsForm();
  if (page === 'users') loadUsers();
}

// ===== MOBILE SIDEBAR =====
function openMobileSidebar() {
  $('#sidebar').classList.add('open');
  $('#sidebarOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
  $('#sidebar').classList.remove('open');
  $('#sidebarOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ===== LOAD DATA FROM SERVER =====
async function loadBusinessConfig() {
  businessConfig = await api('/api/business');
  applyBusinessConfig();
}

function applyBusinessConfig() {
  const c = businessConfig;
  $('#sellerName').value = c.name || '';
  $('#sellerGstin').value = c.gstin || '';
  $('#sellerAddress').value = c.address || '';
  $('#sellerState').value = c.state_code || '';
  $('#sellerPhone').value = c.phone || '';
  $('#sellerEmail').value = c.email || '';
  $('#notes').value = c.terms || '';
  $('#dispSellerName').textContent = c.name || 'Your Business Name';
  $('#dispSellerGstin').textContent = c.gstin || '—';
  const addressParts = [c.address, getStateName(c.state_code)].filter(Boolean);
  $('#dispSellerAddress').textContent = addressParts.join(', ');
  const contactParts = [];
  if (c.phone) contactParts.push(`📞 ${c.phone}`);
  if (c.email) contactParts.push(`✉️ ${c.email}`);
  $('#dispSellerContact').textContent = contactParts.join('  ·  ');
}

async function loadProducts() {
  products = await api('/api/products');
  renderProductsList();
}

async function loadNextInvoiceNumber() {
  const data = await api('/api/invoices/next-number');
  $('#invoiceNumber').value = data.invoice_number;
}

// ===== STATE DROPDOWNS =====
function populateStateDropdowns() {
  ['#settBizState', '#custState'].forEach(sel => {
    const dropdown = $(sel);
    if (!dropdown) return;
    dropdown.innerHTML = dropdown.tagName === 'SELECT' && dropdown.options[0]?.value === '' ? '<option value="">Select State</option>' : '';
    INDIAN_STATES.forEach(state => {
      const opt = document.createElement('option');
      opt.value = state.code;
      opt.textContent = `${state.code} - ${state.name}`;
      dropdown.appendChild(opt);
    });
  });
}

function getStateName(code) {
  const s = INDIAN_STATES.find(st => st.code === code);
  return s ? s.name : '';
}

// ===== DEFAULT DATES =====
function setDefaultDates() {
  const today = new Date();
  const due = new Date(today); due.setDate(due.getDate() + 30);
  $('#invoiceDate').value = formatDateISO(today);
  $('#dueDate').value = formatDateISO(due);
}
function formatDateISO(date) { return date.toISOString().split('T')[0]; }
function formatDateDisplay(dateStr) {
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
}

// ===== EVENT BINDINGS =====
function bindEvents() {
  $('#buyerState').addEventListener('change', autoDetectSupplyType);

  // Items
  $('#btnAddItem').addEventListener('click', addItem);

  // Invoice page actions
  $('#btnNewInvoice').addEventListener('click', resetInvoice);
  $('#btnPreview').addEventListener('click', openPreview);

  // Save & Share Invoice
  $('#btnSaveInvoice').addEventListener('click', handleSaveButtonClick);
  $('#btnShareInvoice').addEventListener('click', () => handleShareAction());
  $('#btnModalShare').addEventListener('click', () => { closePreview(); handleShareAction(); });
  $('#btnCloseShareModal').addEventListener('click', closeShareModal);
  $('#shareModal').addEventListener('click', (e) => { if (e.target.id === 'shareModal') closeShareModal(); });
  $('#btnCopyShareUrl').addEventListener('click', copyShareUrlToClipboard);

  // PDF & Print
  $('#btnGeneratePdf').addEventListener('click', generatePdf);
  $('#btnPrint').addEventListener('click', printInvoice);
  $('#btnModalPdf').addEventListener('click', generatePdf);
  $('#btnModalPrint').addEventListener('click', printInvoice);

  // Preview modal
  $('#btnCloseModal').addEventListener('click', closePreview);
  $('#previewModal').addEventListener('click', (e) => { if (e.target.id === 'previewModal') closePreview(); });

  // Settings
  $('#btnSaveSettings').addEventListener('click', saveSettings);

  // Products
  $('#btnAddProduct').addEventListener('click', showProductForm);
  $('#btnSaveProduct').addEventListener('click', saveProduct);
  $('#btnCancelProduct').addEventListener('click', hideProductForm);

  // Customers page actions
  $('#btnAddCustomer').addEventListener('click', () => showCustomerForm());
  $('#btnSaveCustomer').addEventListener('click', saveCustomer);
  $('#btnCancelCustomer').addEventListener('click', hideCustomerForm);

  // Auto-populate customer details on matching name
  $('#buyerName').addEventListener('input', (e) => {
    const val = e.target.value.trim();
    const match = customers.find(c => c.name.toLowerCase() === val.toLowerCase());
    if (match) {
      $('#buyerGstin').value = match.gstin || '';
      $('#buyerAddress').value = match.address || '';
      $('#buyerState').value = '29'; // Force Karnataka
      $('#buyerPhone').value = match.phone || '';
      $('#buyerEmail').value = match.email || '';
      autoDetectSupplyType();
    }
  });

  // Mobile
  $('#btnMobileMenu').addEventListener('click', openMobileSidebar);
  $('#sidebarOverlay').addEventListener('click', closeMobileSidebar);

  // Logout
  $('#btnLogout').addEventListener('click', logout);

  // Populate product form selects
  populateProductFormSelects();

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePreview();
  });
}

function populateProductFormSelects() {
  const unitSel = $('#prodUnit');
  UNITS.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u; opt.textContent = u;
    unitSel.appendChild(opt);
  });
}

// ===== SUPPLY TYPE =====
function setSupplyType(type) {
  supplyType = 'intra';
  const toggleIntra = $('#toggleIntra');
  if (toggleIntra) toggleIntra.classList.add('active');
  const toggleInter = $('#toggleInter');
  if (toggleInter) toggleInter.classList.remove('active');
  const intraBreakdown = $('#taxBreakdownIntra');
  if (intraBreakdown) intraBreakdown.style.display = 'block';
  const interBreakdown = $('#taxBreakdownInter');
  if (interBreakdown) interBreakdown.style.display = 'none';

  const h1 = $('#gstColHeader1');
  if (h1) h1.textContent = 'CGST';
  const h2 = $('#gstColHeader2');
  if (h2) {
    h2.textContent = 'SGST';
    h2.style.display = '';
  }
  recalculate();
}

function autoDetectSupplyType() {
  // Always lock place of supply to '29' (Karnataka)
  $('#placeOfSupply').value = '29';
  setSupplyType('intra');
}

// ===== LINE ITEMS =====
function addItem() {
  items.push({ id: nextItemId++, productId: '', description: '', hsn: '', qty: 1, unit: 'Nos', rate: 0, discount: 0, gstRate: 18, qtyPerUnit: 1 });
  renderItems();
  recalculate();
}

function removeItem(id) {
  if (items.length <= 1) { showToast('At least one item is required', 'error'); return; }
  items = items.filter(i => i.id !== id);
  renderItems();
  recalculate();
}

function updateItem(id, field, value) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  if (['qty', 'rate', 'discount', 'gstRate'].includes(field)) {
    item[field] = parseFloat(value) || 0;
  } else {
    item[field] = value;
  }
  recalculate();
}

function onProductSelect(itemId, productId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  if (productId === '__custom__') {
    item.productId = ''; item.description = ''; item.hsn = ''; item.unit = 'Nos'; item.rate = 0; item.gstRate = 18; item.qtyPerUnit = 1;
  } else {
    const product = products.find(p => p.id === parseInt(productId));
    if (product) {
      item.productId = product.id; item.description = product.description; item.hsn = product.hsn_sac;
      item.unit = product.unit; item.rate = product.rate; item.gstRate = product.gst_rate;
      item.qtyPerUnit = product.qty_per_unit || 1;
    }
  }
  renderItems();
  recalculate();
}

function renderItems() {
  const tbody = $('#itemsBody');
  tbody.innerHTML = '';
  items.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.dataset.id = item.id;
    const taxableAmt = calcItemTaxable(item);
    const isCustom = !item.productId;
    let productOptions = `<option value="">— Select Product —</option>`;
    products.forEach(p => {
      const displayLabel = escapeHtml(p.description) + (p.qty_per_unit && p.qty_per_unit > 1 ? ` (${p.qty_per_unit})` : '');
      productOptions += `<option value="${p.id}" ${item.productId === p.id ? 'selected' : ''}>${displayLabel}</option>`;
    });
    productOptions += `<option value="__custom__" ${isCustom && item.description ? 'selected' : ''}>✏️ Custom Item...</option>`;
    let descCell;
    if (isCustom && item.description) {
      descCell = `<select class="item-desc-select" data-field="productSelect" style="margin-bottom:4px;">${productOptions}</select><input type="text" value="${escapeHtml(item.description)}" placeholder="Enter description" data-field="description" style="font-size:0.78rem;" />`;
    } else {
      descCell = `<select class="item-desc-select" data-field="productSelect">${productOptions}</select>`;
    }
    tr.innerHTML = `
      <td class="item-sno">${index + 1}</td>
      <td>${descCell}</td>
      <td><input type="text" value="${escapeHtml(item.hsn)}" placeholder="HSN/SAC" class="mono" data-field="hsn" ${item.productId ? 'readonly style="opacity:0.6"' : ''} /></td>
      <td><input type="number" value="${item.qty}" min="0" step="1" data-field="qty" /></td>
      <td><select data-field="unit" ${item.productId ? 'disabled style="opacity:0.6"' : ''}>${UNITS.map(u => `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
      <td><input type="number" value="${item.rate}" min="0" step="0.01" data-field="rate" ${item.productId ? 'readonly style="opacity:0.6"' : ''} /></td>
      <td><input type="number" value="${item.discount}" min="0" max="100" step="0.5" data-field="discount" /></td>
      <td><input type="number" value="${item.gstRate}" min="0" max="100" step="0.01" data-field="gstRate" ${item.productId ? 'readonly style="opacity:0.6"' : ''} /></td>
      <td class="item-amount">₹${formatNumber(taxableAmt)}</td>
      <td><button class="btn btn-danger btn-remove" title="Remove item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></td>
    `;
    const prodSelect = tr.querySelector('[data-field="productSelect"]');
    prodSelect.addEventListener('change', (e) => onProductSelect(item.id, e.target.value));
    tr.querySelectorAll('input[data-field], select[data-field]').forEach(el => {
      if (el.dataset.field === 'productSelect') return;
      el.addEventListener('input', (e) => {
        updateItem(item.id, e.target.dataset.field, e.target.value);
        const amt = calcItemTaxable(items.find(i => i.id === item.id));
        tr.querySelector('.item-amount').textContent = `₹${formatNumber(amt)}`;
      });
    });
    tr.querySelector('.btn-remove').addEventListener('click', () => removeItem(item.id));
    tbody.appendChild(tr);
  });
}

// ===== CALCULATIONS =====
function calcItemTaxable(item) {
  const gross = item.qty * item.rate;
  return gross - gross * (item.discount / 100);
}

function recalculate() {
  let subtotal = 0, totalDiscount = 0, taxableTotal = 0;
  let totalCgst = 0, totalSgst = 0, totalIgst = 0;
  const gstBreakdown = {};
  items.forEach(item => {
    const gross = item.qty * item.rate;
    const discountAmt = gross * (item.discount / 100);
    const taxable = gross - discountAmt;
    subtotal += gross; totalDiscount += discountAmt; taxableTotal += taxable;
    const rate = item.gstRate;
    if (!gstBreakdown[rate]) gstBreakdown[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
    gstBreakdown[rate].taxable += taxable;
    if (supplyType === 'intra') {
      const half = rate / 2;
      const cgst = taxable * (half / 100), sgst = taxable * (half / 100);
      gstBreakdown[rate].cgst += cgst; gstBreakdown[rate].sgst += sgst; gstBreakdown[rate].totalTax += cgst + sgst;
      totalCgst += cgst; totalSgst += sgst;
    } else {
      const igst = taxable * (rate / 100);
      gstBreakdown[rate].igst += igst; gstBreakdown[rate].totalTax += igst; totalIgst += igst;
    }
  });
  const totalTax = supplyType === 'intra' ? totalCgst + totalSgst : totalIgst;
  const grandTotal = taxableTotal + totalTax;
  $('#summarySubtotal').textContent = `₹${formatNumber(subtotal)}`;
  $('#summaryDiscount').textContent = `−₹${formatNumber(totalDiscount)}`;
  $('#summaryTaxable').textContent = `₹${formatNumber(taxableTotal)}`;
  $('#summaryCgst').textContent = `₹${formatNumber(totalCgst)}`;
  $('#summarySgst').textContent = `₹${formatNumber(totalSgst)}`;
  $('#summaryIgst').textContent = `₹${formatNumber(totalIgst)}`;
  $('#summaryTotal').textContent = `₹${formatNumber(grandTotal)}`;
  $('#summaryWords').textContent = numberToWords(Math.round(grandTotal));
  renderGstBreakdown(gstBreakdown);
}

function renderGstBreakdown(breakdown) {
  const tbody = $('#gstBreakdownBody');
  tbody.innerHTML = '';
  Object.keys(breakdown).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(rate => {
    const row = breakdown[rate];
    if (row.taxable === 0) return;
    const tr = document.createElement('tr');
    if (supplyType === 'intra') {
      tr.innerHTML = `<td>${rate}%</td><td>₹${formatNumber(row.taxable)}</td><td>₹${formatNumber(row.cgst)}</td><td>₹${formatNumber(row.sgst)}</td><td>₹${formatNumber(row.totalTax)}</td>`;
    } else {
      tr.innerHTML = `<td>${rate}%</td><td>₹${formatNumber(row.taxable)}</td><td>₹${formatNumber(row.igst)}</td><td style="display:none;"></td><td>₹${formatNumber(row.totalTax)}</td>`;
    }
    tbody.appendChild(tr);
  });
}

// ===== NUMBER FORMATTING =====
function formatNumber(num) {
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberToWords(num) {
  if (num === 0) return 'Zero Rupees Only';
  if (num < 0) return 'Negative ' + numberToWords(-num);
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
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
}

// ===== SETTINGS PAGE =====
function populateSettingsForm() {
  const c = businessConfig;
  $('#settBizName').value = c.name || '';
  $('#settBizGstin').value = c.gstin || '';
  $('#settBizAddress').value = c.address || '';
  $('#settBizState').value = c.state_code || '';
  $('#settBizPhone').value = c.phone || '';
  $('#settBizEmail').value = c.email || '';
  $('#settTerms').value = c.terms || '';
}

async function saveSettings() {
  const data = {
    name: ($('#settBizName').value || '').trim(),
    gstin: ($('#settBizGstin').value || '').trim().toUpperCase(),
    address: ($('#settBizAddress').value || '').trim(),
    state_code: $('#settBizState').value,
    phone: ($('#settBizPhone').value || '').trim(),
    email: ($('#settBizEmail').value || '').trim(),
    terms: ($('#settTerms').value || '').trim(),
  };

  if (!data.name) { showToast('Business Name is required', 'error'); return; }
  if (!data.gstin) { showToast('GSTIN is required', 'error'); return; }

  const regexGstin = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
  if (!regexGstin.test(data.gstin)) {
    showToast('Invalid Business GSTIN format (e.g. 22AAAAA0000A1Z5)', 'error');
    return;
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    showToast('Invalid business email format', 'error');
    return;
  }

  if (data.phone && !/^\d{10}$/.test(data.phone)) {
    showToast('Business phone number must be a valid 10-digit number.', 'error');
    return;
  }

  if (!data.state_code) {
    showToast('Please select state code', 'error');
    return;
  }

  try {
    businessConfig = await api('/api/business', { method: 'PUT', body: data });
    applyBusinessConfig();
    showToast('Business settings saved!', 'success');
  } catch (e) {
    showToast('Failed to save settings: ' + e.message, 'error');
  }
}

// ===== PRODUCTS PAGE =====
let editingProductId = null;

function showProductForm(product) {
  editingProductId = null;
  $('#productFormTitle').textContent = 'Add New Product';
  $('#prodDescription').value = ''; $('#prodHsn').value = ''; $('#prodUnit').value = 'Nos'; $('#prodRate').value = ''; $('#prodGst').value = '18'; $('#prodQtyPerUnit').value = '1';
  if (product && typeof product === 'object' && product.id) {
    editingProductId = product.id;
    $('#productFormTitle').textContent = 'Edit Product';
    $('#prodDescription').value = product.description || ''; $('#prodHsn').value = product.hsn_sac || '';
    $('#prodUnit').value = product.unit || 'Nos'; $('#prodRate').value = product.rate || ''; $('#prodGst').value = product.gst_rate ?? 18;
    $('#prodQtyPerUnit').value = product.qty_per_unit || 1;
  }
  $('#productForm').style.display = 'block';
  $('#prodDescription').focus();
}

function hideProductForm() {
  $('#productForm').style.display = 'none';
  editingProductId = null;
}

async function saveProduct() {
  const data = {
    description: $('#prodDescription').value.trim(),
    hsn_sac: $('#prodHsn').value.trim(),
    unit: $('#prodUnit').value,
    rate: parseFloat($('#prodRate').value),
    gst_rate: parseFloat($('#prodGst').value) || 18,
    qty_per_unit: parseInt($('#prodQtyPerUnit').value, 10) || 1,
  };

  if (!data.description) { showToast('Product description is required', 'error'); return; }

  if (data.hsn_sac && !/^\d{2,8}$/.test(data.hsn_sac)) {
    showToast('HSN/SAC code must be numeric and between 2 to 8 digits.', 'error');
    return;
  }

  if (isNaN(data.rate) || data.rate < 0) {
    showToast('Product rate must be a non-negative number.', 'error');
    return;
  }

  try {
    if (editingProductId) {
      await api(`/api/products/${editingProductId}`, { method: 'PUT', body: data });
      showToast('Product updated!', 'success');
    } else {
      await api('/api/products', { method: 'POST', body: data });
      showToast('Product added!', 'success');
    }
    await loadProducts();
    hideProductForm();
    renderItems();
  } catch (e) {
    showToast('Failed to save product: ' + e.message, 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('Remove this product from catalog?')) return;
  try {
    await api(`/api/products/${id}`, { method: 'DELETE' });
    await loadProducts(); renderItems();
    showToast('Product removed', 'success');
  } catch (e) {
    showToast('Failed to delete: ' + e.message, 'error');
  }
}

function renderProductsList() {
  const container = $('#productsList');
  if (products.length === 0) {
    container.innerHTML = '<p class="page-empty-state">No products yet. Add your first product!</p>';
    return;
  }
  container.innerHTML = products.map(p => {
    const displayLabel = escapeHtml(p.description) + (p.qty_per_unit && p.qty_per_unit > 1 ? ` (${p.qty_per_unit})` : '');
    return `
      <div class="product-item" data-id="${p.id}">
        <div class="product-item-info">
          <div class="product-item-name">${displayLabel}</div>
          <div class="product-item-meta"><span>HSN: ${p.hsn_sac || '—'}</span><span>Unit: ${p.unit}</span><span>GST: ${p.gst_rate}%</span></div>
        </div>
      <div class="product-item-price">₹${formatNumber(p.rate)}</div>
      <div class="product-item-actions">
        <button class="btn btn-ghost btn-edit-prod" data-id="${p.id}" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn btn-danger btn-del-prod" data-id="${p.id}" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
      </div>
    </div>
    `;
  }).join('');
  container.querySelectorAll('.btn-edit-prod').forEach(btn => {
    btn.addEventListener('click', () => { const prod = products.find(p => p.id === parseInt(btn.dataset.id)); if (prod) showProductForm(prod); });
  });
  container.querySelectorAll('.btn-del-prod').forEach(btn => {
    btn.addEventListener('click', () => deleteProduct(parseInt(btn.dataset.id)));
  });
}

// ===== CUSTOMERS PAGE =====
async function loadCustomers() {
  try {
    customers = await api('/api/customers');
    populateCustomerDatalist();
    renderCustomersList();
  } catch (e) {
    console.error('Failed to load customers:', e);
  }
}

function populateCustomerDatalist() {
  const datalist = $('#customerList');
  if (!datalist) return;
  datalist.innerHTML = '';
  customers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    datalist.appendChild(opt);
  });
}

let editingCustomerId = null;

function showCustomerForm(customer) {
  editingCustomerId = null;
  $('#customerFormTitle').textContent = 'Add New Customer';
  $('#custName').value = ''; $('#custGstin').value = ''; $('#custState').value = ''; $('#custAddress').value = ''; $('#custPhone').value = ''; $('#custEmail').value = '';
  if (customer && typeof customer === 'object' && customer.id) {
    editingCustomerId = customer.id;
    $('#customerFormTitle').textContent = 'Edit Customer';
    $('#custName').value = customer.name || '';
    $('#custGstin').value = customer.gstin || '';
    $('#custState').value = customer.state_code || '';
    $('#custAddress').value = customer.address || '';
    $('#custPhone').value = customer.phone || '';
    $('#custEmail').value = customer.email || '';
  }
  $('#customerForm').style.display = 'block';
  $('#custName').focus();
}

function hideCustomerForm() {
  $('#customerForm').style.display = 'none';
  editingCustomerId = null;
}

async function saveCustomer() {
  const data = {
    name: $('#custName').value.trim(),
    gstin: $('#custGstin').value.trim().toUpperCase(),
    state_code: $('#custState').value,
    address: $('#custAddress').value.trim(),
    phone: $('#custPhone').value.trim(),
    email: $('#custEmail').value.trim(),
  };

  if (!data.name) { showToast('Customer name is required', 'error'); return; }

  if (data.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(data.gstin)) {
    showToast('Invalid Customer GSTIN format (e.g. 22AAAAA0000A1Z5)', 'error');
    return;
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    showToast('Invalid customer email address format', 'error');
    return;
  }

  if (data.phone && !/^\d{10}$/.test(data.phone)) {
    showToast('Customer phone number must be a valid 10-digit number.', 'error');
    return;
  }

  if (!data.state_code) {
    showToast('Please select the customer state code.', 'error');
    return;
  }

  try {
    if (editingCustomerId) {
      await api(`/api/customers/${editingCustomerId}`, { method: 'PUT', body: data });
      showToast('Customer updated!', 'success');
    } else {
      await api('/api/customers', { method: 'POST', body: data });
      showToast('Customer added!', 'success');
    }
    await loadCustomers();
    hideCustomerForm();
  } catch (e) {
    showToast('Failed to save customer: ' + e.message, 'error');
  }
}

async function deleteCustomer(id) {
  if (!confirm('Remove this customer from directory?')) return;
  try {
    await api(`/api/customers/${id}`, { method: 'DELETE' });
    await loadCustomers();
    showToast('Customer removed', 'success');
  } catch (e) {
    showToast('Failed to delete customer: ' + e.message, 'error');
  }
}

function renderCustomersList() {
  const container = $('#customersList');
  if (!container) return;
  if (customers.length === 0) {
    container.innerHTML = '<p class="page-empty-state">No customers yet. Add your first customer!</p>';
    return;
  }
  container.innerHTML = customers.map(c => `
    <div class="product-item" data-id="${c.id}">
      <div class="product-item-info">
        <div class="product-item-name">${escapeHtml(c.name)}</div>
        <div class="product-item-meta">
          <span>GSTIN: ${c.gstin || '—'}</span>
          <span>State: ${getStateName(c.state_code) || '—'}</span>
          <span>Phone: ${c.phone || '—'}</span>
          <span>Created: ${c.created_at ? formatDateDisplay(c.created_at) : '—'}</span>
        </div>
      </div>
      <div class="product-item-actions">
        <button class="btn btn-ghost btn-edit-cust" data-id="${c.id}" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn btn-danger btn-del-cust" data-id="${c.id}" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-edit-cust').forEach(btn => {
    btn.addEventListener('click', () => { const cust = customers.find(c => c.id === parseInt(btn.dataset.id)); if (cust) showCustomerForm(cust); });
  });
  container.querySelectorAll('.btn-del-cust').forEach(btn => {
    btn.addEventListener('click', () => deleteCustomer(parseInt(btn.dataset.id)));
  });
}

// ===== HISTORY PAGE =====
async function loadHistory() {
  $('#historyList').innerHTML = '<p class="page-empty-state">Loading invoices...</p>';
  try {
    const invoices = await api('/api/invoices');
    renderHistoryList(invoices);
  } catch (e) {
    $('#historyList').innerHTML = '<p class="page-empty-state">Failed to load invoices.</p>';
  }
}

function renderHistoryList(invoices) {
  const container = $('#historyList');
  if (invoices.length === 0) {
    container.innerHTML = '<p class="page-empty-state">No invoices generated yet.<br>Create your first invoice!</p>';
    return;
  }
  container.innerHTML = invoices.map(inv => `
    <div class="history-item" data-id="${inv.id}">
      <div class="history-item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg></div>
      <div class="history-item-info">
        <div class="history-item-number">${escapeHtml(inv.invoice_number)}</div>
        <div class="history-item-detail">${escapeHtml(inv.buyer_name || 'No customer')} · ${formatDateDisplay(inv.invoice_date)}</div>
      </div>
      <div class="history-item-amount">₹${formatNumber(inv.grand_total || 0)}</div>
      <div class="history-item-actions">
        <button class="btn-share-invoice-hist" data-id="${inv.id}" title="Share"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>
        <button class="btn btn-danger btn-del-invoice" data-id="${inv.id}" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
      </div>
    </div>
  `).join('');
  container.querySelectorAll('.history-item').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.btn-del-invoice') || e.target.closest('.btn-share-invoice-hist')) return;
      loadInvoiceFromHistory(parseInt(row.dataset.id));
    });
  });
  container.querySelectorAll('.btn-share-invoice-hist').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleShareAction(parseInt(btn.dataset.id));
    });
  });
  container.querySelectorAll('.btn-del-invoice').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this invoice?')) return;
      try {
        await api(`/api/invoices/${btn.dataset.id}`, { method: 'DELETE' });
        showToast('Invoice deleted', 'success');
        loadHistory();
      } catch (err) { showToast('Failed to delete invoice', 'error'); }
    });
  });
}

async function loadInvoiceFromHistory(id) {
  try {
    const inv = await api(`/api/invoices/${id}`);
    $('#invoiceNumber').value = inv.invoice_number || '';
    $('#invoiceDate').value = inv.invoice_date || '';
    $('#dueDate').value = inv.due_date || '';
    $('#placeOfSupply').value = '29'; // Force Karnataka
    supplyType = inv.supply_type || 'intra';
    setSupplyType(supplyType);
    $('#buyerName').value = inv.buyer_name || '';
    $('#buyerGstin').value = inv.buyer_gstin || '';
    $('#buyerAddress').value = inv.buyer_address || '';
    $('#buyerState').value = '29'; // Force Karnataka
    $('#buyerPhone').value = inv.buyer_phone || '';
    $('#buyerEmail').value = inv.buyer_email || '';
    if (inv.notes) $('#notes').value = inv.notes;
    items = (inv.items || []).map((it, i) => ({
      id: i + 1, productId: '', description: it.description || '', hsn: it.hsn_sac || '',
      qty: it.qty || 1, unit: it.unit || 'Nos', rate: it.rate || 0,
      discount: it.discount_percent || 0, gstRate: it.gst_rate || 18,
      qtyPerUnit: it.qty_per_unit || 1,
    }));
    nextItemId = items.length + 1;
    renderItems();
    recalculate();
    window.location.hash = '#/invoice';
    showToast(`Loaded ${inv.invoice_number}`, 'success');
  } catch (e) {
    showToast('Failed to load invoice', 'error');
  }
}

// ===== RESET INVOICE =====
function resetInvoice() {
  items = [];
  nextItemId = 1;
  supplyType = 'intra';
  setSupplyType('intra');
  $('#buyerName').value = ''; $('#buyerGstin').value = ''; $('#buyerAddress').value = '';
  $('#buyerState').value = '29'; // Force Karnataka
  $('#buyerPhone').value = ''; $('#buyerEmail').value = '';
  $('#placeOfSupply').value = '29'; // Force Karnataka
  setDefaultDates();
  loadNextInvoiceNumber();
  addItem();
  recalculate();
  showToast('Invoice form reset', 'success');
}


// ===== INVOICE PREVIEW =====
function openPreview() {
  const previewHtml = generateInvoiceHtml();
  $('#invoicePreview').innerHTML = previewHtml;
  $('#previewModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePreview() {
  $('#previewModal').classList.remove('active');
  document.body.style.overflow = '';
}

function generateInvoiceHtml() {
  const invNum = $('#invoiceNumber').value || 'BE-0001';
  const invDate = formatDateDisplay($('#invoiceDate').value);
  const dueDate = formatDateDisplay($('#dueDate').value);
  const seller = {
    name: $('#sellerName').value, gstin: $('#sellerGstin').value, address: $('#sellerAddress').value,
    state: getStateName($('#sellerState').value), phone: $('#sellerPhone').value, email: $('#sellerEmail').value,
  };
  const buyer = {
    name: $('#buyerName').value || 'N/A', gstin: $('#buyerGstin').value, address: $('#buyerAddress').value,
    state: getStateName($('#buyerState').value), phone: $('#buyerPhone').value, email: $('#buyerEmail').value,
  };
  let subtotal = 0, totalDiscount = 0, taxableTotal = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
  const gstMap = {};
  const itemRows = items.map((item, i) => {
    const gross = item.qty * item.rate; const discAmt = gross * (item.discount / 100); const taxable = gross - discAmt;
    subtotal += gross; totalDiscount += discAmt; taxableTotal += taxable;
    const rate = item.gstRate;
    if (!gstMap[rate]) gstMap[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    gstMap[rate].taxable += taxable;
    if (supplyType === 'intra') {
      const c = taxable * (rate / 2 / 100); const s = c;
      gstMap[rate].cgst += c; gstMap[rate].sgst += s; gstMap[rate].total += c + s;
      totalCgst += c; totalSgst += s;
    } else {
      const ig = taxable * (rate / 100);
      gstMap[rate].igst += ig; gstMap[rate].total += ig; totalIgst += ig;
    }
    const descText = escapeHtml(item.description) + (item.qtyPerUnit && item.qtyPerUnit > 1 ? `<br><small style="color:#64748b; font-size:0.75rem;">(Qty/Unit: ${item.qtyPerUnit})</small>` : '');
    return `<tr><td class="text-center">${i + 1}</td><td>${descText || '—'}</td><td class="text-center">${item.hsn || '—'}</td><td class="text-center">${item.qty}</td><td class="text-center">${item.unit}</td><td class="text-right">₹${formatNumber(item.rate)}</td><td class="text-center">${item.discount}%</td><td class="text-center">${item.gstRate}%</td><td class="text-right">₹${formatNumber(taxable)}</td></tr>`;
  }).join('');
  const totalTax = supplyType === 'intra' ? totalCgst + totalSgst : totalIgst;
  const grandTotal = taxableTotal + totalTax;
  const gstTableHeaders = supplyType === 'intra'
    ? '<th>Rate</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>Total Tax</th>'
    : '<th>Rate</th><th>Taxable</th><th>IGST</th><th>Total Tax</th>';
  const gstRows = Object.keys(gstMap).sort((a, b) => parseFloat(a) - parseFloat(b)).map(rate => {
    const r = gstMap[rate]; if (r.taxable === 0) return '';
    return supplyType === 'intra'
      ? `<tr><td>${rate}%</td><td>₹${formatNumber(r.taxable)}</td><td>₹${formatNumber(r.cgst)}</td><td>₹${formatNumber(r.sgst)}</td><td>₹${formatNumber(r.total)}</td></tr>`
      : `<tr><td>${rate}%</td><td>₹${formatNumber(r.taxable)}</td><td>₹${formatNumber(r.igst)}</td><td>₹${formatNumber(r.total)}</td></tr>`;
  }).join('');
  const taxRows = supplyType === 'intra'
    ? `<div class="inv-totals-row"><span>CGST</span><span class="val">₹${formatNumber(totalCgst)}</span></div><div class="inv-totals-row"><span>SGST</span><span class="val">₹${formatNumber(totalSgst)}</span></div>`
    : `<div class="inv-totals-row"><span>IGST</span><span class="val">₹${formatNumber(totalIgst)}</span></div>`;
  const terms = ($('#notes').value || '').replace(/\\n/g, '\n');

  return `
    <div class="inv-header">
      <div><div class="inv-company-name">${escapeHtml(seller.name)}</div><div class="inv-company-detail">${seller.address ? escapeHtml(seller.address) + '<br>' : ''}${seller.state ? escapeHtml(seller.state) + '<br>' : ''}${seller.phone ? '📞 ' + escapeHtml(seller.phone) : ''} ${seller.email ? '✉️ ' + escapeHtml(seller.email) : ''}<br><strong>GSTIN:</strong> ${escapeHtml(seller.gstin)}</div></div>
      <div class="inv-title-block"><div class="inv-title">Tax Invoice</div><div class="inv-meta"><strong>Invoice #:</strong> ${escapeHtml(invNum)}<br><strong>Date:</strong> ${invDate}<br><strong>Due Date:</strong> ${dueDate}<br><strong>Place of Supply:</strong> ${escapeHtml(getStateName($('#placeOfSupply').value))}</div></div>
    </div>
    <div class="inv-parties"><div><div class="inv-party-label">Bill To</div><div class="inv-party-name">${escapeHtml(buyer.name)}</div><div class="inv-party-info">${buyer.address ? escapeHtml(buyer.address) + '<br>' : ''}${buyer.state ? escapeHtml(buyer.state) + '<br>' : ''}${buyer.phone ? '📞 ' + escapeHtml(buyer.phone) + '<br>' : ''}${buyer.gstin ? '<strong>GSTIN:</strong> ' + escapeHtml(buyer.gstin) : ''}</div></div><div><div class="inv-party-label">Ship To</div><div class="inv-party-name">${escapeHtml(buyer.name)}</div><div class="inv-party-info">${buyer.address ? escapeHtml(buyer.address) : 'Same as billing'}</div></div></div>
    <table class="inv-items-table"><thead><tr><th class="text-center">#</th><th>Description</th><th class="text-center">HSN/SAC</th><th class="text-center">Qty</th><th class="text-center">Unit</th><th class="text-right">Rate</th><th class="text-center">Disc%</th><th class="text-center">GST%</th><th class="text-right">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
    <div class="inv-totals"><div class="inv-totals-table"><div class="inv-totals-row"><span>Subtotal</span><span class="val">₹${formatNumber(subtotal)}</span></div>${totalDiscount > 0 ? `<div class="inv-totals-row discount"><span>Discount</span><span class="val">−₹${formatNumber(totalDiscount)}</span></div>` : ''}<div class="inv-totals-row"><span>Taxable Amount</span><span class="val">₹${formatNumber(taxableTotal)}</span></div><hr class="inv-totals-divider">${taxRows}<div class="inv-totals-row total"><span>Grand Total</span><span class="val">₹${formatNumber(grandTotal)}</span></div></div></div>
    <div class="inv-amount-words"><strong>Amount in Words:</strong> ${numberToWords(Math.round(grandTotal))}</div>
    <table class="inv-gst-table"><thead><tr>${gstTableHeaders}</tr></thead><tbody>${gstRows}</tbody></table>
    ${terms ? `<div class="inv-bank-section"><div style="grid-column: 1/-1;"><div class="inv-terms-title">Terms & Conditions</div><div class="inv-terms-text">${escapeHtml(terms)}</div></div></div>` : ''}
    <div class="inv-signature"><div class="inv-sig-line"></div><div class="inv-sig-label">Authorized Signatory</div></div>
    <div class="inv-footer">This is a computer-generated invoice. Generated by InvoiceGST.</div>
  `;
}

// ===== PDF & PRINT =====
async function generatePdf() {
  openPreview();
  await saveInvoiceToDb();
  const el = $('#invoicePreview');
  const opt = {
    margin: [0.3, 0.3, 0.3, 0.3], filename: `${$('#invoiceNumber').value || 'Invoice'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
  };
  html2pdf().set(opt).from(el).save().then(() => { showToast('PDF downloaded!', 'success'); });
}

async function printInvoice() {
  openPreview();
  await saveInvoiceToDb();
  setTimeout(() => window.print(), 500);
}

async function saveInvoiceToDb() {
  const buyerName = ($('#buyerName').value || '').trim();
  const invoiceDate = $('#invoiceDate').value;
  const dueDate = $('#dueDate').value;
  const placeOfSupply = $('#placeOfSupply').value;
  const buyerGstin = ($('#buyerGstin').value || '').trim().toUpperCase();
  const buyerPhone = ($('#buyerPhone').value || '').trim();
  const buyerEmail = ($('#buyerEmail').value || '').trim();
  const buyerState = $('#buyerState').value;

  if (!buyerName) {
    showToast('Customer Name is required to save invoice', 'error');
    throw new Error('Customer Name is required');
  }

  if (!invoiceDate) {
    showToast('Invoice Date is required', 'error');
    throw new Error('Invoice Date is required');
  }

  if (!dueDate) {
    showToast('Due Date is required', 'error');
    throw new Error('Due Date is required');
  }

  if (!placeOfSupply) {
    showToast('Place of Supply is required', 'error');
    throw new Error('Place of Supply is required');
  }

  if (!buyerState) {
    showToast('Buyer State is required', 'error');
    throw new Error('Buyer State is required');
  }

  if (buyerGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(buyerGstin)) {
    showToast('Invalid Buyer GSTIN format (e.g. 22AAAAA0000A1Z5)', 'error');
    throw new Error('Invalid Buyer GSTIN');
  }

  if (buyerPhone && !/^\d{10}$/.test(buyerPhone)) {
    showToast('Buyer phone number must be a valid 10-digit number.', 'error');
    throw new Error('Invalid Buyer Phone');
  }

  if (buyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    showToast('Invalid buyer email address format', 'error');
    throw new Error('Invalid Buyer Email');
  }

  if (items.length === 0) {
    showToast('Please add at least one item to the invoice', 'error');
    throw new Error('No items in invoice');
  }

  // Validate items
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.description || !item.description.trim()) {
      showToast(`Item #${i + 1} must have a description`, 'error');
      throw new Error(`Item #${i + 1} description missing`);
    }
    if (item.qty <= 0) {
      showToast(`Item #${i + 1} quantity must be greater than zero`, 'error');
      throw new Error(`Item #${i + 1} quantity invalid`);
    }
    if (item.rate < 0) {
      showToast(`Item #${i + 1} rate cannot be negative`, 'error');
      throw new Error(`Item #${i + 1} rate invalid`);
    }
  }

  let subtotal = 0, totalDiscount = 0, taxableTotal = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
  const dbItems = items.map((item, i) => {
    const gross = item.qty * item.rate; const disc = gross * (item.discount / 100); const taxable = gross - disc;
    subtotal += gross; totalDiscount += disc; taxableTotal += taxable;
    if (supplyType === 'intra') {
      const c = taxable * (item.gstRate / 2 / 100); totalCgst += c; totalSgst += c;
    } else {
      totalIgst += taxable * (item.gstRate / 100);
    }
    return { description: item.description, hsn_sac: item.hsn, qty: item.qty, unit: item.unit, rate: item.rate, discount_percent: item.discount, gst_rate: item.gstRate, taxable_amount: taxable, qty_per_unit: item.qtyPerUnit || 1 };
  });
  const totalTax = supplyType === 'intra' ? totalCgst + totalSgst : totalIgst;
  const grandTotal = taxableTotal + totalTax;
  const data = {
    invoice_number: $('#invoiceNumber').value, invoice_date: $('#invoiceDate').value, due_date: $('#dueDate').value,
    place_of_supply: $('#placeOfSupply').value, supply_type: supplyType,
    buyer_name: buyerName, buyer_gstin: $('#buyerGstin').value, buyer_address: $('#buyerAddress').value,
    buyer_state: $('#buyerState').value, buyer_phone: $('#buyerPhone').value, buyer_email: $('#buyerEmail').value,
    subtotal, total_discount: totalDiscount, taxable_amount: taxableTotal,
    cgst: totalCgst, sgst: totalSgst, igst: totalIgst, grand_total: grandTotal,
    amount_in_words: numberToWords(Math.round(grandTotal)),
    notes: $('#notes').value, items: dbItems,
  };
  try {
    const res = await api('/api/invoices', { method: 'POST', body: data });
    return res;
  } catch (e) {
    console.error('Failed to save invoice:', e);
    showToast('Failed to save invoice: ' + e.message, 'error');
    throw e;
  }
}

async function handleSaveButtonClick() {
  try {
    const result = await saveInvoiceToDb();
    if (result && result.id) {
      showToast(result.updated ? 'Invoice updated successfully!' : 'Invoice saved successfully!', 'success');
      await loadCustomers();
      loadNextInvoiceNumber();
      window.location.hash = '#/history';
    }
  } catch (e) {
    // validation error or api failure - handled in saveInvoiceToDb
  }
}

async function handleShareAction(invoiceId = null) {
  let finalInvoiceId = invoiceId;

  if (!finalInvoiceId) {
    try {
      const result = await saveInvoiceToDb();
      if (result && result.id) {
        finalInvoiceId = result.id;
        showToast('Invoice auto-saved before sharing', 'success');
        await loadCustomers();
      } else {
        return;
      }
    } catch (e) {
      return;
    }
  }

  try {
    const shareRes = await api(`/api/invoices/${finalInvoiceId}/share`, { method: 'POST' });
    if (shareRes && shareRes.share_token) {
      const shareUrl = `${window.location.origin}/share.html?token=${shareRes.share_token}`;
      $('#shareUrlInput').value = shareUrl;

      const textMsg = encodeURIComponent(`Hi, please find your GST Tax Invoice here: ${shareUrl}`);
      $('#shareWhatsappBtn').href = `https://api.whatsapp.com/send?text=${textMsg}`;
      $('#shareEmailBtn').href = `mailto:?subject=GST%20Tax%20Invoice%20-%20${encodeURIComponent($('#invoiceNumber').value)}&body=${textMsg}`;

      openShareModal();
    }
  } catch (err) {
    showToast('Failed to generate share link: ' + err.message, 'error');
  }
}

function openShareModal() {
  $('#shareModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeShareModal() {
  $('#shareModal').classList.remove('active');
  document.body.style.overflow = '';
}

function copyShareUrlToClipboard() {
  const input = $('#shareUrlInput');
  input.select();
  input.setSelectionRange(0, 99999);

  try {
    navigator.clipboard.writeText(input.value);
    showToast('Link copied to clipboard!', 'success');
  } catch (err) {
    try {
      document.execCommand('copy');
      showToast('Link copied to clipboard!', 'success');
    } catch (e) {
      showToast('Failed to copy link', 'error');
    }
  }
}

// ===== DASHBOARD =====
let monthlySalesChartInstance = null;

async function loadDashboard() {
  try {
    const data = await api('/api/dashboard');
    renderDashboard(data);
  } catch (e) {
    console.error('Dashboard error:', e);
    showToast('Failed to load dashboard data', 'error');
  }
}

function formatCompact(num) {
  if (num >= 10000000) return '₹' + (num / 10000000).toFixed(2) + ' Cr';
  if (num >= 100000) return '₹' + (num / 100000).toFixed(2) + ' L';
  if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K';
  return '₹' + formatNumber(num);
}

function renderDashboard(data) {
  const t = data.totals;
  $('#kpiTotalSalesVal').textContent = formatCompact(t.total_sales);
  $('#kpiInvoiceCountVal').textContent = t.total_invoices;
  $('#kpiAvgInvoiceVal').textContent = formatCompact(t.avg_invoice);
  $('#kpiTotalTaxVal').textContent = formatCompact(t.total_tax);
  $('#dashThisMonthSales').textContent = formatCompact(data.currentMonth.sales);
  $('#dashThisMonthCount').textContent = data.currentMonth.invoices;
  const comp = $('#dashMonthComparison');
  if (data.prevMonth.sales > 0) {
    const pctChange = ((data.currentMonth.sales - data.prevMonth.sales) / data.prevMonth.sales * 100).toFixed(1);
    comp.innerHTML = parseFloat(pctChange) >= 0
      ? `<span class="positive">▲ ${pctChange}%</span> vs last month`
      : `<span class="negative">▼ ${Math.abs(pctChange)}%</span> vs last month`;
  } else if (data.currentMonth.sales > 0) {
    comp.innerHTML = '<span class="positive">🎉 First month with sales!</span>';
  } else {
    comp.innerHTML = 'No sales data to compare';
  }
  $('#dashTotalCgst').textContent = '₹' + formatNumber(t.total_cgst);
  $('#dashTotalSgst').textContent = '₹' + formatNumber(t.total_sgst);
  $('#dashTotalIgst').textContent = '₹' + formatNumber(t.total_igst);
  renderMonthlySalesChart(data.monthlySales);
  renderTopProducts(data.topProducts);
  renderTopCustomers(data.topCustomers);
  renderRecentInvoicesTable(data.recentInvoices);
}

function renderMonthlySalesChart(monthlySales) {
  const ctx = $('#monthlySalesChart');
  if (!ctx) return;
  const labels = monthlySales.map(m => {
    const [year, month] = m.month.split('-');
    return new Date(year, parseInt(month) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  });
  const salesData = monthlySales.map(m => m.sales);
  const countData = monthlySales.map(m => m.count);
  if (monthlySalesChartInstance) monthlySalesChartInstance.destroy();
  monthlySalesChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Sales (₹)', data: salesData,
          backgroundColor: (context) => {
            const chart = context.chart; const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(99,102,241,0.6)';
            const g = c.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            g.addColorStop(0, 'rgba(56,189,248,0.25)'); g.addColorStop(1, 'rgba(99,102,241,0.7)');
            return g;
          },
          borderColor: 'rgba(99,102,241,0.9)', borderWidth: 1, borderRadius: 6, borderSkipped: false, yAxisID: 'y',
        },
        {
          label: 'Invoices', data: countData, type: 'line',
          borderColor: 'rgba(45,212,191,0.8)', backgroundColor: 'rgba(45,212,191,0.15)',
          pointBackgroundColor: 'rgba(45,212,191,1)', pointBorderColor: '#111827',
          pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
          fill: false, tension: 0.3, yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 12 } },
        tooltip: {
          backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8',
          borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1, padding: 10, cornerRadius: 8,
          titleFont: { family: 'Inter', weight: '600', size: 12 }, bodyFont: { family: 'JetBrains Mono', size: 11 },
          callbacks: {
            label: (c) => c.dataset.yAxisID === 'y' ? '  Sales: ₹' + c.parsed.y.toLocaleString('en-IN') : '  Invoices: ' + c.parsed.y,
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 10, weight: '500' } } },
        y: {
          position: 'left', grid: { color: 'rgba(148,163,184,0.06)' },
          ticks: {
            color: '#64748b', font: { family: 'JetBrains Mono', size: 10 },
            callback: (v) => v >= 100000 ? '₹' + (v / 100000).toFixed(0) + 'L' : v >= 1000 ? '₹' + (v / 1000).toFixed(0) + 'K' : '₹' + v
          }
        },
        y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: 'rgba(45,212,191,0.7)', font: { family: 'JetBrains Mono', size: 10 }, stepSize: 1 }, beginAtZero: true }
      }
    }
  });
}

function renderTopProducts(prods) {
  const c = $('#dashTopProducts');
  if (!prods.length) { c.innerHTML = '<p class="dash-empty-state">No product data yet</p>'; return; }
  const mx = Math.max(...prods.map(p => p.total_revenue));
  c.innerHTML = `<table class="dash-table"><thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead><tbody>${prods.map(p => `<tr><td><div class="dash-revenue-bar-wrap"><div class="dash-revenue-bar" style="width:${(p.total_revenue / mx * 80).toFixed(0)}px"></div>${escapeHtml(p.description)}</div></td><td>${p.total_qty}</td><td>₹${formatNumber(p.total_revenue)}</td></tr>`).join('')}</tbody></table>`;
}

function renderTopCustomers(custs) {
  const c = $('#dashTopCustomers');
  if (!custs.length) { c.innerHTML = '<p class="dash-empty-state">No customer data yet</p>'; return; }
  c.innerHTML = `<table class="dash-table"><thead><tr><th>Customer</th><th>Invoices</th><th>Total Spent</th></tr></thead><tbody>${custs.map(cu => `<tr><td>${escapeHtml(cu.buyer_name)}</td><td>${cu.invoice_count}</td><td>₹${formatNumber(cu.total_spent)}</td></tr>`).join('')}</tbody></table>`;
}

function renderRecentInvoicesTable(invs) {
  const c = $('#dashRecentInvoices');
  if (!invs.length) { c.innerHTML = '<p class="dash-empty-state">No invoices yet. Create your first invoice!</p>'; return; }
  c.innerHTML = `<table class="dash-table"><thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Amount</th></tr></thead><tbody>${invs.map(inv => `<tr><td style="font-family:var(--font-mono);">${escapeHtml(inv.invoice_number)}</td><td>${escapeHtml(inv.buyer_name || '—')}</td><td>${formatDateDisplay(inv.invoice_date)}</td><td>₹${formatNumber(inv.grand_total || 0)}</td></tr>`).join('')}</tbody></table>`;
}

// ===== ADMIN USERS PAGE =====
async function loadUsers() {
  const container = $('#usersList');
  if (!container) return;
  container.innerHTML = '<p class="page-empty-state">Loading user accounts...</p>';
  try {
    const usersList = await api('/api/admin/users');
    renderUsersList(usersList);
  } catch (e) {
    container.innerHTML = `<p class="page-empty-state error">Failed to load users: ${escapeHtml(e.message)}</p>`;
  }
}

function renderUsersList(usersList) {
  const container = $('#usersList');
  if (!container) return;
  const filteredList = usersList.filter(u => u.username !== 'admin');
  if (filteredList.length === 0) {
    container.innerHTML = '<p class="page-empty-state">No users registered.</p>';
    return;
  }
  container.innerHTML = filteredList.map(u => {
    const isSelfAdmin = u.username === 'admin';
    const activeText = u.is_active ? 'Active' : 'Deactivated';
    const statusClass = u.is_active ? 'badge-active' : 'badge-deactivated';

    let roleActionHtml = '';
    if (isSelfAdmin) {
      roleActionHtml = `<span class="badge badge-seller" style="font-weight: 600;">System Admin</span>`;
    } else {
      roleActionHtml = `
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <select class="role-select" data-id="${u.id}" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid rgba(255,255,255,0.1); padding: 0.25rem 0.5rem; border-radius: 6px; outline: none; cursor: pointer; font-size: 13px;">
            <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Staff</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
          <button class="btn btn-sm ${u.is_active ? 'btn-outline' : 'btn-primary'} btn-toggle-status" data-id="${u.id}" data-active="${u.is_active}">
            ${u.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      `;
    }

    const contacts = [];
    if (u.email) contacts.push(`Email: ${escapeHtml(u.email)}`);
    if (u.mobile) contacts.push(`Mobile: ${escapeHtml(u.mobile)}`);
    const contactText = contacts.length > 0 ? `<span>${contacts.join(' · ')}</span>` : '';
    const displayRoleLabel = u.role === 'admin' ? 'Admin' : 'Staff';
    const roleBadgeClass = u.role === 'admin' ? 'badge-seller' : 'badge-buyer';

    return `
      <div class="product-item" data-id="${u.id}">
        <div class="product-item-info">
          <div class="product-item-name" style="display: flex; align-items: center; gap: 0.75rem;">
            ${escapeHtml(u.display_name)} 
            <span class="badge ${roleBadgeClass}">${displayRoleLabel}</span>
            <span class="badge ${statusClass}">${activeText}</span>
          </div>
          <div class="product-item-meta" style="margin-top: 0.25rem; display: flex; flex-wrap: wrap; gap: 0.75rem;">
            <span>Username: ${escapeHtml(u.username)}</span>
            <span>Registered: ${formatDateDisplay(u.created_at)}</span>
            ${contactText}
          </div>
        </div>
        <div class="product-item-actions">
          ${roleActionHtml}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-toggle-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = parseInt(btn.dataset.id);
      const currentStatus = btn.dataset.active === 'true';
      await toggleUserStatus(userId, currentStatus);
    });
  });

  container.querySelectorAll('.role-select').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const userId = parseInt(sel.dataset.id);
      const newRole = e.target.value;
      await updateUserRole(userId, newRole);
    });
  });
}

async function updateUserRole(userId, role) {
  try {
    await api(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: { role }
    });
    showToast('User role updated successfully!', 'success');
    await loadUsers();
  } catch (e) {
    showToast('Failed to update user role: ' + e.message, 'error');
  }
}

async function toggleUserStatus(userId, currentStatus) {
  const newStatus = !currentStatus;
  try {
    await api(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: { is_active: newStatus }
    });
    showToast(`User ${newStatus ? 'activated' : 'deactivated'} successfully!`, 'success');
    await loadUsers();
  } catch (e) {
    showToast('Failed to update user status: ' + e.message, 'error');
  }
}

// ===== TOAST =====
function showToast(message, type = 'success') {
  const container = $('#toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success'
    ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>'
    : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  toast.innerHTML = `${icon}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== UTILITY =====
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
