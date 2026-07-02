import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { getBusinessConfig, updateBusinessConfig } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { BusinessConfigSchema } from '@/lib/server/schemas';

export const GET = withErrorHandler('app/api/business/route.js (GET)', async () => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const config = await getBusinessConfig();
  return NextResponse.json(config);
});

export const PUT = withErrorHandler('app/api/business/route.js (PUT)', async (request) => {
  const auth = await verifyAuth(['admin']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const validatedData = await validateBody(request, BusinessConfigSchema);
  await updateBusinessConfig(validatedData);
  return NextResponse.json({ success: true });
});

