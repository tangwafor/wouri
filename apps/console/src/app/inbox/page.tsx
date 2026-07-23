// The alerts inbox: everything the registry reacted to (a document issued, a
// discrepancy raised, a settlement repatriated, a shipment moved, an auto-check
// finding), newest first, with a real-time badge on the nav. No em-dashes.
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/locale';
import { AppNav } from '../AppNav';
import { InboxList } from './InboxList';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
  if (!orgs?.[0]) redirect('/onboarding');

  const { locale, tt } = await getT();
  const { data: items } = await supabase
    .from('notifications')
    .select('id, kind, severity, title, body, entity_type, entity_id, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <main className="wrap-wide">
      <AppNav current="/inbox" locale={locale} />
      <h1 className="brand" style={{ marginBottom: 2 }}>{tt('inbox_h')}</h1>
      <InboxList items={items ?? []} locale={locale} />
    </main>
  );
}
