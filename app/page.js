import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/session';

export default async function RootPage() {
  const session = await getSession();
  if (session && session.userId) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
