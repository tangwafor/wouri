# Component: Identity and auth (ui)

Traces to ADR-0029. French first, phone-capable, institutional brand. No em-dashes.

## Screens (PulSe LoginForm / SignupForm shapes, Wouri brand)
- **Login.** Email or phone + password. A forgot-password link. Plain error messages that never reveal whether an account exists. After login, route to the person's primary org home (per persona, onboarding.md).
- **Sign up.** Two entries mirroring onboarding chat-or-click: create a new tenant (name + slug + first location + country) which calls `create_organization`, or accept an invitation (paste or follow the invite link) which calls `acceptInvite`. Slug availability is checked live with a plain "choose another" message.
- **Accept invite.** A one-screen join: shows the org name and the role you are being given, then a single confirm. Idempotent, so a double click is harmless.
- **Password reset.** Request by email; confirm by token. PulSe flow.
- **Team management** (owner/admin, inside the app): list members, invite, assign or revoke roles, edit a role's capabilities (roles are data), suspend or reactivate. Capability-gated so a manager sees the roster read-only.
- **Org switcher** for a person in several orgs (diaspora holdings): a plain menu in the header.

## Rules
- Every flow completes on a phone, in French, without training.
- Never reassure without evidence: errors say what went wrong and how to fix it, no vague "something happened."
- Keyboard focus is visible; the forms are usable with a screen reader.
- No auth screen shows another tenant's data. The invite screen shows only the inviting org name and the offered role.
