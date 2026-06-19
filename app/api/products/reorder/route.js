import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { reorderProducts } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { ProductReorderSchema } from '@/lib/server/schemas';
import { z } from 'zod';

export const PUT = withErrorHandler('app/api/products/reorder/route.js (PUT)', async (request) => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const validatedData = await validateBody(request, z.object({ order: ProductReorderSchema }));
  await reorderProducts(validatedData.order);
  return NextResponse.json({ success: true });
});

