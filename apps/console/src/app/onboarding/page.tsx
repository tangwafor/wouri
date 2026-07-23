import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/locale';
import { OnboardingChat } from './OnboardingChat';

// The chat door to tenant creation. Authed user, no org yet: describe the
// business, Aza provisions it. If they already have an org, there is nothing to
// onboard, so send them home.
export default async function OnboardingPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
  if (orgs?.length) redirect('/home');

  const { data: catalog } = await supabase
    .from('capability_catalog')
    .select('capability_key, label_fr, label_en')
    .order('category');
  const { locale, tt } = await getT();

  return (
    <main className="wrap-wide">
      <h1 className="brand">{tt('app_name')}</h1>
      <p className="tag">{tt('onboarding_hint')}</p>
      <OnboardingChat catalog={catalog ?? []} locale={locale} />
    </main>
  );
}
