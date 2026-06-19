import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { updateUserFields, getDb } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { UpdateUserSchema } from '@/lib/server/schemas';

export const PUT = withErrorHandler('app/api/admin/users/[id]/route.js (PUT)', async (request, { params }) => {
  const auth = await verifyAuth(['admin']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = parseInt(params.id);
  const validatedData = await validateBody(request, UpdateUserSchema);

  // Check if modifying the master admin 'aishu'
  const db = getDb();
  const userDoc = await db.collection('users').doc(id.toString()).get();
  if (!userDoc.exists) {
    throw { status: 404, message: 'User not found' };
  }
  const user = userDoc.data();
  if (user.username === 'aishu') {
    throw { status: 403, message: 'The master administrator account details cannot be modified.' };
  }

  await updateUserFields(id, validatedData);
  return NextResponse.json({ success: true });
});
