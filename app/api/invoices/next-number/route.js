import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { getNextInvoiceNumber } from '@/lib/server/db';
import { withErrorHandler } from '@/lib/server/apiHandler';

export const GET = withErrorHandler('app/api/invoices/next-number/route.js (GET)', async () => {
  const auth = await verifyAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const nextNum = await getNextInvoiceNumber();
  return NextResponse.json({ invoice_number: nextNum });
});

