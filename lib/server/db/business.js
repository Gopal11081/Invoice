import 'server-only';
import { db, ensureInitialized, cacheStore, TTL, getCachedValue, setCacheValue, clearBusinessConfigCache } from './connection';

export async function getBusinessConfig() {
  await ensureInitialized();
  const cached = getCachedValue(cacheStore.businessConfig, TTL.BUSINESS_CONFIG);
  if (cached) return cached;
  try {
    const doc = await db.collection('business_config').doc('default').get();
    if (doc.exists) {
      const data = doc.data();
      cacheStore.businessConfig = setCacheValue(data);
      return data;
    }
    return null;
  } catch (err) {
    const fallback = getCachedValue(cacheStore.businessConfig, Infinity, true);
    if (fallback) {
      console.warn('⚠️ Firestore query failed for business_config. Using stale fallback.');
      return fallback;
    }
    throw err;
  }
}

export async function updateBusinessConfig(data) {
  await ensureInitialized();
  await db.collection('business_config').doc('default').set({
    name: data.name || '',
    gstin: data.gstin || '',
    address: data.address || '',
    state_code: data.state_code || '',
    phone: data.phone || '',
    email: data.email || '',
    terms: data.terms || '',
    send_emails: data.send_emails === undefined ? true : Boolean(data.send_emails)
  }, { merge: true });
  // Invalidate caches
  clearBusinessConfigCache();
  cacheStore.invoiceByShareToken = {};
}
