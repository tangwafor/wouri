#!/usr/bin/env node
// init-proof-keys: generate the Ed25519 signing keypair for the proof layer and
// store it in wouri_secrets (private key server-only; public key exposed to anyone
// for offline verification). Idempotent: if the keys already exist it leaves them.
// The private key never leaves the server; the public key is what a third party
// uses to verify a document without ever contacting Wouri. No em-dashes.
// Run: node scripts/init-proof-keys.mjs
import { config } from 'dotenv';
import { generateKeyPairSync } from 'node:crypto';
import pg from 'pg';

config({ path: '.env.local' });
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });

await client.connect();
const existing = await client.query("select 1 from wouri_secrets where key_name = 'proof_private_pem'");
if (existing.rowCount) {
  console.log('init-proof-keys: keys already present, leaving them.');
} else {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  await client.query('begin');
  await client.query("insert into wouri_secrets (key_name, secret) values ('proof_private_pem', $1)", [privateKey]);
  await client.query("insert into wouri_secrets (key_name, secret) values ('proof_public_pem', $1)", [publicKey]);
  await client.query('commit');
  console.log('init-proof-keys: generated and stored the Ed25519 proof keypair.');
}
await client.end();
