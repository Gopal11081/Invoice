import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/session';
import { getCustomerById, updateCustomer, deleteCustomer } from '@/lib/server/db';
import { withErrorHandler, validateBody } from '@/lib/server/apiHandler';
import { CustomerSchema } from '@/lib/server/schemas';

export const GET = withErrorHandler('app/api/customers/[id]/route.js (GET)', async (request, { params }) => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = parseInt(params.id);
  const customer = await getCustomerById(id);
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }
  return NextResponse.json(customer);
});

export const PUT = withErrorHandler('app/api/customers/[id]/route.js (PUT)', async (request, { params }) => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = parseInt(params.id);
  const validatedData = await validateBody(request, CustomerSchema);
  await updateCustomer(id, validatedData);
  return NextResponse.json({ success: true });
});

export const DELETE = withErrorHandler('app/api/customers/[id]/route.js (DELETE)', async (request, { params }) => {
  const auth = await verifyAuth(['admin', 'staff']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = parseInt(params.id);
  await deleteCustomer(id);
  return NextResponse.json({ success: true });
});

