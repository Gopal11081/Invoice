/* ============================================
   GST INVOICE GENERATOR — Database Layer
   Firebase Firestore via firebase-admin
   ============================================ */

const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

let initStatus = {
  loadedFrom: 'none',
  projectId: '',
  success: false,
  error: null
};

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  const projectId = process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID || 'invoice-36828';
  initStatus.projectId = projectId;

  let serviceAccount = null;

  // 1. Try environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initStatus.loadedFrom = 'env';
    } catch (err) {
      console.error("❌ Error parsing FIREBASE_SERVICE_ACCOUNT environment variable:", err.message);
      initStatus.error = `Env parse error: ${err.message}`;
    }
  }

  // 2. Try local file fallback (for local development)
  if (!serviceAccount) {
    const localKeyPath = path.join(process.cwd(), 'service-account.json');
    if (fs.existsSync(localKeyPath)) {
      try {
        serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, 'utf8'));
        initStatus.loadedFrom = 'local-file';
      } catch (err) {
        console.error("❌ Error reading local service-account.json file:", err.message);
        initStatus.error = `Local file parse error: ${err.message}`;
      }
    }
  }

  // 3. Initialize SDK
  try {
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId
      });
      initStatus.success = true;
      console.log(`\n  🔥 Firebase Admin initialized via Service Account for Project: ${projectId} (source: ${initStatus.loadedFrom})\n`);
    } else {
      admin.initializeApp({ projectId });
      initStatus.success = true;
      console.log(`\n  🔥 Firebase Admin initialized with Project ID: ${projectId} (unauthenticated/ADC)\n`);
    }
  } catch (err) {
    console.error("❌ Error initializing Firebase Admin SDK:", err.message);
    initStatus.error = `Init error: ${err.message}`;
  }

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`  🔌 Connecting to Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}\n`);
  }
}

const db = admin.firestore();

function getDb() {
  return db;
}

// ===== AUTO-INCREMENT ID GENERATOR =====
async function getNextId(collectionName) {
  const counterRef = db.collection('counters').doc(collectionName);
  let nextId;
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);
    if (!doc.exists) {
      nextId = 1;
      transaction.set(counterRef, { current: 1 });
    } else {
      nextId = doc.data().current + 1;
      transaction.update(counterRef, { current: nextId });
    }
  });
  return nextId;
}

// ===== INITIAL SEEDING LOGIC =====
let initialized = false;

