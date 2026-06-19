import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { getAllUsers } from '@/lib/server/db';
import { withErrorHandler } from '@/lib/server/apiHandler';

export const GET = withErrorHandler('app/api/admin/users/route.js (GET)', async () => {
  const auth = await verifyAuth(['admin']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const list = await getAllUsers();
  return NextResponse.json(list);
});

