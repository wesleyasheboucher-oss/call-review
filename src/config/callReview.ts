/**
 * Quality > Call Review: order health from call activity and call content.
 *
 * "Health" is the health of the order and the customer relationship (risk of
 * frustration, delay, escalation or cancellation), not the patient's medical
 * health (BRD - Call Health Monitoring View, section 1).
 *
 * Ortho and Cardiac run on separate sequences, flags, time windows and scoring.
 * Values here describe how Call Review works. Rename values here, not in components.
 *
 * ASSUMED: the WIP status names and every starting setting are placeholders until
 * ops supplies the real values (BRD section 9, open questions).
 */

export type Lob = 'ortho' | 'cardiac';
export const LOBS: { key: Lob; label: string }[] = [
  { key: 'ortho', label: 'Ortho' },
  { key: 'cardiac', label: 'Cardiac' },
];
export const lobLabel = (lob: Lob) => (lob === 'ortho' ? 'Ortho' : 'Cardiac');

/** Sub-views of the page. Each `href` is a route under app/(hub)/quality/call-review/. */
export const CALL_REVIEW_HREF = '/quality/call-review';
export const CALL_REVIEW_VIEWS = [
  { key: 'overview', href: CALL_REVIEW_HREF, label: 'Overview' },
  { key: 'calls', href: `${CALL_REVIEW_HREF}/calls`, label: 'Calls' },
  { key: 'settings', href: `${CALL_REVIEW_HREF}/settings`, label: 'Flag settings' },
] as const;

/** An area of the order sequence and the order statuses (WIP) that sit in it. */
export interface Area {
  name: string;
  owner: string;
  statuses: string[];
}

/** Ortho follows today's IOMS sequence (WIP 0 through 99). */
const ORTHO_AREAS: Area[] = [
  { name: 'Intake', owner: 'Intake', statuses: ['WIP 01 · New Order', 'WIP 05 · Missing Docs'] },
  { name: 'Verification', owner: 'Verifications', statuses: ['WIP 12 · Insurance Verification', 'WIP 12.2 · Benefits Pending'] },
  { name: 'Pending Auth', owner: 'HRC', statuses: ['WIP 17 · Pending Authorization', 'WIP 17.2 · Auth Submitted'] },
  { name: 'Patient Sales', owner: 'HRC', statuses: ['WIP 13.1 · Ins. Cleared Urgent', 'WIP 18 · Patient Outreach'] },
  { name: 'CFD—Awaiting Delivery', owner: 'Logistics', statuses: ['WIP 14 · CFD', 'WIP 19.1 · Cleared for Delivery, Pending Auth', 'WIP 21 · Delivery Scheduled'] },
  { name: 'Delivered, Awaiting Treatment', owner: 'Clinical', statuses: ['WIP 22 · Delivered'] },
  { name: 'Treatment', owner: 'Clinical', statuses: ['WIP 30 · In Therapy'] },
  { name: 'Billing', owner: 'RCM', statuses: ['WIP 50 · Charge Capture', 'WIP 60 · In Collections'] },
];

/** Cardiac follows today's cardiac sequence. Lost / Not Converted sits off the main path. */
const CARDIAC_AREAS: Area[] = [
  { name: 'Intake', owner: 'Intake', statuses: ['New Referral', 'Missing Info Hold'] },
  { name: 'Clinical Eligibility', owner: 'HRC', statuses: ['Clinical Review', 'Missing info hold'] },
  { name: 'Insurance Eligibility', owner: 'RCM EVA', statuses: ['Benefits Check', 'Prior Auth hold'] },
  { name: 'Go/No-Go', owner: 'Clinical', statuses: ['Go/No-Go Review'] },
  { name: 'Logistics', owner: 'Logistics', statuses: ['Delivery Requested', 'Delivery Scheduled'] },
  { name: 'Enrolled in CR', owner: 'Clinical', statuses: ['Converted / Enrolled in CR'] },
  { name: 'Discharge', owner: 'Clinical', statuses: ['Program Complete'] },
];

export const SEQUENCES: Record<Lob, Area[]> = { ortho: ORTHO_AREAS, cardiac: CARDIAC_AREAS };
export const areaNames = (lob: Lob) => SEQUENCES[lob].map(a => a.name);

export const TEAMS = ['Customer Service', 'HRC'] as const;
export const CALL_SOURCES = ['CXone', 'RingCentral'] as const;

// ---------------------------------------------------------------------------
// Flag settings (the maintenance screen, BRD section 7)
// ---------------------------------------------------------------------------

export type Weight = 'High' | 'Medium' | 'Low' | 'Off';
/** Points a flag adds to the health score, before the repeat multiplier. */
export const WEIGHT_POINTS: Record<Weight, number> = { High: 25, Medium: 12, Low: 5, Off: 0 };
export const WEIGHTS: Weight[] = ['High', 'Medium', 'Low', 'Off'];

export type Direction = 'Incoming' | 'Outgoing' | 'Both';
export type PhoneType = 'primary' | 'alternate' | 'caregiver';
export const PHONE_TYPES: { key: PhoneType; label: string }[] = [
  { key: 'primary', label: 'Patient primary' },
  { key: 'alternate', label: 'Patient alternate' },
  { key: 'caregiver', label: 'Caregiver / emergency contact' },
];

export interface LanguageFlag {
  id: string;
  name: string;
  on: boolean;
  /** Matched on the caller's side of the transcript, with close variations (cancel, cancelled, cancelling). */
  phrases: string[];
  weight: Weight;
  direction: Direction;
  /** Empty means all areas. */
  areas: string[];
}

