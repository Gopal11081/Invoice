import { NextResponse } from 'next/server';
import { validateResetToken, resetUserPassword } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { ResetPasswordSchema } from '@/lib/server/schemas';

export const POST = withErrorHandler('app/api/auth/reset-password/route.js (POST)', async (request) => {
  const validatedData = await validateBody(request, ResetPasswordSchema);
  const { email, token, password } = validatedData;

  const isValid = await validateResetToken(email, token);
  if (!isValid) {
    throw { status: 400, message: 'Invalid or expired reset token' };
  }

  await resetUserPassword(email, password);
  return NextResponse.json({
    success: true,
    message: 'Password reset successful! You can now log in with your new password.'
  });
});

