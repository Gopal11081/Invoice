import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { updateUserStatus, getDb } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { UserStatusSchema } from '@/lib/server/schemas';

export const PUT = withErrorHandler('app/api/admin/users/[id]/status/route.js (PUT)', async (request, { params }) => {
  const auth = await verifyAuth(['admin']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = parseInt(params.id);
  const validatedData = await validateBody(request, UserStatusSchema);
  const { is_active } = validatedData;

  // Check if modifying own account
  if (auth.session.userId === id) {
    throw { status: 400, message: 'You cannot deactivate your own account.' };
  }

  // Check if modifying the master admin 'aishu'
  const db = getDb();
  const userDoc = await db.collection('users').doc(id.toString()).get();
  if (!userDoc.exists) {
    throw { status: 404, message: 'User not found' };
  }
  const user = userDoc.data();
  if (user.username === 'aishu') {
    throw { status: 403, message: 'The master administrator account cannot be deactivated.' };
  }

  await updateUserStatus(id, is_active);
  return NextResponse.json({ success: true });
});

