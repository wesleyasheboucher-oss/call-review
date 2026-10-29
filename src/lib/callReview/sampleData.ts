import { SEQUENCES, CALL_SOURCES, TEAMS, type Lob, type PhoneType } from '../../config/callReview';
import { statusAt, type Call, type Order, type StatusStep } from './scoring';
import { buildTranscript, type Kind } from './sampleTranscripts';

/**
 * Made-up orders and calls for the Call Review proof of concept.
 *
 * Nothing here is real: names, numbers and transcript lines are invented so the
 * flags have something to match. In production, calls and call records come from
 * CXone and RingCentral, transcripts from today's transcription, and orders from
 * the central database by phone number (BRD section 4).
 *
 * Seeded, so every load produces the same set; times are relative to "now".
 */

const DAY = 86_400_000;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Dana', 'Marcus', 'Elena', 'Ray', 'Priya', 'Tom', 'Gloria', 'Andre', 'Wendy', 'Luis', 'Carol', 'Hank', 'Mei', 'Owen', 'Rita', 'Sam', 'Nadia', 'Victor', 'June', 'Ike', 'Paula', 'Grant', 'Tess', 'Abe'];
const LAST = ['Whitfield', 'Okafor', 'Brandt', 'Salazar', 'Lindqvist', 'Moreau', 'Tanaka', 'Fairbanks', 'Delgado', 'Pruitt', 'Kowalski', 'Ashby', 'Nguyen', 'Castellano', 'Hartley', 'Rasmussen'];
const AGENTS = ['Kim Ramirez', 'Jordan Pace', 'Alexis Moore', 'Chris Tran', 'Morgan Lee', 'Taylor Brooks', 'Jamie Soto', 'Riley Dunn'];
const REPS = ['B. Coleman', 'S. Ortiz', 'D. Pham', 'L. Griffin'];
const PAYERS = ['Medicare', 'Aetna', 'UnitedHealthcare', 'BCBS', 'Humana', 'Cigna', 'Workers Comp'];
const STREETS = ['Maple Ave', 'Oak Hollow Dr', 'Cedar Ln', 'W 4th St', 'Ridgeview Rd', 'Lakeshore Blvd', 'Pine Crest Ct', 'Mill Creek Way'];
const PLACES: [string, string, string][] = [
  ['Plano', 'TX', '75024'], ['Tulsa', 'OK', '74133'], ['Mesa', 'AZ', '85210'], ['Columbus', 'OH', '43215'],
  ['Raleigh', 'NC', '27609'], ['Tampa', 'FL', '33612'], ['Omaha', 'NE', '68114'], ['Boise', 'ID', '83704'],
];
const PROCEDURES: Record<Lob, string[]> = {
  ortho: ['Total knee replacement, right', 'Total knee replacement, left', 'Total hip replacement', 'ACL reconstruction', 'Rotator cuff repair', 'Total shoulder replacement'],
  cardiac: ['Post-MI', 'CABG', 'PCI / stent', 'Heart failure (HFrEF)', 'Stable angina', 'Valve replacement'],
};
const PHYSICIANS = ['Dr. A. Mehta', 'Dr. R. Castillo', 'Dr. K. Brennan', 'Dr. S. Liu', 'Dr. T. Adeyemi', 'Dr. M. Novak'];
const FACILITIES: Record<Lob, string[]> = {
  ortho: ['Lakeside Orthopedic Center', 'Summit Bone & Joint', 'Riverbend Surgical Hospital', 'Northgate Ortho Associates'],
  cardiac: ['St. Brigid Heart Institute', 'Valley Regional Medical Center', 'Mercy Cardiology Group', 'Eastside Heart & Vascular'],
};

const SUMMARY: Record<Kind, string> = {
  cancel: 'asked to cancel',
  escalation: 'asked for a supervisor',
  delay: 'asked where things stand',
  passed: 'said they had been passed around',
  negwords: 'sounded frustrated',
  sentiment: 'upset through most of the call',
  dropped: 'call dropped',
  short: 'brief call',
};

