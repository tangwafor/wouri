# Verification

**Wouri** · What a certificate is, and how anyone checks it. No em-dashes.

Who: everyone, and your buyers and the authorities. Time: 5 minutes.

## The idea

Every document Wouri issues is a **verifiable credential**. It carries a
cryptographic signature (Ed25519). Anyone can confirm it is genuine and unaltered
using only the public Wouri key, offline, without an account and without calling
our servers. This is proof, not trust.

## How to verify a document

1. Open the verification page: `wouri.co/v/{code}`, or scan the **QR** on the
   document, or press **View** from the consignment.
2. The page shows a verdict at once:
   - **Authentic** - the signature is valid and the document is unaltered.
   - **Revoked** - the document was withdrawn and must not be relied on.
   - **Altered** - the signature does not match; someone changed it.
   - **Not found** - no document matches this code.

## What the certificate shows

- Your exporter identity at the top (name, colour, tagline).
- The document type and all its fields.
- An **electronic signature** block: signed by Wouri, with Ed25519, the **issued
  date**, the **place of issue**, and the verification code.
- A **QR** to re-verify, and a **Print** button for a clean paper copy.

## Why offline matters

A customs officer at an EU port, or a buyer with a printed copy, can verify the
document even with no connection to Wouri. The proof travels with the document. If
Wouri were offline, or gone, the certificate would still verify against the
published key.

## Tips

- Revocation is honest: a revoked document still opens, but it reads **Revoked**
  with the reason and date.
- The printed copy keeps the QR, so paper stays verifiable.

Next: [Settlement and money](settlement-money.md).
