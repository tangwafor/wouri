# Fabrice UAT: the whole app (source to settlement)

**Wouri** · The human walk for the full product. No em-dashes.

You are testing that a real person can run an export from the plot to the payment:
create a workspace, record lots and quality, build a consignment, issue and verify
documents, and settle the money. Follow each step, compare to "Expected", and mark
Pass or Fail. If it fails, write one line of what you saw.

Each part matches a training guide (`docs/training/`), so read the guide, then run
the part. The machine already checks the invisible half (hashes, RLS, the exact
capability set, the settlement rules) in the self-test suite; your job is the half
a machine cannot see, that a person can walk it and it feels right.

## Before you start

- You have the staging URL and can open your email.
- Work in **EN** (top-right toggle) and turn off any browser auto-translate.
- Use a throwaway email. Note anything that surprises you.

## Part 1: Getting started (guide: getting-started)

| # | Do | Expected | P/F |
|---|---|---|---|
| 1 | Open `/signup`, enter email + an 8-char password, submit | Told to confirm, or signed straight in. The eye toggles the password. | |
| 2 | On setup, type a workspace name and "We export cocoa from Bakossi and need the EUDR file"; watch the panel | As you type, Aza shows it will switch on Cocoa, EUDR rail, Settlement, and lists the documents you will need. No button pressed. | |
| 3 | Press **Set up my workspace** | You land on the dashboard with your company name. | |
| 4 | Read the dashboard | KPI cards (consignments, lots, documents, needs attention), a needs-attention panel, a repatriation card, quick actions. | |
| 5 | Click **FR**, then **EN** | The whole page switches language and back. Labels are clean, not machine-translated. | |

## Part 2: Branding (guide: branding-kb)

| # | Do | Expected | P/F |
|---|---|---|---|
| 6 | On Home, in **Document branding**, pick a colour and a tagline, press save | Shows **Saved**. | |

## Part 3: Lots, harvest, quality (guide: lots-harvest-quality)

| # | Do | Expected | P/F |
|---|---|---|---|
| 7 | Open **Lots**. With **At harvest**, create a cocoa lot: code, quantity 1000, plot code, area, and a GeoJSON polygon | The lot is created and appears in the list, no origin-gap flag (it has geolocation). | |
| 8 | Create a second cocoa lot **At harvest** with NO polygon | Created, but shows **Missing geolocation (EUDR)**. It is flagged, not blocked. | |
| 9 | Switch to **Received after harvest**, create a coffee lot from a supplier name | Created; its mode reads received. | |
| 10 | Open the first lot | Custody timeline shows the harvest event; a **Chain intact** badge; a Quality section. | |
| 11 | In Quality, record moisture (e.g. 7.2) and bean count (e.g. 100), press Record on each | Each value shows, green if in range, red if out of range. | |

## Part 4: Consignments and documents (guides: consignments-documents, verification)

| # | Do | Expected | P/F |
|---|---|---|---|
| 12 | Open **Consignments**, create one (code, buyer, destination), open it | The detail page shows Allocate lots, Documents, Settlement. | |
| 13 | Allocate your first cocoa lot | It appears as allocated. | |
| 14 | Press **Issue** on the **Quality certificate** BEFORE any quality on this lot's consignment | If unbound, it refuses and names what is missing. (If you already recorded quality on the allocated lot, it issues.) | |
| 15 | Press **Issue** on **EUR.1 movement certificate** | It issues and shows a **View** link. | |
| 16 | Click **View** | A branded certificate: your name, colour, and tagline at the top; verdict **Authentic**; the fields; an **e-signature** block (Ed25519, issued date, place of issue Cameroon); a **QR**; a **Print** button. | |
| 17 | Open the same code in a private window (no login) | It still verifies as Authentic. Verification needs no account. | |

## Part 5: Settlement and the BEAC clock (guide: settlement-money)

| # | Do | Expected | P/F |
|---|---|---|---|
| 18 | On the consignment, open a settlement: instrument, amount, and an **export date a few months ago** | The instrument appears with a repatriation clock. If well past the window it reads **Overdue** in red. | |
| 19 | Try the steps out of order (there should be only one next button) | You can only advance in order: present, then accept, then pay, then repatriate. | |
| 20 | Advance to **repatriated** | Status reads repatriated; the clock is no longer overdue. | |

## Part 6: Cockpit, dashboard, board (guide: cockpit-dashboard-board)

| # | Do | Expected | P/F |
|---|---|---|---|
| 21 | Open **Cockpit** | Live XAF rates (EUR near 656, plus USD, GBP, CNY) and weather at Douala and the growing zones, each with a live or cached badge and time. | |
| 22 | Open **Readiness board** | Any real blockers appear, ranked, critical first (for example an overdue repatriation or an origin gap from step 8). | |
| 23 | Return to **Home** | The dashboard numbers match what you created; needs-attention reflects the board. | |

## When you are done

Count the Fails. Zero means the app passes the human gate. For each Fail, the one
line you wrote is enough to reproduce and fix. Re-test only the failed steps once
told they are fixed.

## What the machine already proves (so you do not have to)

The tamper-evident hash chain, RLS tenant isolation, the exact capability set from
a description, unbound-blocks-issuance, weight consistency, the settlement rules
and the BEAC window from registry data, the EUDR origin-gap logic, offline
signature verification, and the owner-editable knowledge base gate are all covered
by the self-test suite (run `npm test` and `npm run test:db`). Your walk is the
human layer above that.
