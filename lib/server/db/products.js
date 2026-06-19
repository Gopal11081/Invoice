import 'server-only';
import { db, ensureInitialized, cacheStore, TTL, getCachedValue, setCacheValue, clearProductsCache, getNextId } from './connection';

export async function getProducts() {
  await ensureInitialized();
  const cached = getCachedValue(cacheStore.products, TTL.PRODUCTS);
  if (cached) return cached;
  try {
    const snapshot = await db.collection('products').where('is_active', '==', 1).get();
    const list = [];
    snapshot.forEach(doc => list.push(doc.data()));
    list.sort((a, b) => {
      const orderA = a.sort_order !== undefined ? a.sort_order : a.id;
      const orderB = b.sort_order !== undefined ? b.sort_order : b.id;
      return orderA - orderB;
    });
    cacheStore.products = setCacheValue(list);
    return list;
  } catch (err) {
    const fallback = getCachedValue(cacheStore.products, Infinity, true);
    if (fallback) {
      console.warn('⚠️ Firestore query failed for products. Using stale fallback.');
      return fallback;
    }
    throw err;
  }
}

export async function getProductById(id) {
  await ensureInitialized();
  const cachedList = getCachedValue(cacheStore.products, TTL.PRODUCTS);
  if (cachedList) {
    const found = cachedList.find(p => p.id === Number(id));
    if (found) return found;
  }
  const doc = await db.collection('products').doc(id.toString()).get();
  return doc.exists ? doc.data() : null;
}

export async function addProduct(data) {
  await ensureInitialized();
  const id = await getNextId('products');

  // Find current max sort_order
  const snapshot = await db.collection('products').where('is_active', '==', 1).get();
  let maxOrder = 0;
  snapshot.forEach(doc => {
    const p = doc.data();
    if (p.sort_order && p.sort_order > maxOrder) maxOrder = p.sort_order;
  });

  const product = {
    id,
    description: data.description,
    hsn_sac: data.hsn_sac || '',
    unit: data.unit || 'Nos',
    rate: Number(data.rate) || 0,
    gst_rate: Number(data.gst_rate) || 18,
    qty_per_unit: Number(data.qty_per_unit) || 1,
    is_active: 1,
    sort_order: maxOrder + 1,
    created_at: new Date().toISOString()
  };
  await db.collection('products').doc(id.toString()).set(product);
  // Invalidate cache
  clearProductsCache();
  return product;
}

export async function updateProduct(id, data) {
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
  // Invalidate cache
  clearProductsCache();
}

export async function deleteProduct(id) {
  await ensureInitialized();
  await db.collection('products').doc(id.toString()).update({ is_active: 0 });
  // Invalidate cache
  clearProductsCache();
}

export async function reorderProducts(order) {
  await ensureInitialized();
  const batch = db.batch();
  order.forEach(item => {
    const ref = db.collection('products').doc(item.id.toString());
    batch.update(ref, { sort_order: Number(item.sort_order) });
  });
  await batch.commit();
  // Invalidate cache
  clearProductsCache();
}
