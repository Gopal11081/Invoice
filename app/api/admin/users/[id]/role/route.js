import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { updateUserRole, getDb } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { UserRoleSchema } from '@/lib/server/schemas';

export const PUT = withErrorHandler('app/api/admin/users/[id]/role/route.js (PUT)', async (request, { params }) => {
  const auth = await verifyAuth(['admin']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = parseInt(params.id);
  const validatedData = await validateBody(request, UserRoleSchema);
  const { role } = validatedData;

  // Check if modifying own account
  if (auth.session.userId === id) {
    throw { status: 400, message: 'You cannot change your own role.' };
  }

  // Check if modifying the master admin 'aishu'
  const db = getDb();
  const userDoc = await db.collection('users').doc(id.toString()).get();
  if (!userDoc.exists) {
    throw { status: 404, message: 'User not found' };
  }
  const user = userDoc.data();
  if (user.username === 'aishu') {
    throw { status: 403, message: 'The master administrator account cannot be modified.' };
  }

  await updateUserRole(id, role);
  return NextResponse.json({ success: true });
});

