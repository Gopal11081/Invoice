import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { getInvoices, saveInvoice } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { InvoiceSchema } from '@/lib/server/schemas';

export const GET = withErrorHandler('app/api/invoices/route.js (GET)', async (request) => {
  const auth = await verifyAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit')) || 20;
  const startAfter = searchParams.get('startAfter') || null;
  const result = await getInvoices(limit, startAfter);
  return NextResponse.json(result);
});

export const POST = withErrorHandler('app/api/invoices/route.js (POST)', async (request) => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const validatedData = await validateBody(request, InvoiceSchema);
  const result = await saveInvoice(validatedData);
  return NextResponse.json(result, { status: 201 });
});

