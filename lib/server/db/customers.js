import 'server-only';
import { db, ensureInitialized, cacheStore, TTL, getCachedValue, setCacheValue, clearCustomersCache, getNextId } from './connection';

export async function getCustomers() {
  await ensureInitialized();
  const cached = getCachedValue(cacheStore.customers, TTL.CUSTOMERS);
  if (cached) return cached;
  try {
    const snapshot = await db.collection('customers').where('is_active', '==', 1).get();
    const list = [];
    snapshot.forEach(doc => list.push(doc.data()));
    list.sort((a, b) => a.name.localeCompare(b.name));
    cacheStore.customers = setCacheValue(list);
    return list;
  } catch (err) {
    const fallback = getCachedValue(cacheStore.customers, Infinity, true);
    if (fallback) {
      console.warn('⚠️ Firestore query failed for customers. Using stale fallback.');
      return fallback;
    }
    throw err;
  }
}

export async function getCustomerById(id) {
  await ensureInitialized();
  const cachedList = getCachedValue(cacheStore.customers, TTL.CUSTOMERS);
  if (cachedList) {
    const found = cachedList.find(c => c.id === Number(id));
    if (found) return found;
  }
  const doc = await db.collection('customers').doc(id.toString()).get();
  return doc.exists ? doc.data() : null;
}

export async function addCustomer(data) {
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
  // Invalidate cache
  clearCustomersCache();
  return customer;
}

export async function updateCustomer(id, data) {
  await ensureInitialized();
  await db.collection('customers').doc(id.toString()).update({
    name: data.name,
    gstin: data.gstin || '',
    address: data.address || '',
    state_code: data.state_code || '',
    phone: data.phone || '',
    email: data.email || ''
  });
  // Invalidate cache
  clearCustomersCache();
}

export async function deleteCustomer(id) {
  await ensureInitialized();
  await db.collection('customers').doc(id.toString()).update({ is_active: 0 });
  // Invalidate cache
  clearCustomersCache();
}

export async function upsertCustomerFromInvoice(data) {
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
  // Invalidate cache
  clearCustomersCache();
}
