import { NextResponse } from 'next/server';
import { getInvoiceByShareToken } from '@/lib/server/db';
import { withErrorHandler } from '@/lib/server/apiHandler';

export const GET = withErrorHandler('app/api/public/invoices/[token]/route.js (GET)', async (request, { params }) => {
  const { token } = params;
  const invoice = await getInvoiceByShareToken(token);
  if (!invoice) {
    throw { status: 404, message: 'Invoice not found or link expired' };
  }
  return NextResponse.json(invoice);
});

