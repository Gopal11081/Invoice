import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { getCustomers, addCustomer } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { CustomerSchema } from '@/lib/server/schemas';

export const GET = withErrorHandler('app/api/customers/route.js (GET)', async () => {
  const auth = await verifyAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const customers = await getCustomers();
  return NextResponse.json(customers);
});

export const POST = withErrorHandler('app/api/customers/route.js (POST)', async (request) => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const validatedData = await validateBody(request, CustomerSchema);
  const customer = await addCustomer(validatedData);
  return NextResponse.json(customer, { status: 201 });
});