async function ensureInitialized() {
  if (initialized) return;

  try {
    // Seed business config if empty
    const configDoc = await db.collection('business_config').doc('default').get();
    if (!configDoc.exists) {
      await db.collection('business_config').doc('default').set({
        id: 1,
        name: 'Your Business Pvt. Ltd.',
        gstin: '22AAAAA0000A1Z5',
        address: '123 Business Park, Main Road, City - 400001',
        state_code: '27',
        phone: '+91 98765 43210',
        email: 'billing@yourbusiness.com',
        terms: '1. Payment is due within 30 days\n2. Goods once sold will not be taken back\n3. Subject to local jurisdiction'
      });
      console.log('  ✅ Seeded default business configuration');
    }

    // Seed default admin user if empty
    const userSnapshot = await db.collection('users').limit(1).get();
    if (userSnapshot.empty) {
      const hash = bcrypt.hashSync('aishu123', 10);
      await db.collection('users').doc('1').set({
        id: 1,
        username: 'aishu',
        password_hash: hash,
        display_name: 'Aishwaraya Gupta',
        is_active: true,
        role: 'admin',
        created_at: new Date().toISOString()
      });
      await db.collection('counters').doc('users').set({ current: 1 });
      console.log('  ✅ Seeded default admin user');
    } else {
      // Ensure 'aishu' admin exists or migrate from 'admin'
      const aishuSnapshot = await db.collection('users').where('username', '==', 'aishu').limit(1).get();
      if (aishuSnapshot.empty) {
        const adminSnapshot = await db.collection('users').where('username', '==', 'admin').limit(1).get();
        if (!adminSnapshot.empty) {
          const adminDoc = adminSnapshot.docs[0];
          const hash = bcrypt.hashSync('aishu123', 10);
          await adminDoc.ref.update({
            username: 'aishu',
            password_hash: hash,
            display_name: 'Aishwaraya Gupta',
            role: 'admin'
          });
          console.log('  🔄 Migrated default admin user from admin to aishu');
        } else {
          // If no admin and no aishu, seed aishu
          const hash = bcrypt.hashSync('aishu123', 10);
          await db.collection('users').doc('1').set({
            id: 1,
            username: 'aishu',
            password_hash: hash,
            display_name: 'Aishwaraya Gupta',
            is_active: true,
            role: 'admin',
            created_at: new Date().toISOString()
          });
          console.log('  ✅ Seeded missing default admin user aishu');
        }
      }
    }

    // Seed products if empty
    const productSnapshot = await db.collection('products').limit(1).get();
    if (productSnapshot.empty) {
      const sampleProducts = [
        ['Web Development Service', '998314', 'Hrs', 2500, 18],
        ['Mobile App Development', '998314', 'Hrs', 3000, 18],
        ['UI/UX Design Service', '998314', 'Hrs', 2000, 18],
        ['Cloud Hosting (Monthly)', '998315', 'Nos', 5000, 18],
        ['Domain Registration', '998315', 'Nos', 800, 18],
        ['SSL Certificate', '998315', 'Nos', 3500, 18],
        ['SEO Service Package', '998314', 'Nos', 15000, 18],
        ['Laptop - Business Series', '8471', 'Nos', 55000, 18],
        ['Wireless Mouse', '8471', 'Nos', 800, 18],
        ['Printed T-Shirt', '6109', 'Pcs', 450, 5],
        ['Office Chair - Ergonomic', '9401', 'Nos', 12000, 18],
        ['Annual Maintenance Contract', '998714', 'Nos', 25000, 18],
        ['Consulting Fee', '998311', 'Hrs', 5000, 18],
        ['Digital Marketing Package', '998314', 'Nos', 20000, 18],
        ['Custom Software License', '998316', 'Nos', 50000, 18],
      ];

      let currentId = 0;
      const batch = db.batch();
      sampleProducts.forEach(p => {
        currentId++;
        const ref = db.collection('products').doc(currentId.toString());
        batch.set(ref, {
          id: currentId,
          description: p[0],
          hsn_sac: p[1],
          unit: p[2],
          rate: p[3],
          gst_rate: p[4],
          is_active: 1,
          created_at: new Date().toISOString()
        });
      });
      await batch.commit();
      await db.collection('counters').doc('products').set({ current: currentId });
      console.log(`  ✅ Seeded ${currentId} default products`);
    }

    // Seed customers if empty
    const customerSnapshot = await db.collection('customers').limit(1).get();
    if (customerSnapshot.empty) {
      const sampleCustomers = [
        ['Acme Corporation', '27BBBBB1111A1Z1', '456 Industrial Area, Pune, Maharashtra', '27', '+91 98220 12345', 'billing@acme.com'],
        ['Globex India Pvt Ltd', '09CCCCC2222B1Z2', '789 Tech Hub, Sector 62, Noida, Uttar Pradesh', '09', '+91 98110 54321', 'accounts@globex.in'],
        ['Local Retail Store', '', 'Shop 12, Main Bazar, Raipur, Chhattisgarh', '22', '+91 77140 98765', 'localretail@gmail.com']
      ];

      let currentId = 0;
      const batch = db.batch();
      sampleCustomers.forEach(c => {
        currentId++;
        const ref = db.collection('customers').doc(currentId.toString());
        batch.set(ref, {
          id: currentId,
          name: c[0],
          gstin: c[1],
          address: c[2],
          state_code: c[3],
          phone: c[4],
          email: c[5],
          is_active: 1,
          created_at: new Date().toISOString()
        });
      });
      await batch.commit();
      await db.collection('counters').doc('customers').set({ current: currentId });
      console.log(`  ✅ Seeded ${currentId} default customers`);
    }

    initialized = true;
  } catch (err) {
    console.error('❌ Error initializing database:', err.message);
  }
}

// ===== BUSINESS CONFIG =====
async function getBusinessConfig() {
  await ensureInitialized();
  const doc = await db.collection('business_config').doc('default').get();
  return doc.exists ? doc.data() : null;
}

async function updateBusinessConfig(data) {
  await ensureInitialized();
  await db.collection('business_config').doc('default').update({
    name: data.name || '',
    gstin: data.gstin || '',
    address: data.address || '',
    state_code: data.state_code || '',
    phone: data.phone || '',
    email: data.email || '',
    terms: data.terms || ''
  });
}

// ===== PRODUCTS =====
async function getProducts() {
  await ensureInitialized();
  const snapshot = await db.collection('products').where('is_active', '==', 1).get();
  const list = [];
  snapshot.forEach(doc => list.push(doc.data()));
  list.sort((a, b) => a.description.localeCompare(b.description));
  return list;
}

