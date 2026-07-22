# Fabrice UAT: Sprint 0 (Foundation)

The human walk for Sprint 0. You are testing that a person can create an account,
set up their workspace by describing their business or by picking, and that one
tenant can never see another tenant's data. This is the sprint whose headline is
"you see only your own org."

You do not need to know how it works. Follow each step, compare what you see to
"Expected", and mark Pass or Fail. If it fails, write one line of what you saw.
Submit each result into the live QA feed (the tester portal) so the build watches
and fixes in real time.

House rule for anyone editing this file: no em-dashes.

## Before you start

- You have two email addresses you can open (or two aliases of one inbox). Call
  them Tester A and Tester B.
- You have the staging URL. Every route below hangs off it, for example
  `STAGING/signup`.
- Emails arrive from Wouri. They are branded (deep green header, "Wouri Verified"
  footer). If an email looks unbranded or broken, that itself is a Fail on the
  email step.

## Part 1: Create an account (Tester A)

| # | Do this | Expected | Pass or Fail |
|---|---------|----------|--------------|
| 1 | Open `STAGING/signup` | A Wouri page asks only for email and password. It does NOT ask for a company name yet. | |
| 2 | Enter Tester A email and a password of 8+ characters, submit | You are told to confirm your email, then sign in. No error. | |
| 3 | Open the confirmation email | It is branded: green header, "Confirm your Wouri email", one button. No em-dashes anywhere. | |
| 4 | Click the confirm button | It opens Wouri and you end up signed in, on a page that asks about your business. | |

## Part 2: Set up the workspace by describing it (the chat door)

| # | Do this | Expected | Pass or Fail |
|---|---------|----------|--------------|
| 5 | You are on `STAGING/onboarding`. Type a workspace name, for example "Bakossi Cocoa Union" | The field accepts it. | |
| 6 | In the description box type: "We export cocoa from Bakossi and must prepare the EUDR file" | As you type, a row of tags appears under "We will switch on". It should show Cocoa and the EUDR rail. | |
| 7 | Add to the description: "and we need prefinancing" | The tags update live to also include Financing and Settlement. You did not press any button for this. | |
| 8 | Press "Set up my workspace" | You land on the home page. Your company name is shown. | |
| 9 | Look at the capabilities list on home | Cocoa, EUDR rail, Financing, and Settlement are marked Enabled. CITES is NOT enabled (you did not mention protected species). | |

Expected meaning: the workspace was created for you, and only the activities your
words implied were switched on. Nothing else.

## Part 3: The click door gives the same result (Tester B)

| # | Do this | Expected | Pass or Fail |
|---|---------|----------|--------------|
| 10 | Sign out. Open `STAGING/signup` and create Tester B, confirm the email, sign in | You reach `STAGING/onboarding`. | |
| 11 | Type a workspace name, for example "Douala Timber", and leave the description blank | The tags area says it will detect nothing yet. That is fine. | |
| 12 | Press "Set up my workspace" | You land on home with your company, and no capabilities enabled yet. | |
| 13 | On home, switch on Timber by hand | It turns Enabled. | |
| 14 | Switch on the CITES rail by hand | Timber is required first, so enabling CITES also enables Timber if it was not already. You never end up with CITES enabled without Timber. | |

## Part 4: You see only your own org (the Sprint 0 headline)

| # | Do this | Expected | Pass or Fail |
|---|---------|----------|--------------|
| 15 | Still signed in as Tester B, look at the company shown on home | It is Tester B's company only. There is no sign of Tester A's "Bakossi Cocoa Union". | |
| 16 | Sign out, sign back in as Tester A | Home shows Tester A's company only. Tester B's "Douala Timber" is nowhere. | |
| 17 | Try to open the app without signing in (open home in a private window) | You are sent to the login page. You cannot see any company or data. | |

Expected meaning: two tenants share the same app and never see each other. A
signed-out visitor sees nothing.

## Part 5: Getting back in

| # | Do this | Expected | Pass or Fail |
|---|---------|----------|--------------|
| 18 | Sign out. On login, use "Email me a magic link" with Tester A email | You are told a sign-in link is on its way. The email is branded. | |
| 19 | Click the magic link | You are signed in as Tester A, on your own home. | |
| 20 | Sign out. On login, click "Forgot password", enter Tester A email | You are told a reset email is on its way, if the account exists. The email is branded. | |
| 21 | Click the reset link, set a new password | You can set it and you land signed in. | |
| 22 | Sign out and sign in with the NEW password | It works. The old password no longer works. | |

## When you are done

Count the Fails. Zero Fails means Sprint 0 passes the human gate. For each Fail,
the one line you wrote is enough for the build to reproduce and fix. Re-test only
the steps that failed once you are told they are fixed.

The machine already checks the invisible half of this (RLS isolation, atomic
signup, the exact capability set) in `scripts/wouri-selftest.mjs`,
`scripts/verify-app-path.mjs`, and `scripts/verify-chat-onboarding.mjs`. Your job
is the half a machine cannot see: that a real person can walk it and that it feels
right.
