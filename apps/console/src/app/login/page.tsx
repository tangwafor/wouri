import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { t } from '@/lib/i18n';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3400';

async function login(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/login?e=' + encodeURIComponent(error.message));
  redirect('/home');
}

async function magicLink(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '');
  const supabase = await supabaseServer();
  await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${SITE}/auth/callback` } });
  redirect('/login?magic=1');
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string; magic?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="wrap">
      <h1 className="brand">{t('app_name')}</h1>
      <p className="tag">{t('tagline')}</p>
      {sp.magic ? <p className="muted">{t('magic_sent')}</p> : null}
      <form action={login}>
        <label htmlFor="email">{t('email')}</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="password">{t('password')}</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" />
        <button type="submit">{t('login')}</button>
        <button type="submit" className="ghost" formAction={magicLink} style={{ marginLeft: 10 }}>{t('magic_link')}</button>
        {sp.e ? <p className="err">{sp.e}</p> : null}
      </form>
      <p className="muted">
        <Link href="/forgot">{t('forgot_password')}</Link>
        {' · '}
        {t('no_account')} ? <Link href="/signup">{t('signup')}</Link>
      </p>
    </main>
  );
}