async function getProductById(id) {
  await ensureInitialized();
  const doc = await db.collection('products').doc(id.toString()).get();
  return doc.exists ? doc.data() : null;
}

async function addProduct(data) {
  await ensureInitialized();
  const id = await getNextId('products');
  const product = {
    id,
    description: data.description,
    hsn_sac: data.hsn_sac || '',
    unit: data.unit || 'Nos',
    rate: Number(data.rate) || 0,
    gst_rate: Number(data.gst_rate) || 18,
    qty_per_unit: Number(data.qty_per_unit) || 1,
    is_active: 1,
    created_at: new Date().toISOString()
  };
  await db.collection('products').doc(id.toString()).set(product);
  return product;
}

async function updateProduct(id, data) {
  await ensureInitialized();
  const ref = db.collection('products').doc(id.toString());
  await ref.update({
    description: data.description,
    hsn_sac: data.hsn_sac || '',
    unit: data.unit || 'Nos',
    rate: Number(data.rate) || 0,
    gst_rate: Number(data.gst_rate) || 18,
    qty_per_unit: Number(data.qty_per_unit) || 1
  });
}

async function deleteProduct(id) {
  await ensureInitialized();
  await db.collection('products').doc(id.toString()).update({ is_active: 0 });
}

// ===== INVOICES =====
async function getInvoices() {
  await ensureInitialized();
  const snapshot = await db.collection('invoices').get();
  const list = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    list.push({
      id: data.id,
      invoice_number: data.invoice_number,
      invoice_date: data.invoice_date,
      buyer_name: data.buyer_name,
      grand_total: data.grand_total,
      created_at: data.created_at
    });
  });
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return list;
}

async function getInvoiceById(id) {
  await ensureInitialized();
  const doc = await db.collection('invoices').doc(id.toString()).get();
  return doc.exists ? doc.data() : null;
}

async function getNextInvoiceNumber() {
  await ensureInitialized();
  const snapshot = await db.collection('invoices').orderBy('id', 'desc').limit(1).get();
  if (snapshot.empty) return 'BE-0001';
  
  const last = snapshot.docs[0].data();
  
  // Match BE- sequence
  const matchBE = last.invoice_number.match(/BE-(\d+)/);
  if (matchBE) {
    const next = parseInt(matchBE[1], 10) + 1;
    return `BE-${String(next).padStart(4, '0')}`;
  }
  
  // Match old INV- sequence to migrate seamlessly
  const matchINV = last.invoice_number.match(/INV-(\d+)/);
  if (matchINV) {
    const next = parseInt(matchINV[1], 10) + 1;
    return `BE-${String(next).padStart(4, '0')}`;
  }
  
  return `BE-${String(Date.now()).slice(-4)}`;
}