export interface Settings {
  repeat: {
    phones: PhoneType[];
    /** Incoming flagged calls at or above this count are "repeat". */
    count: number;
    /** Days; null is the whole life of the order. */
    windowDays: number | null;
    /** Multiplier by incoming flagged call count; the highest row that applies wins. */
    multipliers: { calls: number; x: number }[];
  };
  calls: {
    shortSec: number;
    dropped: 'unresolved' | 'system';
    droppedIncoming: Weight;
    droppedOutgoing: Weight;
    short: Weight;
  };
  sentiment: {
    /** Share of the caller's side that must read negative, 0-100. */
    sharePct: number;
    endedWorse: boolean;
    weight: Weight;
  };
  language: LanguageFlag[];
  bands: { poor: number; risk: number; watch: number; resetDays: number | null };
}

/** One row per change on the settings screen. Every change records who and when (BRD section 7). */
export interface SettingsChange {
  at: string;
  by: string;
  lob: Lob;
  summary: string;
}

const COMMON_FLAGS = (lob: Lob): LanguageFlag[] => [
  {
    id: 'cancel', name: 'Cancellation', on: true, weight: 'High', direction: 'Incoming', areas: [],
    phrases: lob === 'ortho' ? ['cancel', "don't send it", 'send it back'] : ['cancel', 'stop the program', 'drop out'],
  },
  { id: 'escalation', name: 'Escalation', on: true, weight: 'High', direction: 'Both', areas: [], phrases: ['supervisor', 'manager', 'complaint', 'lawyer'] },
  {
    id: 'delay', name: 'Delay talk', on: true, weight: 'Medium', direction: 'Incoming',
    areas: lob === 'ortho' ? ['Pending Auth', 'CFD—Awaiting Delivery'] : ['Insurance Eligibility', 'Logistics'],
    phrases: lob === 'ortho' ? ['still waiting', "haven't received", "where's my device"] : ['still waiting', "haven't heard", 'when do I start'],
  },
  { id: 'passed', name: 'Passed around', on: true, weight: 'Medium', direction: 'Incoming', areas: [], phrases: ['already told someone', 'nobody called me back', 'transferred again'] },
  { id: 'negwords', name: 'Negative words', on: true, weight: 'Low', direction: 'Both', areas: [], phrases: ['angry', 'upset', 'frustrated', 'ridiculous'] },
];

export const DEFAULT_SETTINGS: Record<Lob, Settings> = {
  ortho: {
    repeat: { phones: ['primary', 'alternate', 'caregiver'], count: 3, windowDays: 14, multipliers: [{ calls: 2, x: 1.5 }, { calls: 3, x: 2 }, { calls: 4, x: 3 }] },
    calls: { shortSec: 45, dropped: 'unresolved', droppedIncoming: 'High', droppedOutgoing: 'Low', short: 'Low' },
    sentiment: { sharePct: 40, endedWorse: true, weight: 'Medium' },
    language: COMMON_FLAGS('ortho'),
    bands: { poor: 80, risk: 50, watch: 30, resetDays: 30 },
  },
  cardiac: {
    repeat: { phones: ['primary', 'alternate', 'caregiver'], count: 2, windowDays: 7, multipliers: [{ calls: 2, x: 2 }, { calls: 3, x: 3 }] },
    calls: { shortSec: 30, dropped: 'unresolved', droppedIncoming: 'High', droppedOutgoing: 'Low', short: 'Low' },
    sentiment: { sharePct: 30, endedWorse: true, weight: 'Medium' },
    language: COMMON_FLAGS('cardiac'),
    bands: { poor: 70, risk: 45, watch: 25, resetDays: 14 },
  },
};

// ---------------------------------------------------------------------------
// Health bands and flag tones (README colours)
// ---------------------------------------------------------------------------

export type Band = 'Poor' | 'At risk' | 'Watch' | 'Healthy';
export const BAND_TONE: Record<Band, string> = {
  Poor: 'bg-[#fde8e6] text-[#a3241a]',
  'At risk': 'bg-amber-100 text-amber-700',
  Watch: 'bg-sky-100 text-sky-700',
  Healthy: 'bg-emerald-100 text-emerald-700',
};
/** Solid fills for bars and dots (the pill text colours, at full strength). */
export const BAND_FILL: Record<Band, string> = {
  Poor: 'bg-[#c7392c]',
  'At risk': 'bg-amber-500',
  Watch: 'bg-sky-500',
  Healthy: 'bg-emerald-500',
};
export const BAND_TEXT: Record<Band, string> = {
  Poor: 'text-[#a3241a]',
  'At risk': 'text-amber-700',
  Watch: 'text-sky-700',
  Healthy: 'text-emerald-700',
};

/** Built-in (non-language) flags. Language flags use their own id. */
export const SYSTEM_FLAGS = {
  sentiment: 'Negative sentiment',
  droppedIn: 'Dropped incoming',
  droppedOut: 'Dropped outgoing',
  short: 'Short call',
} as const;

/** Cancellation reads red; anything about mood or delay reads amber; the rest neutral. */
export const flagTone = (id: string) =>
  id === 'cancel'
    ? 'bg-[#fde8e6] text-[#a3241a]'
    : ['sentiment', 'escalation', 'delay', 'negwords'].includes(id)
      ? 'bg-amber-100 text-amber-700'
      : 'bg-[#eef1f5] text-slate-700';

export const DIRECTION_TONE = { Incoming: 'bg-brand-100 text-brand-700', Outgoing: 'bg-teal-100 text-teal-700' } as const;
