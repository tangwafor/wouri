import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { t } from '@/lib/i18n';

async function signup(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const orgName = String(formData.get('org_name') ?? '');
  const orgSlug = String(formData.get('org_slug') ?? '').toLowerCase().trim();
  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) redirect('/signup?e=' + encodeURIComponent(error.message));
  if (!data.session) redirect('/signup?e=' + encodeURIComponent('Check your email to confirm, then sign in.'));

  // Atomic org creation (the PulSe pattern, ADR-0029), under the new user session.
  const { error: rpcErr } = await supabase.rpc('create_organization', {
    p_org_name: orgName, p_org_slug: orgSlug, p_first_location_name: 'Siege', p_country: 'CM', p_locale: 'fr',
  });
  if (rpcErr) redirect('/signup?e=' + encodeURIComponent(rpcErr.message));
  redirect('/home');
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
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        <label htmlFor="org_name">{t('org_name')}</label>
        <input id="org_name" name="org_name" type="text" required />
        <label htmlFor="org_slug">{t('org_slug')}</label>
        <input id="org_slug" name="org_slug" type="text" required pattern="[a-z0-9-]+" />
        <button type="submit">{t('create_org')}</button>
        {sp.e ? <p className="err">{sp.e}</p> : null}
      </form>
      <p className="muted">{t('have_account')} ? <Link href="/login">{t('login')}</Link></p>
    </main>
  );
}