async function saveInvoice(data) {
  await ensureInitialized();

  // Upsert customer profile first
  if (data.buyer_name) {
    await upsertCustomerFromInvoice({
      name: data.buyer_name,
      gstin: data.buyer_gstin || '',
      address: data.buyer_address || '',
      state_code: data.buyer_state || '',
      phone: data.buyer_phone || '',
      email: data.buyer_email || '',
    });
  }

  // Check if invoice number already exists
  const invoiceNumSnapshot = await db.collection('invoices')
    .where('invoice_number', '==', data.invoice_number)
    .limit(1)
    .get();

  if (!invoiceNumSnapshot.empty) {
    const existingDoc = invoiceNumSnapshot.docs[0];
    const existingId = existingDoc.data().id;
    const updatedData = {
      ...existingDoc.data(),
      invoice_date: data.invoice_date,
      due_date: data.due_date || null,
      place_of_supply: data.place_of_supply || '',
      supply_type: data.supply_type || 'intra',
      buyer_name: data.buyer_name || '',
      buyer_gstin: data.buyer_gstin || '',
      buyer_address: data.buyer_address || '',
      buyer_state: data.buyer_state || '',
      buyer_phone: data.buyer_phone || '',
      buyer_email: data.buyer_email || '',
      subtotal: Number(data.subtotal) || 0,
      total_discount: Number(data.total_discount) || 0,
      taxable_amount: Number(data.taxable_amount) || 0,
      cgst: Number(data.cgst) || 0,
      sgst: Number(data.sgst) || 0,
      igst: Number(data.igst) || 0,
      grand_total: Number(data.grand_total) || 0,
      amount_in_words: data.amount_in_words || '',
      notes: data.notes || '',
      items: data.items || [],
    };
    await db.collection('invoices').doc(existingId.toString()).set(updatedData);
    return { id: existingId, invoice_number: data.invoice_number, updated: true };
  }

  // Insert new invoice
  const nextInvoiceId = await getNextId('invoices');
  const newInvoiceData = {
    id: nextInvoiceId,
    invoice_number: data.invoice_number,
    invoice_date: data.invoice_date,
    due_date: data.due_date || null,
    place_of_supply: data.place_of_supply || '',
    supply_type: data.supply_type || 'intra',
    buyer_name: data.buyer_name || '',
    buyer_gstin: data.buyer_gstin || '',
    buyer_address: data.buyer_address || '',
    buyer_state: data.buyer_state || '',
    buyer_phone: data.buyer_phone || '',
    buyer_email: data.buyer_email || '',
    subtotal: Number(data.subtotal) || 0,
    total_discount: Number(data.total_discount) || 0,
    taxable_amount: Number(data.taxable_amount) || 0,
    cgst: Number(data.cgst) || 0,
    sgst: Number(data.sgst) || 0,
    igst: Number(data.igst) || 0,
    grand_total: Number(data.grand_total) || 0,
    amount_in_words: data.amount_in_words || '',
    notes: data.notes || '',
    share_token: null,
    created_at: new Date().toISOString(),
    items: data.items || [],
  };

  await db.collection('invoices').doc(nextInvoiceId.toString()).set(newInvoiceData);
  return { id: nextInvoiceId, invoice_number: data.invoice_number, created: true };
}

async function deleteInvoice(id) {
  await ensureInitialized();
  await db.collection('invoices').doc(id.toString()).delete();
  return { success: true };
}

// ===== DASHBOARD ANALYTICS =====
async function getDashboardData() {
  await ensureInitialized();
  const snapshot = await db.collection('invoices').get();
  const invoices = [];
  snapshot.forEach(doc => invoices.push(doc.data()));

  // 1. Overall totals
  let total_invoices = invoices.length;
  let total_sales = 0;
  let total_taxable = 0;
  let total_discount = 0;
  let total_cgst = 0;
  let total_sgst = 0;
  let total_igst = 0;
  let total_tax = 0;

  invoices.forEach(inv => {
    total_sales += inv.grand_total || 0;
    total_taxable += inv.taxable_amount || 0;
    total_discount += inv.total_discount || 0;
    total_cgst += inv.cgst || 0;
    total_sgst += inv.sgst || 0;
    total_igst += inv.igst || 0;
  });
  total_tax = total_cgst + total_sgst + total_igst;
  let avg_invoice = total_invoices > 0 ? total_sales / total_invoices : 0;

  const totals = {
    total_invoices,
    total_sales,
    avg_invoice,
    total_taxable,
    total_discount,
    total_cgst,
    total_sgst,
    total_igst,
    total_tax
  };

  // 2. Current Month vs Previous Month Totals
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  let currentMonthSales = 0;
  let currentMonthCount = 0;
  let prevMonthSales = 0;
  let prevMonthCount = 0;

  invoices.forEach(inv => {
    if (inv.invoice_date && inv.invoice_date.startsWith(currentMonthStr)) {
      currentMonthSales += inv.grand_total || 0;
      currentMonthCount++;
    } else if (inv.invoice_date && inv.invoice_date.startsWith(prevMonthStr)) {
      prevMonthSales += inv.grand_total || 0;
      prevMonthCount++;
    }
  });

  const currentMonth = { invoices: currentMonthCount, sales: currentMonthSales };
  const prevMonth = { invoices: prevMonthCount, sales: prevMonthSales };

  // 3. Monthly sales for last 12 months
  const monthlySales = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    let sales = 0;
    let count = 0;
    invoices.forEach(inv => {
      if (inv.invoice_date && inv.invoice_date.startsWith(mStr)) {
        sales += inv.grand_total || 0;
        count++;
      }
    });
    monthlySales.push({ month: mStr, sales, count });
  }

  // 4. Top 5 products by revenue
  const productRevenueMap = {};
  const productQtyMap = {};
  const productInvoiceCountMap = {};

  invoices.forEach(inv => {
    const uniqueItemsInInvoice = new Set();
    if (inv.items) {
      inv.items.forEach(item => {
        const desc = item.description || '';
        if (desc) {
          productRevenueMap[desc] = (productRevenueMap[desc] || 0) + (item.taxable_amount || 0);
          productQtyMap[desc] = (productQtyMap[desc] || 0) + (item.qty || 0);
          uniqueItemsInInvoice.add(desc);
        }
      });
    }
    uniqueItemsInInvoice.forEach(desc => {
      productInvoiceCountMap[desc] = (productInvoiceCountMap[desc] || 0) + 1;
    });
  });

  const topProducts = Object.keys(productRevenueMap).map(desc => ({
    description: desc,
    total_qty: productQtyMap[desc],
    total_revenue: productRevenueMap[desc],
    invoice_count: productInvoiceCountMap[desc] || 0
  })).sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 5);

  // 5. Top 5 customers by spending
  const customerSpendingMap = {};
  const customerInvoiceCountMap = {};

  invoices.forEach(inv => {
    const name = inv.buyer_name || '';
    if (name) {
      customerSpendingMap[name] = (customerSpendingMap[name] || 0) + (inv.grand_total || 0);
      customerInvoiceCountMap[name] = (customerInvoiceCountMap[name] || 0) + 1;
    }
  });

  const topCustomers = Object.keys(customerSpendingMap).map(name => ({
    buyer_name: name,
    invoice_count: customerInvoiceCountMap[name],
    total_spent: customerSpendingMap[name]
  })).sort((a, b) => b.total_spent - a.total_spent).slice(0, 5);

  // 6. Recent 5 invoices
  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)
    .map(inv => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      buyer_name: inv.buyer_name,
      grand_total: inv.grand_total
    }));

  // 7. Sales by supply type
  const supplyMap = { intra: { count: 0, total: 0 }, inter: { count: 0, total: 0 } };
  invoices.forEach(inv => {
    const type = inv.supply_type === 'inter' ? 'inter' : 'intra';
    supplyMap[type].count++;
    supplyMap[type].total += inv.grand_total || 0;
  });
  const supplyBreakdown = [
    { supply_type: 'intra', count: supplyMap.intra.count, total: supplyMap.intra.total },
    { supply_type: 'inter', count: supplyMap.inter.count, total: supplyMap.inter.total }
  ];

  return {
    totals,
    currentMonth,
    prevMonth,
    monthlySales,
    topProducts,
    topCustomers,
    recentInvoices,
    supplyBreakdown
  };
}

