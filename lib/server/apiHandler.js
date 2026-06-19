import 'server-only';
import { NextResponse } from 'next/server';
import { logErrorToDb } from '@/lib/server/db';

/**
 * Wraps a Next.js API route handler with standardized error handling.
 * Eliminates the duplicated try/catch + logErrorToDb pattern across all routes.
 *
 * @param {string} routeSource - Human-readable route identifier for error logs.
 * @param {Function} handler - The async route handler function.
 * @returns {Function} Wrapped handler with error handling.
 *
 * @example
 * export const POST = withErrorHandler('api/invoices', async (request) => {
 *   const body = await request.json();
 *   const result = await saveInvoice(body);
 *   return NextResponse.json(result, { status: 201 });
 * });
 */
export function withErrorHandler(routeSource, handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      const status = err.status || 500;
      const message = err.message || String(err);
      if (status >= 500) {
        console.error(`[API Error] ${routeSource}:`, message, err.stack);
        await logErrorToDb(routeSource, message, err.stack || '');
      }
      return NextResponse.json({ error: message }, { status });
    }
  };
}

/**
 * Helper to parse and validate request body with Zod.
 * Throws a formatted error with 400 status on failure.
 */
export async function validateBody(request, schema) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    throw { status: 400, message: 'Invalid JSON body' };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.errors
      .map(e => `${e.path.join('.') || 'body'}: ${e.message}`)
      .join(', ');
    throw { status: 400, message: errorMsg };
  }
  return parsed.data;
}

