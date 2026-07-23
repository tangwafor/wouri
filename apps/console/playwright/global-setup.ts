import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Seed (idempotently) a signed-in test user with an org, so the authed render sweep
// has real pages to load. Writes the credentials for the spec to read. The service
// role comes from the repo-root .env.local; the console never holds it. No em-dashes.
export default async function globalSetup() {
  config({ path: resolve(__dirname, '../../../.env.local') }); // repo root: service role + db url
  config({ path: resolve(__dirname, '../.env.local') });        // console: url + anon
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const EMAIL = 'uitest@wouri.test', PW = 'WouriTest2026!';
  if (!URL || !ANON || !SVC) throw new Error('global-setup: missing Supabase env');

  const admin = createClient(URL, SVC, { auth: { persistSession: false } });
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (!list.users.find((u) => u.email === EMAIL)) {
    await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  }
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  await anon.auth.signInWithPassword({ email: EMAIL, password: PW });
  const { data: orgs } = await anon.from('organizations').select('id').limit(1);
  if (!orgs || orgs.length === 0) {
    await anon.rpc('create_organization', { p_org_name: 'UI Smoke', p_org_slug: 'ui-smoke', p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' });
  }
  writeFileSync(resolve(__dirname, '.auth.json'), JSON.stringify({ email: EMAIL, password: PW }));
}
