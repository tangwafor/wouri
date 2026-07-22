# Component: Capabilities (ui)

Traces to ADR-0028. French first, phone-capable, institutional brand. No em-dashes.

## The picker
Large toggles grouped by category (what you export, which rails, how you work, money), each with a French label and a one-line plain description. Enabling timber offers the CITES rail inline; enabling an EUDR commodity with an EU destination suggests the EUDR rail. Prerequisites auto-enable with a quiet note ("CITES needs timber, so timber was turned on"). Reversible; disabling hides a surface, never deletes data.

## Where it appears
- Inside onboarding (the click path), pre-selected by the wizard answers.
- In settings, so a tenant adds a rail or a module later, self-serve, with no code change.
- Never anywhere else: unused capabilities appear only in the picker, so the rest of the app stays minimal.

## Gating in the rest of the app
Every screen and control is wrapped so it renders only when its capability is on. A cocoa-only tenant sees no CITES tab, no field-capture screen, no species field. The nav, the document set, and the readiness board all reflect the enabled set. This is the mechanism behind "a tenant sees only what it does."

## Rules
- Plain language, no jargon; a non-technical owner understands each toggle in French on a phone.
- Never reassure without evidence; a disabled rail says plainly what turning it on would add.
- Changing capabilities takes effect immediately across the tenant's surface.
