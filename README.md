# Call Review in ROMCRM

New page under **Quality > Call Review** in the ROMCRM sidebar. Same shell, logo and colors as the Market Access intelligence hub, built here as its own app so it can move into ROM CRM later.

## Files
- `BRD - Call Health Monitoring View.md` — the business requirements.
- `mockup/` — design source for the new screens: Main (Overview), OrderDrawer (flagged order drill-down), Settings (flag settings), plus the ROMCRM logo. Easiest to view through the live canvas link below.

## Live design (all screens, editable)
ROMCRM Call Review canvas: https://claude.ai/artifact/D38TrnCww9M96Ak23Co7Vx
Every screen has an Ortho / Cardiac switch; the two have separate flags, time windows and scoring.
1. **Overview** (new) — headline numbers, flagged orders counted by area of the order sequence, and flagged orders ranked by health with area, order status (WIP), owner, incoming calls + multiplier, flags, last call.
2. **Calls** (exists today) — current call-by-call list with summary, scoring and transcript. Unchanged.
3. **Flagged order drill-down** — drawer with area, order status, owner, time in status, the order's place in its sequence, then each call (with the area it happened in), flags, transcript line, agent.
4. **Flag settings** (new maintenance screen) — repeat calls (which phone numbers on the order, count, time window, multipliers), dropped/short calls, language flags (phrases, weight, direction, areas), sentiment, health score bands.

Order sequences follow today's flow: ortho IOMS WIP statuses (Intake, Verification, Pending Auth, Patient Sales, CFD—Awaiting Delivery, Delivered, Awaiting Treatment, Treatment, Billing) and cardiac (Intake, Clinical Eligibility, Insurance Eligibility, Go/No-Go, Logistics, Enrolled in CR, Discharge).

## Colors (from the hub's `src/index.css`)
| Use | Hex |
| --- | --- |
| Page | #f8fafd |
| Panel / table header | #f1f4f7 |
| Border | #e0e3e7 |
| Text / secondary | #1e232d / #525761 |
| Link + accent / navy | #2a65c7 / #2350a8 |
| Active nav background | #eff6ff |
| Poor health pill | #fde8e6 bg, #a3241a text |
| At risk pill | #faeacf bg, #8f5214 text |
| Watch pill | #dcf2ff bg, #005993 text |
| Neutral flag pill | #eef1f5 bg, #373b45 text |
| Incoming / outgoing call tag | #dbe7fa / #2350a8, #d3f5f5 / #04585b |

Font: Inter.

## Run it
```bash
npm install
npm run dev        # http://localhost:3000 (opens Quality > Call Review)
npm run lint       # type-check
npm run build      # production build
```
No database, keys or sign-in: a standalone Next.js app (Next 16, React 19, Tailwind 4) inside the ROM CRM shell (sidebar, logo, theme). Only Quality > Call Review is live; the other sidebar entries are presentational.

## Build (proof of concept)
| What | Where |
| --- | --- |
| Sequences, WIP statuses, starting flag settings | `src/config/callReview.ts` |
| Scoring: flags per call, repeat multiplier, reset, bands | `src/lib/callReview/scoring.ts` |
| Made-up orders and calls (seeded) | `src/lib/callReview/sampleData.ts` |
| Made-up transcripts, shaped like CXone / RingCentral ones | `src/lib/callReview/sampleTranscripts.ts` |
| Screens: Overview, order drawer, Calls, Flag settings | `src/components/callReview/` |
| ROM CRM shell (sidebar, top bar) | `src/components/shell/` |
| Routes | `app/(crm)/quality/call-review/` (`/calls`, `/settings`) |

No real calls or transcripts: sample data stands in for CXone / RingCentral and the order match. Scores are computed live from the flag settings, so changing a setting changes the Overview. Settings save to the browser (localStorage) with a who/when change log; the "who" is a placeholder until this sits inside ROM CRM. To go live, replace `sampleData` / `sampleTranscripts` and the settings store; the screens and scoring stay.

Assumptions made for the open questions (BRD section 9): score = flag points (High 25, Medium 12, Low 5) × repeat multiplier, capped at 100; "dropped" = ended before resolution or cut by the phone system; language flags match the caller's side only; the score resets after the set number of days with no flags. Real transcripts carry a timestamp on every turn (the BRD says they don't); the samples follow the real format.
