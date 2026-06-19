import 'server-only';
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

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

export const db = admin.firestore();

export function getDb() {
  return db;
}

// ===== IN-MEMORY CACHE STORES =====
export const cacheStore = {
  businessConfig: null,
  products: null,
  customers: null,
  invoices: {},
  invoiceById: {},
  detailedInvoices: null,
  invoiceByShareToken: {}
};

// TTL configurations (milliseconds)
export const TTL = {
  BUSINESS_CONFIG: 60 * 1000,
  PRODUCTS: 15 * 1000,
  CUSTOMERS: 15 * 1000,
  INVOICES: 5 * 1000
};

export function getCachedValue(cacheEntry, ttlMs, force = false) {
  if (!cacheEntry) return null;
  if (force) return cacheEntry.value;
  const age = Date.now() - cacheEntry.timestamp;
  if (age < ttlMs) {
    return cacheEntry.value;
  }
  return null;
}

export function setCacheValue(value) {
  return { value, timestamp: Date.now() };
}

// Invalidation helpers
export function clearInvoicesCache() {
  cacheStore.invoices = {};
  cacheStore.invoiceById = {};
  cacheStore.invoiceByShareToken = {};
  cacheStore.detailedInvoices = null;
}

export function clearProductsCache() {
  cacheStore.products = null;
}

export function clearCustomersCache() {
  cacheStore.customers = null;
}

export function clearBusinessConfigCache() {
  cacheStore.businessConfig = null;
}

// ===== AUTO-INCREMENT ID GENERATOR =====
export async function getNextId(collectionName) {
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

export async function ensureInitialized() {
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
        terms: '1. Payment is due within 30 days\n2. Goods once sold will not be taken back\n3. Subject to local jurisdiction',
        send_emails: true
      });
      console.log('  ✅ Seeded default business configuration');
    }

    // Seed default admin user if empty
    const userSnapshot = await db.collection('users').limit(1).get();
    if (userSnapshot.empty) {
      const defaultAdminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
      const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
      const hash = admin.firestore.FieldValue.serverTimestamp(); // placeholder or real hash
      // We will hash with bcrypt. Since bcrypt is required, we do it in a non-blocking way if possible, or just sync for first initialization
      const bcrypt = require('bcryptjs');
      const realHash = bcrypt.hashSync(defaultAdminPassword, 10);
      await db.collection('users').doc('1').set({
        id: 1,
        username: defaultAdminUsername,
        password_hash: realHash,
        display_name: 'System Administrator',
        is_active: true,
        role: 'admin',
        created_at: new Date().toISOString()
      });
      await db.collection('counters').doc('users').set({ current: 1 });
      console.log(`  ✅ Seeded default admin user: ${defaultAdminUsername}`);
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
          sort_order: currentId,
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

    // Migrate invoices to have is_deleted: false if missing
    try {
      const invoiceMigSnapshot = await db.collection('invoices').get();
      const migBatch = db.batch();
      let migrateCount = 0;
      invoiceMigSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.is_deleted === undefined) {
          migBatch.update(doc.ref, { is_deleted: false });
          migrateCount++;
        }
      });
      if (migrateCount > 0) {
        await migBatch.commit();
        console.log(`  ✅ Migrated ${migrateCount} invoices to set is_deleted: false`);
      }
    } catch (migErr) {
      console.error('⚠️ Error migrating invoices in ensureInitialized:', migErr.message);
    }

    initialized = true;
  } catch (err) {
    console.error('❌ Error initializing database:', err.message);
  }
}

export async function getInitStatus() {
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