// ===== USERS / AUTH =====
async function getUserByUsername(username) {
  await ensureInitialized();
  const cleanUsername = (username || '').toLowerCase().trim();
  const snapshot = await db.collection('users').where('username', '==', cleanUsername).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

async function getUserByEmail(email) {
  await ensureInitialized();
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) return null;
  const snapshot = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

function verifyPassword(plaintext, hash) {
  return bcrypt.compareSync(plaintext, hash);
}

async function changePassword(userId, newPassword) {
  await ensureInitialized();
  const hash = bcrypt.hashSync(newPassword, 10);
  await db.collection('users').doc(userId.toString()).update({ password_hash: hash });
}

async function saveResetToken(userId, token, expiry) {
  await ensureInitialized();
  await db.collection('users').doc(userId.toString()).update({
    reset_token: token,
    reset_token_expiry: expiry.toISOString()
  });
}

async function validateResetToken(email, token) {
  await ensureInitialized();
  const user = await getUserByEmail(email);
  if (!user) return false;
  if (!user.reset_token || user.reset_token !== token) return false;
  if (!user.reset_token_expiry) return false;
  const expiry = new Date(user.reset_token_expiry);
  if (expiry < new Date()) return false;
  return true;
}

async function resetUserPassword(email, newPassword) {
  await ensureInitialized();
  const user = await getUserByEmail(email);
  if (!user) throw new Error('User not found');
  const hash = bcrypt.hashSync(newPassword, 10);
  await db.collection('users').doc(user.id.toString()).update({
    password_hash: hash,
    reset_token: admin.firestore.FieldValue.delete(),
    reset_token_expiry: admin.firestore.FieldValue.delete()
  });
}

async function registerUser(data) {
  await ensureInitialized();
  const id = await getNextId('users');
  const hash = bcrypt.hashSync(data.password, 10);
  const user = {
    id,
    username: data.username.toLowerCase().trim(),
    password_hash: hash,
    display_name: data.display_name.trim(),
    email: (data.email || '').trim(),
    mobile: (data.mobile || '').trim(),
    is_active: false, // Deactivated by default per plan
    created_at: new Date().toISOString()
  };
  await db.collection('users').doc(id.toString()).set(user);
  return { id: user.id, username: user.username, display_name: user.display_name };
}

async function getAllUsers() {
  await ensureInitialized();
  const snapshot = await db.collection('users').get();
  const list = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    list.push({
      id: data.id,
      username: data.username,
      display_name: data.display_name,
      email: data.email || '',
      mobile: data.mobile || '',
      is_active: data.is_active === undefined ? true : data.is_active,
      role: data.role || (data.username === 'aishu' ? 'admin' : 'staff'),
      created_at: data.created_at
    });
  });
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return list;
}

