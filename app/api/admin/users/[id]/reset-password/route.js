import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyAuth } from '@/lib/server/session';
import { getDb, saveResetToken } from '@/lib/server/db';
import { transporter, smtpFrom } from '@/lib/server/mailer';
import { withErrorHandler } from '@/lib/server/apiHandler';

export const POST = withErrorHandler('app/api/admin/users/[id]/reset-password/route.js (POST)', async (request, { params }) => {
  const auth = await verifyAuth(['admin']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = parseInt(params.id);
  const db = getDb();
  const userDoc = await db.collection('users').doc(userId.toString()).get();

  if (!userDoc.exists) {
    throw { status: 404, message: 'User not found' };
  }

  const user = userDoc.data();

  if (!user.email) {
    throw { status: 400, message: 'This user has no email address on file. Please add an email first.' };
  }

  // Generate secure token with 15-minute expiry
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await saveResetToken(userId, token, expiry);

  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const resetUrl = `${protocol}://${host}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

  console.log(`\n🔑 [ADMIN-INITIATED RESET FOR ${user.username}]: ${resetUrl}\n`);

  let emailSent = false;
  if (transporter) {
    const mailOptions = {
      from: `"InvoiceGST Support" <${smtpFrom}>`,
      to: user.email,
      subject: 'Password Reset — Initiated by Administrator',
      html: `
        <div style="font-family: 'Inter', sans-serif; background: #0f172a; color: #f1f5f9; padding: 2.5rem 2rem; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid rgba(148, 163, 184, 0.1);">
          <h2 style="color: #38bdf8; margin-bottom: 1.5rem; text-align: center;">Password Reset Request</h2>
          <p>Hi ${user.display_name || user.username},</p>
          <p>Your administrator has initiated a password reset for your InvoiceGST account. Click the button below to set a new password.</p>
          <div style="text-align: center; margin: 2rem 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); color: white; text-decoration: none; padding: 0.85rem 2rem; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 16px rgba(99,102,241,0.3);">Reset Password</a>
          </div>
          <p style="font-size: 0.85rem; color: #f59e0b; font-weight: 500;">⏱ This link expires in 15 minutes.</p>
          <p style="font-size: 0.8rem; color: #64748b;">If you did not expect this, please contact your administrator immediately.</p>
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
      ? `Password reset link sent to ${user.email}. It will expire in 15 minutes.`
      : `Reset link generated for ${user.username}. (Check server logs — SMTP not configured)`,
    debugUrl: transporter ? null : resetUrl
  });
});

