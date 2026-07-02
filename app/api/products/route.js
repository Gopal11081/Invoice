import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { getProducts, addProduct } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { ProductSchema } from '@/lib/server/schemas';

export const GET = withErrorHandler('app/api/products/route.js (GET)', async () => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const products = await getProducts();
  return NextResponse.json(products);
});

export const POST = withErrorHandler('app/api/products/route.js (POST)', async (request) => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const validatedData = await validateBody(request, ProductSchema);
  const product = await addProduct(validatedData);
  return NextResponse.json(product, { status: 201 });
});