/** How hard each sample order is hit: [incoming calls, outgoing calls, flag kinds to draw from, days back the calls spread over]. */
const PROFILES: Record<string, { incoming: [number, number]; outgoing: [number, number]; kinds: Kind[]; spread: number; flagRate: number }> = {
  severe: { incoming: [3, 5], outgoing: [2, 4], kinds: ['cancel', 'escalation', 'delay', 'passed', 'sentiment', 'dropped', 'negwords'], spread: 12, flagRate: 0.85 },
  rough: { incoming: [2, 3], outgoing: [1, 3], kinds: ['delay', 'passed', 'sentiment', 'negwords', 'escalation', 'dropped'], spread: 14, flagRate: 0.8 },
  mild: { incoming: [1, 3], outgoing: [1, 2], kinds: ['short', 'negwords', 'delay', 'dropped', 'passed'], spread: 20, flagRate: 0.9 },
  calm: { incoming: [0, 2], outgoing: [1, 3], kinds: [], spread: 25, flagRate: 0 },
  /** Bad a month ago, quiet since: shows up in "vs last 30 days". */
  recovered: { incoming: [3, 4], outgoing: [1, 2], kinds: ['cancel', 'delay', 'sentiment', 'passed'], spread: 10, flagRate: 0.8 },
};
const MIX = ['severe', 'severe', 'severe', 'rough', 'rough', 'rough', 'rough', 'mild', 'mild', 'mild', 'mild', 'calm', 'calm', 'calm', 'calm', 'calm', 'recovered', 'recovered'];

export interface SampleSet {
  orders: Order[];
  calls: Call[];
  asOf: string;
}

