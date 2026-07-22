import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export default async function Index() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? '/home' : '/login');
}
