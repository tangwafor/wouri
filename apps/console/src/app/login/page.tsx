import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/locale';
import { PasswordInput } from '../PasswordInput';

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

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string; magic?: string; confirm?: string }> }) {
  const sp = await searchParams;
  const { tt } = await getT();
  return (
    <main className="wrap">
      <h1 className="brand">{tt('app_name')}</h1>
      <p className="tag">{tt('tagline')}</p>
      {sp.confirm ? <p className="muted">{tt('confirm_email')}</p> : null}
      {sp.magic ? <p className="muted">{tt('magic_sent')}</p> : null}
      <form action={login}>
        <label htmlFor="email">{tt('email')}</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="password">{tt('password')}</label>
        <PasswordInput id="password" name="password" required autoComplete="current-password" />
        <button type="submit">{tt('login')}</button>
        <button type="submit" className="ghost" formAction={magicLink} style={{ marginLeft: 10 }}>{tt('magic_link')}</button>
        {sp.e ? <p className="err">{sp.e}</p> : null}
      </form>
      <p className="muted">
        <Link href="/forgot">{tt('forgot_password')}</Link>
        {' · '}
        {tt('no_account')} ? <Link href="/signup">{tt('signup')}</Link>
      </p>
    </main>
  );
}
