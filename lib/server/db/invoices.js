import 'server-only';
import crypto from 'crypto';
import { db, ensureInitialized, cacheStore, TTL, getCachedValue, setCacheValue, clearInvoicesCache, clearCustomersCache, getNextId } from './connection';
import { upsertCustomerFromInvoice } from './customers';
import { getBusinessConfig } from './business';

export async function getInvoices(limitVal = 20, startAfter = null) {
  await ensureInitialized();
  const cacheKey = `${limitVal}_first`;
  if (!startAfter) {
    const cached = getCachedValue(cacheStore.invoices[cacheKey], TTL.INVOICES);
    if (cached) return cached;
  }

  try {
    const countSnapshot = await db.collection('invoices')
      .where('is_deleted', '==', false)
      .count()
      .get();
    const totalCount = countSnapshot.data().count;

    let query = db.collection('invoices')
      .where('is_deleted', '==', false)
      .orderBy('created_at', 'desc')
      .limit(limitVal);

    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    const snapshot = await query.get();
    const list = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      list.push({
        id: data.id,
        invoice_number: data.invoice_number,
        invoice_date: data.invoice_date,
        buyer_name: data.buyer_name,
        grand_total: data.grand_total,
        created_at: data.created_at,
        email_status: data.email_status || 'not_sent'
      });
    });

    const result = { list, totalCount };

    if (!startAfter) {
      cacheStore.invoices[cacheKey] = setCacheValue(result);
    }
    return result;
  } catch (err) {
    if (!startAfter) {
      const fallback = getCachedValue(cacheStore.invoices[cacheKey], Infinity, true);
      if (fallback) {
        console.warn('⚠️ Firestore query failed for invoices list. Using stale fallback.');
        return fallback;
      }
    }
    throw err;
  }
}

export async function getInvoiceById(id) {
  await ensureInitialized();
  const cached = getCachedValue(cacheStore.invoiceById[id], TTL.INVOICES);
  if (cached) return cached;
  try {
    const doc = await db.collection('invoices').doc(id.toString()).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (data.is_deleted) return null;
    cacheStore.invoiceById[id] = setCacheValue(data);
    return data;
  } catch (err) {
    const fallback = getCachedValue(cacheStore.invoiceById[id], Infinity, true);
    if (fallback) {
      console.warn(`⚠️ Firestore query failed for invoice ID ${id}. Using stale fallback.`);
      return fallback;
    }
    throw err;
  }
}

export async function getNextInvoiceNumber() {
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

export async function saveInvoice(data) {
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

  // Invalidate caches
  clearInvoicesCache();
  clearCustomersCache();

  // Check if invoice number already exists
  const invoiceNumSnapshot = await db.collection('invoices')
    .where('invoice_number', '==', data.invoice_number)
    .limit(1)
    .get();

  const business = await getBusinessConfig();
  const sendEmails = business?.send_emails !== false;

  if (!invoiceNumSnapshot.empty) {
    const existingDoc = invoiceNumSnapshot.docs[0];
    const existingId = existingDoc.data().id;
    const existingStatus = existingDoc.data().email_status;
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
      is_deleted: false,
      email_status: sendEmails ? (existingStatus === 'disabled' ? 'pending' : existingStatus || 'pending') : 'disabled',
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
    is_deleted: false,
    email_status: sendEmails ? 'pending' : 'disabled',
    created_at: new Date().toISOString(),
    items: data.items || [],
  };

  await db.collection('invoices').doc(nextInvoiceId.toString()).set(newInvoiceData);
  return { id: nextInvoiceId, invoice_number: data.invoice_number, created: true };
}

export async function deleteInvoice(id) {
  await ensureInitialized();
  await db.collection('invoices').doc(id.toString()).update({ is_deleted: true });
  // Invalidate caches
  clearInvoicesCache();
  clearCustomersCache();
  return { success: true };
}

export async function getInvoiceByShareToken(token) {
  await ensureInitialized();
  const cached = getCachedValue(cacheStore.invoiceByShareToken[token], TTL.INVOICES);
  if (cached) return cached;
  const snapshot = await db.collection('invoices')
    .where('share_token', '==', token)
    .where('is_deleted', '==', false)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const invoice = snapshot.docs[0].data();
  const business = await getBusinessConfig();
  const result = { ...invoice, business };
  cacheStore.invoiceByShareToken[token] = setCacheValue(result);
  return result;
}

export async function generateShareToken(invoiceId) {
  await ensureInitialized();
  const ref = db.collection('invoices').doc(invoiceId.toString());
  const doc = await ref.get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (data.share_token) return data.share_token;
  const token = crypto.randomBytes(16).toString('hex');
  await ref.update({ share_token: token });
  // Invalidate caches
  clearInvoicesCache();
  return token;
}

export async function getDetailedInvoices() {
  await ensureInitialized();
  const cached = getCachedValue(cacheStore.detailedInvoices, TTL.INVOICES);
  if (cached) return cached;
  try {
    const snapshot = await db.collection('invoices')
      .where('is_deleted', '==', false)
      .get();
    const list = [];
    snapshot.forEach(doc => {
      list.push(doc.data());
    });
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    cacheStore.detailedInvoices = setCacheValue(list);
    return list;
  } catch (err) {
    const fallback = getCachedValue(cacheStore.detailedInvoices, Infinity, true);
    if (fallback) {
      console.warn('⚠️ Firestore query failed for detailed invoices. Using stale fallback.');
      return fallback;
    }
    throw err;
  }
}
