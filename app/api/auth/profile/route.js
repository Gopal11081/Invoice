import { NextResponse } from 'next/server';
import { verifyAuth, setSession } from '@/lib/server/session';
import { getDb, updateUserProfile } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { ProfileUpdateSchema } from '@/lib/server/schemas';

export const GET = withErrorHandler('app/api/auth/profile/route.js (GET)', async () => {
  const auth = await verifyAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getDb();
  const userDoc = await db.collection('users').doc(auth.session.userId.toString()).get();
  if (!userDoc.exists) {
    throw { status: 404, message: 'User not found' };
  }
  const user = userDoc.data();

  return NextResponse.json({
    username: user.username,
    display_name: user.display_name,
    email: user.email || '',
    mobile: user.mobile || ''
  });
});

export const PUT = withErrorHandler('app/api/auth/profile/route.js (PUT)', async (request) => {
  const auth = await verifyAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const validatedData = await validateBody(request, ProfileUpdateSchema);
  const updatedUser = await updateUserProfile(auth.session.userId, validatedData);

  // Update session cookie with new display name
  const updatedSession = {
    ...auth.session,
    displayName: updatedUser.display_name
  };
  await setSession(updatedSession);

  return NextResponse.json({ success: true, user: updatedUser });
});
