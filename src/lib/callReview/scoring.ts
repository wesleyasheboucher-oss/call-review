import {
  SYSTEM_FLAGS, WEIGHT_POINTS, type Band, type Lob, type PhoneType, type Settings, type Weight,
} from '../../config/callReview';

/**
 * Call Review scoring: which flags each call hits, and the health of each order.
 *
 * Score = sum of flag points on the order's flagged calls x the repeat multiplier,
 * capped at 100. Higher is worse. The bands in Flag Settings turn it into the pill.
 * Everything is a pure function of (orders, calls, settings, as-of time), so the
 * settings screen can preview a draft against the same data.
 */

export interface StatusStep {
  area: string;
  status: string;
  /** ISO time the order entered this status. */
  from: string;
}

export interface Order {
  id: string;
  lob: Lob;
  patient: string;
  orderNumber: string;
  payer: string;
  phones: Record<PhoneType, string | null>;
  openedOn: string;
  rep: string;
  hrc: string;
  surgeryDate: string | null;
  /** Key order data shown in the drill-down (from the order record, not from calls). */
  profile: OrderProfile;
  /** Oldest first. The last step is where the order sits now. */
  history: StatusStep[];
}

export interface OrderProfile {
  dob: string;
  address: { street: string; city: string; state: string; zip: string };
  language: string;
  /** Ortho: the surgery. Cardiac: the qualifying diagnosis. */
  procedure: string;
  physician: string;
  facility: string;
  memberId: string;
  authStatus: string;
  /** Ortho: device delivery (scheduled or done). */
  delivery: { date: string; done: boolean } | null;
  /** Cardiac: hospital discharge. */
  dischargeDate: string | null;
}

export interface Call {
  id: string;
  orderId: string;
  at: string;
  direction: 'Incoming' | 'Outgoing';
  durationSec: number;
  source: string;
  agent: string;
  team: string;
  /** Which phone number on the order the call came from or went to. */
  phoneType: PhoneType;
  /** The call ended before the caller's question was dealt with. */
  endedEarly: boolean;
  /** The phone system cut the call (from CXone / RingCentral call records). */
  systemDisconnect: boolean;
  /** Share of the caller's side that reads negative, 0-100 (sentiment model output). */
  negativeShare: number;
  /** The caller's side ends more negative than it started. */
  endedWorse: boolean;
  summary: string;
  /** Speaker turns with the time into the call, as CXone / RingCentral transcripts come. */
  transcript: Turn[];
}

export interface Turn {
  speaker: 'Agent' | 'Caller';
  /** Agent's name, or "Caller". */
  name: string;
  /** Seconds into the call. */
  at: number;
  text: string;
}

export interface FlagHit {
  id: string;
  label: string;
  points: number;
  /** Exact quote: the sentence in the transcript that triggered the flag. */
  snippet: string;
  /** The turn that sentence sits in, so the UI can jump to it. */
  line: number;
  /** Seconds into the call. */
  at: number;
  speaker: 'Caller' | 'Agent';
  /** What the flag measured, for flags that aren't phrase matches (sentiment share, drop, length). */
  detail?: string;
}

export interface ScoredCall extends Call {
  area: string;
  status: string;
  flags: FlagHit[];
  points: number;
}

export interface OrderHealth {
  order: Order;
  area: string;
  status: string;
  owner: string;
  daysInStatus: number;
  score: number;
  band: Band;
  /** Flag points before the multiplier. */
  base: number;
  multiplier: number;
  /** Calls whose flags count toward the score (the rest fell outside the reset period). */
  countedIds: string[];
  /** Incoming calls from matched numbers inside the repeat window. */
  incoming: number;
  incomingFlagged: number;
  /** Flags hit again: on 2+ incoming calls from matched numbers inside the repeat window. */
  repeatFlags: string[];
  repeat: boolean;
  outgoing: number;
  /** Every call up to the as-of time, newest first. */
  calls: ScoredCall[];
  /** Flag label -> number of calls that hit it (counting calls inside the score). */
  flagCounts: Record<string, number>;
  /** Flag ids hit inside the score, for filtering. */
  flagIds: string[];
  lastCall: ScoredCall | null;
}

const DAY = 86_400_000;
const points = (w: Weight) => WEIGHT_POINTS[w];

