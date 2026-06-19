import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { generateShareToken } from '@/lib/server/db';
import { withErrorHandler } from '@/lib/server/apiHandler';

export const POST = withErrorHandler('app/api/invoices/[id]/share/route.js (POST)', async (request, { params }) => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = parseInt(params.id);
  const token = await generateShareToken(id);
  if (!token) {
    throw { status: 404, message: 'Invoice not found' };
  }
  return NextResponse.json({ share_token: token });
});

