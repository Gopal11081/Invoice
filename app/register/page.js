import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/session';
import RegisterClient from './RegisterClient';

export default async function RegisterPage() {
  const session = await getSession();
  if (session && session.userId) {
    redirect('/dashboard');
  }

  return <RegisterClient />;
}

