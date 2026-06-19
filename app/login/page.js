import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/session';
import LoginClient from './LoginClient';

export default async function LoginPage() {
  const session = await getSession();
  if (session && session.userId) {
    redirect('/dashboard');
  }

  return <LoginClient />;
}

