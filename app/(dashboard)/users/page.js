import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/session';
import AdminUsersClient from './AdminUsersClient';

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session || !session.userId) {
    redirect('/login');
  }

  if (session.role !== 'admin') {
    redirect('/dashboard');
  }

  return <AdminUsersClient currentUserId={session.userId} />;
}

