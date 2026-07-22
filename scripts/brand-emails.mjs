#!/usr/bin/env node
// brand-emails.mjs: set Wouri-branded auth email templates (confirmation, recovery,
// magic link, invite) + the site url + redirect allow list on the project, via the
// Supabase Management API. The management token is read from a fleet env file and is
// never printed. No em-dashes. Run: node scripts/brand-emails.mjs
import { readFileSync } from 'node:fs';

const REF = process.env.SUPABASE_PROJECT_REF || 'iledioojfggozfzebafs';
const SITE = process.env.SITE_URL || 'http://localhost:3400';

function token() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  for (const p of ['../../akongne/apps/admin/.env.local', '../../akongne/.env.local']) {
    try {
      const line = readFileSync(new URL(p, import.meta.url), 'utf8')
        .split('\n').find((l) => l.startsWith('SUPABASE_ACCESS_TOKEN='));
      if (line) return line.slice('SUPABASE_ACCESS_TOKEN='.length).replace(/["'\r]/g, '');
    } catch { /* try next */ }
  }
  throw new Error('No SUPABASE_ACCESS_TOKEN found');
}

// One branded shell; the link variable is {{ .ConfirmationURL }} for every type.
const shell = (heading, body, cta) => `
<div style="font-family:Georgia,'Times New Roman',serif;max-width:480px;margin:0 auto;color:#15130e;background:#f6f4ee;padding:32px 26px;border-radius:12px;">
  <div style="border-top:3px solid #0d4f47;padding-top:16px;">
    <div style="font-size:22px;font-weight:700;color:#0d4f47;letter-spacing:-.01em;">Wouri</div>
    <p style="color:#443f34;font-size:13px;margin:2px 0 22px;">The trust and credit layer for African commodity export.</p>
    <h1 style="font-size:18px;margin:0 0 8px;">${heading}</h1>
    <p style="color:#443f34;font-size:15px;line-height:1.5;">${body}</p>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;margin-top:16px;background:#0d4f47;color:#f6f4ee;text-decoration:none;padding:11px 22px;border-radius:8px;font-family:system-ui,sans-serif;font-weight:650;">${cta}</a>
    <p style="color:#7c7566;font-size:12px;margin-top:22px;">If you did not request this, you can ignore this email.</p>
    <p style="color:#7c7566;font-size:11px;margin-top:14px;border-top:1px solid #e0dccf;padding-top:12px;">Wouri Verified &middot; wouri.co</p>
  </div>
</div>`.trim();

const payload = {
  site_url: SITE,
  uri_allow_list: `${SITE},http://localhost:3400,https://wouri.co,https://*.wouri.co`,
  mailer_subjects_confirmation: 'Confirm your Wouri email',
  mailer_templates_confirmation_content: shell('Confirm your email',
    'Confirm your email to activate your Wouri account.', 'Confirm email'),
  mailer_subjects_recovery: 'Reset your Wouri password',
  mailer_templates_recovery_content: shell('Reset your password',
    'Use the link below to choose a new password.', 'Reset password'),
  mailer_subjects_magic_link: 'Your Wouri sign-in link',
  mailer_templates_magic_link_content: shell('Your sign-in link',
    'Use the link below to sign in to Wouri.', 'Sign in'),
  mailer_subjects_invite: 'You are invited to a Wouri workspace',
  mailer_templates_invite_content: shell('You have been invited',
    'You have been invited to join a workspace on Wouri.', 'Accept invitation'),
};

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
console.log('brand-emails: http', res.status, res.ok ? 'OK' : await res.text());
process.exit(res.ok ? 0 : 1);
