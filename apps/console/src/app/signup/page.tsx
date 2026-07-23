import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { t } from '@/lib/i18n';
import { PasswordInput } from '../PasswordInput';

// Account only. The workspace (org + capabilities) is created next, on
// /onboarding: describe the business and Aza sets it up (ADR-0028), or type a
// name and pick capabilities by hand. Splitting the two keeps the chat door open
// for a brand-new user, who has no session until this step completes.
async function signup(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) redirect('/signup?e=' + encodeURIComponent(error.message));
  // Email confirmation on: no session yet. Send them to confirm, then sign in.
  if (!data.session) redirect('/login?confirm=1');
  redirect('/onboarding');
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="wrap">
      <h1 className="brand">{t('app_name')}</h1>
      <p className="tag">{t('tagline')}</p>
      <form action={signup}>
        <label htmlFor="email">{t('email')}</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="password">{t('password')}</label>
        <PasswordInput id="password" name="password" required minLength={8} autoComplete="new-password" />
        <button type="submit">{t('signup')}</button>
        {sp.e ? <p className="err">{sp.e}</p> : null}
      </form>
      <p className="muted">{t('have_account')} ? <Link href="/login">{t('login')}</Link></p>
    </main>
  );
}
