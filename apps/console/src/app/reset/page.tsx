import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { t } from '@/lib/i18n';
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
  return (
    <main className="wrap">
      <h1 className="brand">{t('app_name')}</h1>
      <p className="tag">{t('reset_title')}</p>
      <form action={setPassword}>
        <label htmlFor="password">{t('new_password')}</label>
        <PasswordInput id="password" name="password" required minLength={8} autoComplete="new-password" />
        <button type="submit">{t('reset_save')}</button>
        {sp.e ? <p className="err">{sp.e}</p> : null}
      </form>
    </main>
  );
}
