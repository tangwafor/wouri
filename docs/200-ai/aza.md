# AI: Aza in Wouri

Traces to ADR-0023. No em-dashes.

## Scope (narrower than Bazah on purpose)
In Bazah, Aza builds a business from a conversation. In Wouri, Aza does four narrower things, plus one onboarding role:
1. Answers operational questions over the tenant's own data, under the tenant's own permissions ("which shipments are at risk this week", "what is blocking the Hamburg container", "how much did we pay for cocoa in Kumba last month").
2. Drafts, never issues (emails to buyers, instructions to brokers, answers to a buyer's compliance questionnaire). A human sends.
3. Explains a rule, with its citation and last-verified date, from the registry ("why does this need a fumigation certificate").
4. Finds the discrepancy across a document set and says which source is wrong.
Plus: **Aza builds the tenant during onboarding** from a conversation (the chat path, ADR-0028), calling the same primitives the picker calls, under the user's identity. This is the one place Aza does what it does in Bazah, and even here it sets up, it never asserts a compliance status.

## Hard limits (the difference between an assistant and a liability)
- Never asserts a compliance status. It reports what the system computed and links to the computation. It may not say "you are EUDR compliant." That claim belongs to the compliance pack, computed from evidence, or to nobody.
- Every answer cites the records it drew on, by human id, clickable.
- Never mutates without explicit confirmation, and never at all for anything that issues, submits, signs, or transitions state.
- Runs as the requesting user's identity, so RLS enforces the boundary mechanically and no service key is ever in the loop.
- Degrades to nothing gracefully. If the model is down, every path still works by clicking. AI is additive, never load-bearing.
- Says "I do not know" when the registry entry is marked unverified, and shows the citation gap rather than filling it.

## Grounding (two layers, following Bazah)
- Platform: the regulatory rules registry, retrieved keyword-first with semantic fallback, margin-gated. Rules are structured data, so most questions are answered by query, not by model. This is what makes Aza trustworthy here: it reads rows that carry citations and dates, it does not summarise regulations from training data.
- Tenant: the tenant's own documents, procedures, and history.

## Resilience
Every Aza surface has a click equivalent (chat-or-click parity). The model is never in the critical path of issuing a document, filing a DDS, or transitioning a consignment.
