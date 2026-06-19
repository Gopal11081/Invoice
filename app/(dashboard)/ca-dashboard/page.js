import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/session';
import CaDashboardClient from './CaDashboardClient';

export default async function CaDashboardPage() {
  const session = await getSession();
  if (!session || !session.userId) {
    redirect('/login');
  }

  const isAuthorized = session.role === 'admin' || session.role === 'ca';
  if (!isAuthorized) {
    redirect('/dashboard');
  }

  return <CaDashboardClient />;
}

