import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';

export async function GET() {
  const session = await getSession();
  if (session && session.userId) {
    return NextResponse.json({
      authenticated: true,
      user: { id: session.userId, username: session.username, display_name: session.displayName, role: session.role }
    });
  }
  return NextResponse.json({ authenticated: false });
}
