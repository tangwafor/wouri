# Consignments and documents

**Wouri** · Build a shipment and issue its export documents. No em-dashes.

Who: export manager, documentation officer. Time: 10 minutes.

## What a consignment is

A **consignment** is a shipment: the lots you are sending to one buyer. It is where
allocation, documents, and settlement come together.

## Create a consignment

1. Open **Consignments** and fill the form: a code, the buyer name, and the
   destination country.
2. Press **Create consignment**. It appears in the list. Click it to open its
   detail page.

## Allocate lots

On the detail page, **Allocate lots** shows the lots you can add. Pick one and
press **Allocate**. The lot joins the consignment and carries its weight with it,
so the consignment weight is correct. Allocate as many lots as the shipment holds.

## Issue documents

The **Documents** panel lists the Cameroon export set:

- **EUR.1 movement certificate** - preferential origin for the EU.
- **Phytosanitary certificate (reference)**.
- **Verified gross mass (VGM)**.
- **Quality certificate** - needs the lot quality values first.

Press **Issue** on any one. Wouri does two checks before it signs:

- **Unbound blocks issuance.** If a required field has no value (for example the
  quality certificate with no moisture recorded), issuance is refused and tells
  you what is missing. Fill it and try again.
- **Weight consistency.** If a declared weight does not match the consignment, it
  is refused.

When it passes, the document is signed and gets a **verification code**. Press
**View** to open the certificate. Share the code, the link, or the printed QR with
your buyer or the authority.

Issuance is **reproducible**: the same inputs always produce the same document, so
you never get two different EUR.1s for one shipment.

## Your identity on the document

The certificate leads with **your** brand, your name, colour, and tagline (set on
the home page under Document branding). Wouri is the registry that signs and
verifies it, its seal sits in the signature block. The document is yours; the trust
is Wouri's.

## Tips

- Allocate lots before issuing, so the weight is right.
- For the quality certificate, record moisture and bean count on the lot first
  (see the lots guide).

Next: [Verification](verification.md).
