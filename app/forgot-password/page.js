import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/session';
import ForgotPasswordClient from './ForgotPasswordClient';

export default async function ForgotPasswordPage() {
  const session = await getSession();
  if (session && session.userId) {
    redirect('/dashboard');
  }

  return <ForgotPasswordClient />;
}

