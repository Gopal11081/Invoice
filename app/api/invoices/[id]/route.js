import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { getInvoiceById, deleteInvoice } from '@/lib/server/db';
import { withErrorHandler } from '@/lib/server/apiHandler';

export const GET = withErrorHandler('app/api/invoices/[id]/route.js (GET)', async (request, { params }) => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = parseInt(params.id);
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    throw { status: 404, message: 'Invoice not found' };
  }
  return NextResponse.json(invoice);
});

export const DELETE = withErrorHandler('app/api/invoices/[id]/route.js (DELETE)', async (request, { params }) => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = parseInt(params.id);
  await deleteInvoice(id);
  return NextResponse.json({ success: true });
});