export const statusAt = (order: Order, iso: string): StatusStep => {
  let step = order.history[0];
  for (const s of order.history) if (s.from <= iso) step = s;
  return step;
};

/** Words of a phrase, each allowed a short ending: cancel -> cancelled, cancelling, cancellation. */
const phraseRegex = (phrase: string) => {
  const words = phrase
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]?"));
  return new RegExp(`\\b${words.map(w => `${w}\\w{0,6}`).join('\\s+')}\\b`, 'i');
};
const regexCache = new Map<string, RegExp>();
const matcher = (phrase: string) => {
  let r = regexCache.get(phrase);
  if (!r) regexCache.set(phrase, (r = phraseRegex(phrase)));
  return r;
};

/** A turn split into sentences, each an exact substring of the turn. */
export const sentences = (text: string) => (text.match(/[^.?!]+[.?!]*/g) || [text]).map(x => x.trim()).filter(Boolean);

/** Quote one sentence of turn `i` as a flag's trigger. */
const quote = (call: Call, i: number, sentence: string) => ({
  line: i,
  at: call.transcript[i].at,
  speaker: call.transcript[i].speaker,
  snippet: sentence,
});
const lastSentence = (call: Call) => {
  const i = call.transcript.length - 1;
  return quote(call, i, sentences(call.transcript[i].text).at(-1)!);
};

/**
 * Stand-in for the sentiment model's "most negative moment": the caller sentence
 * with the most negative cue words (the latest one on a tie). In production the
 * model returns the moment itself.
 */
const NEGATIVE_CUES = /\b(not|never|nobody|no one|again|still|forever|ridiculous|frustrat\w*|upset|angry|cancel\w*|supervisor|complain\w*|tired|worst|waste)\b/gi;
const mostNegative = (call: Call) => {
  let best = lastSentence(call);
  let bestScore = -1;
  for (const [i, turn] of call.transcript.entries()) {
    if (turn.speaker !== 'Caller') continue;
    for (const x of sentences(turn.text)) {
      const n = (x.match(NEGATIVE_CUES) || []).length;
      if (n >= bestScore) {
        best = quote(call, i, x);
        bestScore = n;
      }
    }
  }
  return best;
};

/** The first caller sentence that matches any of the phrases. */
const firstMatch = (call: Call, phrases: string[]) => {
  for (const [i, turn] of call.transcript.entries()) {
    if (turn.speaker !== 'Caller') continue;
    const x = sentences(turn.text).find(x => phrases.some(p => matcher(p).test(x)));
    if (x) return quote(call, i, x);
  }
  return null;
};

export const isDropped = (call: Call, s: Settings) => (s.calls.dropped === 'system' ? call.systemDisconnect : call.endedEarly || call.systemDisconnect);

/** Flags one call hits under the given settings. */
export function flagCall(call: Call, order: Order, s: Settings): FlagHit[] {
  const hits: FlagHit[] = [];
  const area = statusAt(order, call.at).area;

  for (const f of s.language) {
    if (!f.on || f.weight === 'Off') continue;
    if (f.direction !== 'Both' && f.direction !== call.direction) continue;
    if (f.areas.length && !f.areas.includes(area)) continue;
    const hit = firstMatch(call, f.phrases.map(p => p.trim()).filter(Boolean));
    if (hit) hits.push({ id: f.id, label: f.name, points: points(f.weight), ...hit });
  }

  if (s.sentiment.weight !== 'Off' && (call.negativeShare > s.sentiment.sharePct || (s.sentiment.endedWorse && call.endedWorse))) {
    const why = call.negativeShare > s.sentiment.sharePct
      ? `Caller's side negative for ${call.negativeShare}% of the call`
      : 'Caller ended more negative than they started';
    hits.push({ id: 'sentiment', label: SYSTEM_FLAGS.sentiment, points: points(s.sentiment.weight), ...mostNegative(call), detail: why });
  }

  const dropped = isDropped(call, s);
  if (dropped) {
    const w = call.direction === 'Incoming' ? s.calls.droppedIncoming : s.calls.droppedOutgoing;
    if (w !== 'Off') {
      const how = call.systemDisconnect ? 'Disconnected by the phone system' : 'Call ended before the question was resolved';
      hits.push({
        id: call.direction === 'Incoming' ? 'droppedIn' : 'droppedOut',
        label: call.direction === 'Incoming' ? SYSTEM_FLAGS.droppedIn : SYSTEM_FLAGS.droppedOut,
        points: points(w),
        ...lastSentence(call),
        detail: `${how} after ${fmtDuration(call.durationSec)}; the last words before the drop`,
      });
    }
  } else if (call.durationSec < s.calls.shortSec && s.calls.short !== 'Off') {
    hits.push({
      id: 'short', label: SYSTEM_FLAGS.short, points: points(s.calls.short),
      ...lastSentence(call),
      detail: `Call lasted ${fmtDuration(call.durationSec)}; the last words said`,
    });
  }
  return hits;
}

