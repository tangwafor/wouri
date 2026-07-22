# Component: Tenant onboarding (events)

Traces to ADR-0028. Onboarding events are org-scoped audit/spine events, NOT lot_events (those are physical custody, ADR-0003). They feed the registry-audit stream (ADR-0006) and the onboarding projection. No em-dashes.

## Event stream
Onboarding emits to the general append-only org event stream (client can INSERT, never UPDATE or DELETE; server stamps actor and sequence). Each event carries organization_id, actor_person_id, occurred_at, created_at, payload jsonb, and channel (click|chat|concierge).

## Events
| Event | When | Payload | Effect |
|---|---|---|---|
| `org.created` | a tenant starts (either path) | legal_name, locale, channel | creates organizations(status=draft), first membership(owner) |
| `onboarding.session_started` | wizard or chat opens | channel, locale | creates onboarding_sessions |
| `onboarding.answers_captured` | wizard answered / chat parsed | the four answers + notes | updates session.answers; suggests capabilities |
| `capability.enabled` / `capability.disabled` | picker toggle or chat inference | capability_key | writes organization_capabilities; widens/narrows scope and surface |
| `org.vertical_set` | derived from capabilities | vertical | sets organizations.vertical (text, no enum, ADR-0002) |
| `member.invited` | invite sent | email_or_phone, role_key | creates invitations(token) |
| `member.joined` | invite accepted | invite_token | idempotent on token; creates membership + role_assignment |
| `party.linked` | reuse a known party under consent | party_id, consent_scope | creates party_link_consents; adds to the bench |
| `party.created` | a new counterparty | kind, display_name | creates parties + party_roles |
| `plot.reused` | reuse a mapped plot under consent | origin_unit_id, holder_party_id | creates plot_source_consents; checks yield-cap capacity |
| `identity.verification_submitted` | RCCM/NIU/registration uploaded | kind, reference, document_id | creates identity_verifications(submitted) |
| `identity.verification_reviewed` | platform/verifier decision | status | advances verification_level on accept |
| `eudr.assessment_run` | the front-door screen | origin_unit_id, dataset_key+version, result | records a screen result; NOT a compliance assertion |
| `onboarding.first_consignment_started` | guided first shipment begins | consignment_id | links session.first_consignment_id |
| `onboarding.completed` | first proof reached | first_document_id or first_discrepancy_id | sets organizations.status=active, session.completed_at |

## Rules
- **Idempotency:** client-minted event ids; `member.joined` collapses on invite_token; replays are safe (ADR-0003 discipline).
- **No compliance assertion in an event.** `eudr.assessment_run` records a screen result with its dataset version; it never emits "compliant" (ADR-0023, CLAUDE law 7 and the voice rule).
- **verification_level changes only via `identity.verification_reviewed`.** The client cannot emit a level change directly.
- **Projections:** `onboarding_progress` (percent-complete, next step, blocking gaps) and the tenant's initial `consignment_readiness` are Layer 3, rebuildable from these events.
- **Aza actions are events too.** When Aza creates the tenant from a conversation, it emits the same `org.created`, `capability.enabled`, `party.created` events under the requesting user's identity (ADR-0023), so the click and chat paths produce an identical, auditable event history (chat-or-click parity).