function build(lob: Lob, now: number): SampleSet {
  const r = rng(lob === 'ortho' ? 1717 : 4242);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const areas = SEQUENCES[lob];
  // Profile details draw from their own sequence, so adding fields never changes the calls or scores.
  const pr = rng(lob === 'ortho' ? 91 : 92);
  const pp = <T,>(a: readonly T[]) => a[Math.floor(pr() * a.length)];
  const orders: Order[] = [];
  const calls: Call[] = [];

  MIX.forEach((profileKey, i) => {
    const p = PROFILES[profileKey];
    const patient = `${FIRST[(i * 7 + (lob === 'ortho' ? 0 : 3)) % FIRST.length]} ${LAST[(i * 5 + (lob === 'ortho' ? 1 : 8)) % LAST.length]}`;
    const opened = now - between(35, 110) * DAY;
    // Where the order sits now: most trouble collects in the middle of the sequence.
    const current = Math.min(areas.length - 1, profileKey === 'calm' ? between(0, areas.length - 1) : between(1, 4));
    const history: StatusStep[] = [];
    const span = now - opened;
    for (let a = 0; a <= current; a++) {
      // Each step ends a little before the next; the current step started 2-15 days ago.
      const from = a === current ? now - between(2, 15) * DAY : opened + Math.floor((span * a) / (current + 1));
      history.push({ area: areas[a].name, status: pick(areas[a].statuses), from: new Date(from).toISOString() });
    }
    const order: Order = {
      id: `${lob}-${i + 1}`,
      lob,
      patient,
      orderNumber: `${lob === 'ortho' ? 'OR' : 'CR'}-${String(48210 + i * 37).padStart(6, '0')}`,
      payer: pick(PAYERS),
      phones: {
        primary: `(555) 01${i % 10}-${String(2000 + i * 13).slice(-4)}`,
        alternate: r() > 0.5 ? `(555) 02${i % 10}-${String(3100 + i * 7).slice(-4)}` : null,
        caregiver: r() > 0.6 ? `(555) 03${i % 10}-${String(4200 + i * 11).slice(-4)}` : null,
      },
      openedOn: new Date(opened).toISOString(),
      rep: pick(REPS),
      hrc: pick(AGENTS),
      surgeryDate: lob === 'ortho' ? new Date(opened + between(20, 60) * DAY).toISOString() : null,
      profile: (() => {
        const [city, state, zip] = pp(PLACES);
        // Auth sits third in both sequences (Pending Auth / Insurance Eligibility).
        const authStatus = current < 2 ? 'Not started' : current === 2 ? 'Submitted, pending decision' : 'Approved';
        const deliveryArea = areas.findIndex(a => a.name.startsWith('CFD'));
        return {
          dob: new Date(now - (Math.floor(pr() * 35) + (lob === 'ortho' ? 45 : 50)) * 365.25 * DAY - Math.floor(pr() * 300) * DAY).toISOString(),
          address: { street: `${100 + Math.floor(pr() * 8900)} ${pp(STREETS)}`, city, state, zip },
          language: pr() > 0.8 ? 'Spanish' : 'English',
          procedure: pp(PROCEDURES[lob]),
          physician: pp(PHYSICIANS),
          facility: pp(FACILITIES[lob]),
          memberId: `${pp(['W', 'H', 'X', 'U'])}${Math.floor(100000000 + pr() * 899999999)}`,
          authStatus,
          delivery:
            lob === 'ortho' && deliveryArea >= 0 && current >= deliveryArea
              ? current === deliveryArea
                ? { date: new Date(now + (2 + Math.floor(pr() * 8)) * DAY).toISOString(), done: false }
                : { date: new Date(Date.parse(history[deliveryArea + 1]?.from || new Date(now).toISOString())).toISOString(), done: true }
              : null,
          dischargeDate: lob === 'cardiac' ? new Date(opened - (1 + Math.floor(pr() * 5)) * DAY).toISOString() : null,
        };
      })(),
      history,
    };
    orders.push(order);

    const phoneTypes = (['primary', 'alternate', 'caregiver'] as PhoneType[]).filter(t => order.phones[t]);
    // "recovered" orders had their trouble 32-45 days ago; everything else is recent.
    const offset = profileKey === 'recovered' ? between(32, 38) : 0;
    const makeCall = (direction: Call['direction'], n: number, flagged: boolean): Call => {
      const daysAgo = offset + (n === 0 && profileKey !== 'calm' ? between(0, profileKey === 'severe' ? 1 : 6) : between(0, p.spread));
      const at = daysAgo === 0 ? now - between(20, 300) * 60_000 : now - daysAgo * DAY - between(0, 8) * 3_600_000;
      const kinds: Kind[] = flagged ? [...new Set([pick(p.kinds), ...(r() > 0.75 ? [pick(p.kinds)] : [])])] : [];
      const agent = pick(AGENTS);
      const dropped = kinds.includes('dropped');
      const short = kinds.includes('short');
      // Draws the first version of the transcripts made here; kept so the sample orders keep their scores.
      const spokenWithLines = kinds.filter(k => ['cancel', 'delay', 'escalation', 'passed', 'negwords'].includes(k)).length;
      for (let d = 0, n = 2 + spokenWithLines * 2 + (dropped || short ? 0 : 1); d < n; d++) r();
      const source = pick(CALL_SOURCES);
      const team = pick(TEAMS);
      const angry = kinds.includes('sentiment');
      const script = buildTranscript({
        rand: rng((lob === 'ortho' ? 7000 : 9000) + calls.length * 7919),
        lob, direction, kinds, agent, team,
        patient: order.patient,
        area: statusAt(order, new Date(at).toISOString()).area,
        address: order.profile.address,
        memberId: order.profile.memberId,
        procedure: order.profile.procedure,
      });
      return {
        id: `${order.id}-c${calls.length + 1}`,
        orderId: order.id,
        at: new Date(at).toISOString(),
        direction,
        durationSec: script.durationSec,
        source,
        agent,
        team,
        phoneType: direction === 'Incoming' ? pick(phoneTypes) : 'primary',
        endedEarly: dropped,
        systemDisconnect: dropped && r() > 0.6,
        negativeShare: angry ? between(42, 78) : between(0, 22),
        endedWorse: angry && r() > 0.5,
        summary: kinds.length
          ? `${direction === 'Incoming' ? 'Patient called' : 'We called'}; ${kinds.map(k => SUMMARY[k]).join(', ')}.`
          : direction === 'Incoming' ? 'Patient called with a status question; answered.' : 'Outreach call; next steps confirmed.',
        transcript: script.turns,
      };
    };
    const nIn = between(...p.incoming);
    for (let n = 0; n < nIn; n++) calls.push(makeCall('Incoming', n, r() < p.flagRate));
    const nOut = between(...p.outgoing);
    for (let n = 0; n < nOut; n++) calls.push(makeCall('Outgoing', n + 1, r() < p.flagRate / 3));
  });

  return { orders, calls, asOf: new Date(now).toISOString() };
}

const cache = new Map<Lob, SampleSet>();
export function sampleData(lob: Lob): SampleSet {
  let set = cache.get(lob);
  if (!set) cache.set(lob, (set = build(lob, Date.now())));
  return set;
}
