import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { getDetailedInvoices } from '@/lib/server/db';
import { withErrorHandler } from '@/lib/server/apiHandler';

export const GET = withErrorHandler('app/api/ca/gst-report/route.js (GET)', async () => {
  const auth = await verifyAuth(['admin', 'ca']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const list = await getDetailedInvoices();
  return NextResponse.json(list);
});

