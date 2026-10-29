# BRD – Call Health Monitoring View

**Owner:** Wes Boucher, Product Manager, ROMTech **Status:** Draft v0.1 **Build:** Internal (not using CXone/NICE built-in analytics)

## 1. Problem Statement

ROMTech has no way to monitor calls from an outside view. We cannot gauge the health of an order, patient, or customer account from the conversations happening between Home Rehab Coordinators (HRC), Customer Service, and patients calling in.

"Health" in this document means the health of the order and customer relationship (risk of frustration, delay, escalation, or cancellation), not the patient's medical health.

## 2. Goal

Give the company one shared view that shows which orders and patients are showing signs of poor health, based on call activity and call content.

## 3. Users

One single view serves everyone:

- **C-suite and leadership:** see the top-level picture at a glance.
- **Quality and coaching:** drill into flagged calls to coach staff.
- **Order handling teams:** drill into flagged orders to fix problems.

## 4. Data Sources

- **Call recordings:** CXone and RingCentral.
- **Transcripts:** already produced today. Plain text, no timestamps.
- **Call records:** call direction (incoming vs outgoing) and call length, from CXone and RingCentral.
- **Order and patient matching:** phone number matched against ROMTech's central database.

### Ortho and Cardiac

Every order, linked call, and transcript belongs to either **Ortho** or **Cardiac**. The two run on separate flags, time windows, and scoring logic, and every screen can be switched between them.

- **Ortho** follows today's IOMS sequence: Intake, Verification, Pending Auth, Patient Sales, Cleared for Delivery, Treatment, Billing (WIP statuses 0 through 99).
- **Cardiac** follows today's cardiac sequence: Intake, Clinical Eligibility, Insurance Eligibility, Go/No-Go, Logistics, Enrolled in CR, Discharge, plus Lost / Not Converted.

## 5. Health Flags

Each call is scored for the following:

| Flag | What it looks for |
| --- | --- |
| Cancellation language | "Cancel" and variations |
| Negative sentiment | Angry, upset, and variations; sentiment read across the whole call, not single words |
| Delay talk | "Still waiting", "haven't received", "where's my device" |
| Escalation phrases | "Supervisor", "manager", "complaint", "lawyer" |
| Getting passed around | "I already told someone", "nobody called me back" |
| Short or dropped calls | From call length in call records |

**Excluded:** billing and cost questions (too often normal conversation), competitor mentions, speaking speed, tone of voice, and long silences (transcripts have no timestamps).

## 6. Weighting Rules

- **Repeat caller multiplier:** incoming calls from any phone number on the order (patient primary, alternate, caregiver) are counted within a time window set in Flag Settings, which can be set to the whole life of the order. Repeat incoming calls that carry flags multiply the poor-health signal, with the multiplier set per call count. Ortho and Cardiac each have their own window and multipliers.
- **Dropped call weighting:** a dropped incoming call (patient calling us) weighs more than a dropped outgoing call (us calling them).

## 7. The View

Call Review lives under **Quality > Call Review** in ROMCRM, with three views and an Ortho / Cardiac switch on each:

- **Overview (new):** headline numbers for leadership, a count of flagged orders by area of the order sequence, and flagged orders ranked by health. Each row shows the area, order status (WIP), owner, health, incoming calls with multiplier, flags hit, and last call.
- **Calls (exists today):** the current call-by-call list with summary, scoring, and transcript.
- **Flag Settings (new):** the maintenance screen where the flags and scoring are set (see below).
- **Drill-down on a flagged order:**
  - Area, order status, owner, time in status, and where the order sits in its sequence
  - List of calls on the order, with the area the order was in at the time of each call
  - Flags hit on each call
  - The transcript snippet that triggered each flag
  - Who handled each call

### Flag Settings (Maintenance Screen)

Set separately for Ortho and Cardiac. Every change records who made it and when.

- **Repeat calls:** which phone numbers on the order to match, how many incoming calls count as repeat, the time window, and the multiplier per call count.
- **Dropped and short calls:** the short-call threshold in seconds, what counts as dropped, and separate weights for dropped incoming and dropped outgoing calls.
- **Language flags:** add, edit, or turn off flags. Each flag has its phrases (with variations), a weight, the call direction it applies to, and the areas of the order it applies to.
- **Sentiment:** scored across the whole call on the caller's side, with the share of the call that must be negative, and a weight.
- **Health score bands:** the score cutoffs for Poor, At risk, and Watch, and when a score resets.

## 8. Out of Scope (This Phase)

- Alerts, notifications, and work queues. Flagged orders are visible in the view only. To be revisited later.
- Medical or clinical health signals.

## 9. Open Questions

- How exactly the health score is calculated and what the thresholds are for poor health.
- What counts as a "short" call versus a "dropped" call.
- How to handle calls whose phone number doesn't match a record, or matches more than one.
- How often the view refreshes.
- The starting values for each setting, for Ortho and for Cardiac.
- Cardiac-specific phrases for each language flag.
- Whether a flag should only count while the order is in certain areas.
