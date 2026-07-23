'use server';
import { supabaseServer } from '@/lib/supabase/server';
import { inferCapabilities } from '@/lib/onboarding/infer.mjs';

// Turn a company name into a URL-safe org slug. Same shape the click path asks
// the user to type by hand (pattern [a-z0-9-]+).
function slugify(name: string): string {
  return name.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'atelier';
}

// The chat path (ADR-0028): one call provisions the org AND the capabilities Aza
// inferred, so it lands identical to clicking each toggle. Atomic org creation is
// the create_organization RPC (ADR-0029); capabilities are written under the same
// user session, so RLS is the only gate.
export async function provisionWorkspace(
  name: string, description: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const orgName = name.trim();
  if (!orgName) return { ok: false, error: 'name-required' };
  const slug = slugify(orgName);
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'not-authenticated' };

  const { error: rpcErr } = await supabase.rpc('create_organization', {
    p_org_name: orgName, p_org_slug: slug, p_first_location_name: 'Siege', p_country: 'CM', p_locale: 'fr',
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  // The org the RPC just made for this user (RLS returns only their own).
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
  const orgId = orgs?.[0]?.id;
  if (!orgId) return { ok: false, error: 'org-not-found' };

  // Aza's inference is a convenience, never a gate: if it throws or is empty, the
  // org is still created and the tenant sets capabilities by hand on /home. Aza
  // being down must never block a tenant from getting a workspace (ADR-0031).
  let keys: string[] = [];
  try { keys = inferCapabilities(description).keys; } catch { keys = []; }
  if (keys.length) {
    const rows = keys.map((capability_key: string) => ({ organization_id: orgId, capability_key }));
    const { error: capErr } = await supabase
      .from('organization_capabilities')
      .upsert(rows, { onConflict: 'organization_id,capability_key' });
    if (capErr) return { ok: false, error: capErr.message };
  }
  return { ok: true };
}
