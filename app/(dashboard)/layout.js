import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/session';
import DashboardLayoutClient from './DashboardLayoutClient';

export default async function DashboardLayout({ children }) {
  const session = await getSession();
  if (!session || !session.userId) {
    redirect('/login');
  }

  return (
    <DashboardLayoutClient currentUser={session}>
      {children}
    </DashboardLayoutClient>
  );
}
