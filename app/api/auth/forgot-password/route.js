import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getUserByEmail, saveResetToken } from '@/lib/server/db';
import { getSession } from '@/lib/server/session';
import { transporter, smtpFrom } from '@/lib/server/mailer';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { ForgotPasswordSchema } from '@/lib/server/schemas';

export const POST = withErrorHandler('app/api/auth/forgot-password/route.js (POST)', async (request) => {
  const validatedData = await validateBody(request, ForgotPasswordSchema);
  const { email } = validatedData;

  const user = await getUserByEmail(email);
  if (!user) {
    throw { status: 400, message: 'No user account found with that email address' };
  }

  // --- Role gate: only admins can self-reset, or a logged-in admin can reset anyone ---
  const session = await getSession();
  const isLoggedInAdmin = session && session.role === 'admin';
  const userRole = user.role || (user.id === 1 ? 'admin' : 'staff');
  const isAdminEmail = userRole === 'admin';

  if (!isLoggedInAdmin && !isAdminEmail) {
    // Non-admin user trying to reset their own password without admin session
    throw {
      status: 403,
      message: 'Password resets are managed by the administrator. Please contact your admin to get a reset link.'
    };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  await saveResetToken(user.id, token, expiry);

  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const resetUrl = `${protocol}://${host}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

  console.log(`\n🔑 [PASSWORD RESET LINK FOR ${user.username}]: ${resetUrl}\n`);

  let emailSent = false;
  if (transporter) {
    const mailOptions = {
      from: `"InvoiceGST Support" <${smtpFrom}>`,
      to: user.email,
      subject: 'Reset your InvoiceGST Password',
      html: `
        <div style="font-family: 'Inter', sans-serif; background: #0f172a; color: #f1f5f9; padding: 2.5rem 2rem; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid rgba(148, 163, 184, 0.1);">
          <h2 style="color: #38bdf8; margin-bottom: 1.5rem; text-align: center;">Reset your Password</h2>
          <p>Hi ${user.display_name || user.username},</p>
          <p>We received a request to reset the password for your InvoiceGST account. Click the button below to set a new password. This link is valid for 15 minutes.</p>
          <div style="text-align: center; margin: 2rem 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); color: white; text-decoration: none; padding: 0.85rem 2rem; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 16px rgba(99,102,241,0.3);">Reset Password</a>
          </div>
          <p style="font-size: 0.8rem; color: #64748b;">If you did not request this, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid rgba(148, 163, 184, 0.1); margin: 2rem 0;" />
          <p style="font-size: 0.75rem; color: #64748b; text-align: center;">InvoiceGST Professional Billing System</p>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);
    emailSent = true;
  }

  return NextResponse.json({
    success: true,
    message: emailSent
      ? 'A password reset link has been sent to your registered email address.'
      : 'Password reset link generated. (Check server logs in development)',
    debugUrl: transporter ? null : resetUrl
  });
});

