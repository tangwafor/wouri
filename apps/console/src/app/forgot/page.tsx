import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { t } from '@/lib/i18n';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3400';

async function requestReset(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '');
  const supabase = await supabaseServer();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE}/auth/callback?next=/reset` });
  // Always report the same thing, never reveal whether the account exists.
  redirect('/forgot?sent=1');
}

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="wrap">
      <h1 className="brand">{t('app_name')}</h1>
      <p className="tag">{t('forgot_title')}</p>
      {sp.sent ? (
        <p className="muted">{t('forgot_sent')}</p>
      ) : (
        <form action={requestReset}>
          <label htmlFor="email">{t('email')}</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
          <button type="submit">{t('forgot_send')}</button>
        </form>
      )}
      <p className="muted"><Link href="/login">{t('login')}</Link></p>
    </main>
  );
}
