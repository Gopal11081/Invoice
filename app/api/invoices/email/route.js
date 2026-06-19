import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { sendInvoiceEmail } from '@/lib/server/mailer';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { z } from 'zod';

export const POST = withErrorHandler('app/api/invoices/email/route.js (POST)', async (request) => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const validatedData = await validateBody(request, z.object({
    id: z.coerce.number(),
    isUpdate: z.boolean().optional()
  }));
  const { id, isUpdate } = validatedData;

  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const origin = `${protocol}://${host}`;

  // Await the email send so the serverless execution context is held open until complete
  await sendInvoiceEmail(id, origin, !!isUpdate);
  return NextResponse.json({ success: true });
});

