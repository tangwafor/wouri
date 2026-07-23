// The owner-editable Aza knowledge base. A platform admin edits KB content live,
// with no code deploy (ADR-0032); everyone else sees it read-only. Editing is
// gated by is_platform_admin() at the RLS layer, so the read-only view is not
// just a UI courtesy: a non-admin save is refused by the database. No em-dashes.
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { KbAdmin } from './KbAdmin';

export const dynamic = 'force-dynamic';

export default async function KbAdminPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_platform_admin');
  const { data: entries } = await supabase
    .from('aza_kb')
    .select('key, kind, label_en, label_fr, body_en, body_fr, source, review_by, updated_at')
    .order('kind')
    .order('key');

  return (
    <main className="wrap-wide">
      <h1 className="brand">Aza knowledge base</h1>
      <p className="tag">
        {isAdmin
          ? 'You are a platform admin. Edits here are live for every tenant.'
          : 'Read only. Ask a platform admin to edit. The bundled copy is the offline floor.'}
      </p>
      <KbAdmin entries={entries ?? []} isAdmin={!!isAdmin} />
    </main>
  );
}
