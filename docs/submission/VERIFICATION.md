# What has been checked, and how to check it yourself

Every check below was run by the author on the local build (branch `itax`). None has been run by an independent reviewer yet. Each line says how to reproduce it.

| Claim | Status | Reproduce |
|---|---|---|
| The quiet-customer list (10 accounts, £93,531.25, each one's orders, gap, silence and spend) matches the independent Python script | Author-tested; a test locks all 10 rows | `npx vitest run tests/followup.test.ts` · `python3 scripts/validate_lapsed.py` |
| The rule replay on the shop's past (25 flagged, 8 stayed away vs 6 of 80; 14 flagged, 5 vs 3 of 90; Fisher p = 0.0041 and 0.00096) matches the Python script | Author-tested; a test locks both counts | same as above |
| Recheck counts orders after each customer's own contact day, counts same-day orders separately, and never counts an order placed before the contact | Author-tested | `tests/followup.test.ts` ("follow-up timing and coverage") |
| Contact days before the list or in the future are rejected by the server; impossible dates are rejected; filters must be off | Author-tested | `tests/followup.test.ts` ("tool guards") |
| Saved lists are frozen; only status, contact day, note, skip reason and the latest recheck change; changing a contact clears the old recheck; a replay can't log contacts | Author-tested | `tests/followup-rules.test.ts` |
| One user can't read, change, delete or forge another user's lists, and signed-out visitors see none | Author-tested on the live Supabase project, with throwaway users that are deleted afterwards | `scripts/rls-check.sql` (run in the Supabase SQL editor) |
| AI outreach notes are rejected for money, counts, periods, discounts, "you left" or another catalogue product. Product names come only from the customer's own purchases. Blind spot: a product name the shop doesn't sell | Author-tested, including adversarial cases and the blind spot | `tests/draft-guard.test.ts` |
| A failed AI draft falls back to the plain template, with the reason shown | Author-tested by code path; not yet forced in a browser | `services/api/src/routes/ai.ts` (`fallback: true`) |
| Photo tables are shown and editable before anything is analysed | Author-tested in code; needs a real photo in a browser | `apps/web/src/components/Upload.tsx` (`PhotoReview`) |
| All 18 site and app pages load with no console errors | Author-tested (scripted) | a Playwright page sweep (the script is in the session notes) |
| Phone width (390px): no sideways scrolling on the home page or Customer Radar | Author-tested (scripted) | Playwright at 390×844 |
| The demo fits 2:45 with real clicks and a real AI note | A captioned draft recording of the real clicks runs 2:44 (`docs/submission/demo-draft.webm`, regenerate with `node scripts/demo/record.mjs && node scripts/demo/encode.mjs`). **A human voiceover take is still to do.** | the recording scripts |

**Not yet checked by anyone:**
- **Account switching in a browser with two real accounts.** It's covered in code and by database-level row security, but not run by hand.
- **The deployed public build.** It's not deployed yet.

## Merchant check (to do, and the most important gap)

The rule is validated on one public retailer's history. No shop owner has used it on their own export yet. Run this protocol with one owner:

1. **Load their export.** They upload it themselves, with no help on screen.
2. **Read the list.** Ask them to open Customer Radar and say, for each quiet customer, "contact" or "skip, because…". Write down every disagreement word for word. The Skip reasons (seasonal, closed, buys elsewhere, other) save these.
3. **Score the list.** Count how many listed accounts they'd contact, and how many they'd have spotted without BlindSpot.
4. **Note the friction.** Record anything that confused them or slowed them down.
5. **Recheck later.** After 30–60 days, they upload a newer export and press Recheck. Record who ordered after contact, and who ordered without one.

**Report:** what they agreed with, what they rejected and why, and what confused them. A result like "3 of these deserve contact; 2 are seasonal and should be excluded" is useful evidence, even though it isn't a success claim.