async function updateUserStatus(userId, isActive) {
  await ensureInitialized();
  await db.collection('users').doc(userId.toString()).update({
    is_active: isActive
  });
}

async function updateUserRole(userId, role) {
  await ensureInitialized();
  await db.collection('users').doc(userId.toString()).update({
    role: role
  });
}

// ===== SHARE TOKEN =====
async function getInvoiceByShareToken(token) {
  await ensureInitialized();
  const snapshot = await db.collection('invoices').where('share_token', '==', token).limit(1).get();
  if (snapshot.empty) return null;
  const invoice = snapshot.docs[0].data();
  const business = await getBusinessConfig();
  return { ...invoice, business };
}

async function generateShareToken(invoiceId) {
  await ensureInitialized();
  const ref = db.collection('invoices').doc(invoiceId.toString());
  const doc = await ref.get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (data.share_token) return data.share_token;
  const crypto = require('crypto');
  const token = crypto.randomBytes(16).toString('hex');
  await ref.update({ share_token: token });
  return token;
}

// ===== CUSTOMERS =====
async function getCustomers() {
  await ensureInitialized();
  const snapshot = await db.collection('customers').where('is_active', '==', 1).get();
  const list = [];
  snapshot.forEach(doc => list.push(doc.data()));
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

async function getCustomerById(id) {
  await ensureInitialized();
  const doc = await db.collection('customers').doc(id.toString()).get();
  return doc.exists ? doc.data() : null;
}

async function addCustomer(data) {
  await ensureInitialized();
  const id = await getNextId('customers');
  const customer = {
    id,
    name: data.name,
    gstin: data.gstin || '',
    address: data.address || '',
    state_code: data.state_code || '',
    phone: data.phone || '',
    email: data.email || '',
    is_active: 1,
    created_at: new Date().toISOString()
  };
  await db.collection('customers').doc(id.toString()).set(customer);
  return customer;
}

async function updateCustomer(id, data) {
  await ensureInitialized();
  await db.collection('customers').doc(id.toString()).update({
    name: data.name,
    gstin: data.gstin || '',
    address: data.address || '',
    state_code: data.state_code || '',
    phone: data.phone || '',
    email: data.email || ''
  });
}

async function deleteCustomer(id) {
  await ensureInitialized();
  await db.collection('customers').doc(id.toString()).update({ is_active: 0 });
}

async function upsertCustomerFromInvoice(data) {
  await ensureInitialized();
  const snapshot = await db.collection('customers').where('name', '==', data.name).limit(1).get();
  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    await doc.ref.update({
      gstin: data.gstin || '',
      address: data.address || '',
      state_code: data.state_code || '',
      phone: data.phone || '',
      email: data.email || '',
      is_active: 1
    });
  } else {
    await addCustomer(data);
  }
}

async function getInitStatus() {
  const status = { ...initStatus };
  try {
    const testDoc = await db.collection('business_config').doc('default').get();
    status.firestoreConnection = 'connected';
    status.firestoreData = testDoc.exists ? 'found' : 'not_found';
  } catch (err) {
    status.firestoreConnection = 'failed';
    status.firestoreError = err.message;
  }
  return status;
}

module.exports = {
  getDb,
  getBusinessConfig,
  updateBusinessConfig,
  getProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  getInvoices,
  getInvoiceById,
  getNextInvoiceNumber,
  saveInvoice,
  deleteInvoice,
  getDashboardData,
  getUserByUsername,
  getUserByEmail,
  verifyPassword,
  changePassword,
  saveResetToken,
  validateResetToken,
  resetUserPassword,
  registerUser,
  getAllUsers,
  updateUserStatus,
  updateUserRole,
  getInvoiceByShareToken,
  generateShareToken,
  getCustomers,
  getCustomerById,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  upsertCustomerFromInvoice,
  getInitStatus,
};
