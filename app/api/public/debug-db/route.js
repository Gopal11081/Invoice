import { NextResponse } from 'next/server';
import { getInitStatus } from '@/lib/server/db';
import { withErrorHandler } from '@/lib/server/apiHandler';

export const GET = withErrorHandler('app/api/public/debug-db/route.js (GET)', async () => {
  const status = await getInitStatus();
  return NextResponse.json(status);
});

