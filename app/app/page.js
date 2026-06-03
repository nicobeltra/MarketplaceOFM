import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from './AppShell';

export default async function AppLayout() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <AppShell userEmail={user.email} />;
}
