import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { t } from '@/lib/i18n';
import { CapabilityPicker } from './CapabilityPicker';

async function signout() {
  'use server';
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function Home() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: orgs } = await supabase.from('organizations').select('id, slug, legal_name, status');
  const org = orgs?.[0];
  if (!org) redirect('/signup');

  const { data: catalog } = await supabase
    .from('capability_catalog')
    .select('capability_key, label_fr, label_en, category, requires_capability_key')
    .order('category');
  const { data: enabledRows } = await supabase
    .from('organization_capabilities')
    .select('capability_key');
  const enabled = new Set((enabledRows ?? []).map((r) => r.capability_key));

  return (
    <main className="wrap-wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 className="brand">{t('app_name')}</h1>
        <form action={signout}><button className="ghost" type="submit">{t('signout')}</button></form>
      </div>
      <div className="card">
        <div style={{ fontSize: '.8rem', color: 'var(--ink-3)' }}>{t('your_org')}</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 650 }}>{org.legal_name ?? org.slug}</div>
        <div style={{ color: 'var(--ink-3)', fontSize: '.85rem' }}>{org.slug} &middot; {org.status}</div>
      </div>
      <div className="card">
        <h2 style={{ margin: '0 0 2px', fontSize: '1.05rem' }}>{t('capabilities')}</h2>
        <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '.9rem' }}>{t('cap_hint')}</p>
        <CapabilityPicker
          orgId={org.id}
          catalog={catalog ?? []}
          initiallyEnabled={Array.from(enabled)}
        />
      </div>
    </main>
  );
}
