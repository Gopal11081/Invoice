import { NextResponse } from 'next/server';
import { logErrorToDb } from '@/lib/server/db';
import { withErrorHandler } from '@/lib/server/apiHandler';

export const POST = withErrorHandler('frontend-logger', async (request) => {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    body = {};
  }
  await logErrorToDb('frontend', body.message || 'Unknown frontend error', body.stack || '');
  return new NextResponse(null, { status: 200 });
});

