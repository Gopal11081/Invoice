import { NextResponse } from 'next/server';
import { getUserByUsername, verifyPassword } from '@/lib/server/db';
import { setSession } from '@/lib/server/session';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { LoginUserSchema } from '@/lib/server/schemas';

export const POST = withErrorHandler('app/api/auth/login/route.js (POST)', async (request) => {
  const validatedData = await validateBody(request, LoginUserSchema);
  const { username, password } = validatedData;

  const user = await getUserByUsername(username);
  if (!user) {
    throw { status: 401, message: 'Invalid username or password' };
  }

  if (!await verifyPassword(password, user.password_hash)) {
    throw { status: 401, message: 'Invalid username or password' };
  }

  const isActive = user.is_active !== false;
  if (!isActive) {
    throw { status: 403, message: 'Your account is deactivated. Please contact the administrator.' };
  }

  const role = user.role || (user.id === 1 ? 'admin' : 'staff');
  const sessionData = {
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    role: role
  };

  await setSession(sessionData);

  return NextResponse.json({
    success: true,
    user: { id: user.id, username: user.username, display_name: user.display_name, role: role }
  });
});

