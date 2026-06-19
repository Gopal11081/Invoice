import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { getDashboardData } from '@/lib/server/db';
import { withErrorHandler } from '@/lib/server/apiHandler';

export const GET = withErrorHandler('app/api/dashboard/route.js (GET)', async () => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const data = await getDashboardData();
  return NextResponse.json(data);
});

