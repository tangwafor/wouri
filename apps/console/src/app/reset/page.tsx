import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/locale';
import { PasswordInput } from '../PasswordInput';

async function setPassword(formData: FormData) {
  'use server';
  const password = String(formData.get('password') ?? '');
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?e=' + encodeURIComponent('Reset link expired. Request a new one.'));
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect('/reset?e=' + encodeURIComponent(error.message));
  redirect('/home');
}

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?e=' + encodeURIComponent('Open the reset link from your email first.'));
  const { tt } = await getT();
  return (
    <main className="wrap">
      <h1 className="brand">{tt('app_name')}</h1>
      <p className="tag">{tt('reset_title')}</p>
      <form action={setPassword}>
        <label htmlFor="password">{tt('new_password')}</label>
        <PasswordInput id="password" name="password" required minLength={8} autoComplete="new-password" />
        <button type="submit">{tt('reset_save')}</button>
        {sp.e ? <p className="err">{sp.e}</p> : null}
      </form>
    </main>
  );
}
