import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { getUserByUsername, verifyPassword, changePassword } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { ChangePasswordSchema } from '@/lib/server/schemas';

export const PUT = withErrorHandler('app/api/auth/password/route.js (PUT)', async (request) => {
  const auth = await verifyAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const validatedData = await validateBody(request, ChangePasswordSchema);
  const { current_password, new_password } = validatedData;

  const user = await getUserByUsername(auth.session.username);
  if (!user || !await verifyPassword(current_password, user.password_hash)) {
    throw { status: 401, message: 'Current password is incorrect' };
  }

  await changePassword(user.id, new_password);
  return NextResponse.json({ success: true });
});