export const bandOf = (score: number, s: Settings): Band =>
  score >= s.bands.poor ? 'Poor' : score >= s.bands.risk ? 'At risk' : score >= s.bands.watch ? 'Watch' : 'Healthy';

/** The highest multiplier row the flagged incoming count reaches; 1 below the first row. */
export const multiplierFor = (flaggedIncoming: number, s: Settings) =>
  [...s.repeat.multipliers].sort((a, b) => a.calls - b.calls).reduce((x, row) => (flaggedIncoming >= row.calls ? row.x : x), 1);

export function scoreOrder(order: Order, allCalls: Call[], s: Settings, asOf: string, owners: Record<string, string>): OrderHealth {
  const asOfMs = Date.parse(asOf);
  const calls: ScoredCall[] = allCalls
    .filter(c => c.at <= asOf)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(c => {
      const step = statusAt(order, c.at);
      const flags = flagCall(c, order, s);
      return { ...c, area: step.area, status: step.status, flags, points: flags.reduce((n, f) => n + f.points, 0) };
    });

  // Reset: the score only counts the newest run of flagged calls with no gap longer than the reset period.
  const flagged = calls.filter(c => c.flags.length);
  const counted: ScoredCall[] = [];
  const reset = s.bands.resetDays;
  let edge = asOfMs;
  for (const c of flagged) {
    const t = Date.parse(c.at);
    if (reset !== null && edge - t > reset * DAY) break;
    counted.push(c);
    edge = t;
  }

  const windowStart = s.repeat.windowDays === null ? -Infinity : asOfMs - s.repeat.windowDays * DAY;
  const inWindow = calls.filter(c => c.direction === 'Incoming' && s.repeat.phones.includes(c.phoneType) && Date.parse(c.at) >= windowStart);
  const incomingFlagged = inWindow.filter(c => c.flags.length).length;
  const hitsInWindow: Record<string, number> = {};
  inWindow.forEach(c => c.flags.forEach(f => (hitsInWindow[f.label] = (hitsInWindow[f.label] || 0) + 1)));
  const repeatFlags = Object.keys(hitsInWindow).filter(l => hitsInWindow[l] >= 2);
  const multiplier = counted.length ? multiplierFor(incomingFlagged, s) : 1;
  const base = counted.reduce((n, c) => n + c.points, 0);
  const score = Math.min(100, Math.round(base * multiplier));

  const flagCounts: Record<string, number> = {};
  const flagIds = new Set<string>();
  counted.forEach(c => c.flags.forEach(f => {
    flagCounts[f.label] = (flagCounts[f.label] || 0) + 1;
    flagIds.add(f.id);
  }));

  const now = statusAt(order, asOf);
  return {
    order,
    area: now.area,
    status: now.status,
    owner: owners[now.area] || '',
    daysInStatus: Math.max(0, Math.floor((asOfMs - Date.parse(now.from)) / DAY)),
    score,
    band: bandOf(score, s),
    base,
    multiplier,
    countedIds: counted.map(c => c.id),
    incoming: inWindow.length,
    incomingFlagged,
    repeatFlags,
    repeat: incomingFlagged >= s.repeat.count,
    outgoing: calls.filter(c => c.direction === 'Outgoing').length,
    calls,
    flagCounts,
    flagIds: [...flagIds],
    lastCall: calls[0] || null,
  };
}

export const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** "Today, 10:42 AM" / "Yesterday, 4:15 PM" / "Oct 27, 1:08 PM" */
export function fmtWhen(iso: string, now = new Date()) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / DAY);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
