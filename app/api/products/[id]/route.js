import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { updateProduct, deleteProduct } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { ProductSchema } from '@/lib/server/schemas';

export const PUT = withErrorHandler('app/api/products/[id]/route.js (PUT)', async (request, { params }) => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = parseInt(params.id);
  const validatedData = await validateBody(request, ProductSchema);
  await updateProduct(id, validatedData);
  return NextResponse.json({ success: true });
});

export const DELETE = withErrorHandler('app/api/products/[id]/route.js (DELETE)', async (request, { params }) => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = parseInt(params.id);
  await deleteProduct(id);
  return NextResponse.json({ success: true });
});

