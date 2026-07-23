import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/locale';

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
  const { tt } = await getT();
  return (
    <main className="wrap">
      <h1 className="brand">{tt('app_name')}</h1>
      <p className="tag">{tt('forgot_title')}</p>
      {sp.sent ? (
        <p className="muted">{tt('forgot_sent')}</p>
      ) : (
        <form action={requestReset}>
          <label htmlFor="email">{tt('email')}</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
          <button type="submit">{tt('forgot_send')}</button>
        </form>
      )}
      <p className="muted"><Link href="/login">{tt('login')}</Link></p>
    </main>
  );
}
