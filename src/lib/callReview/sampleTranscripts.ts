import type { Lob } from '../../config/callReview';
import type { Turn } from './scoring';

/**
 * Made-up call transcripts, shaped like the real ones from CXone / RingCentral:
 * speaker turns with a running timestamp, long agent turns, filler words, the
 * identity check up front, and the odd speech-to-text slip ("Run Tech").
 *
 * Every line is invented. Flag trigger sentences are kept word for word so the
 * language flags have something exact to match.
 */

export type Kind = 'cancel' | 'escalation' | 'delay' | 'passed' | 'negwords' | 'sentiment' | 'dropped' | 'short';

export interface TranscriptInput {
  rand: () => number;
  lob: Lob;
  direction: 'Incoming' | 'Outgoing';
  kinds: Kind[];
  agent: string;
  team: string;
  patient: string;
  area: string;
  address: { street: string; city: string; state: string; zip: string };
  memberId: string;
  procedure: string;
}

// How the speech-to-text hears the company name, now and then.
const BRAND = ['ROMTech', 'ROMTech', 'ROMTech', 'Rom Tech', 'Run Tech', 'Rom Tech'];

/** Why the patient is calling, by where the order is. Caller turn, then the agent's answer. */
const TOPICS: Record<Lob, Record<string, [string, string][]>> = {
  ortho: {
    Intake: [[
      "Yeah, I got a voicemail from you guys about a, umm, a machine for my knee that my surgeon ordered, and I'm not really sure what it is.",
      "Of course. So your surgeon sent us an order for our at-home therapy device. It's a, uh, a bike-style unit you use after surgery with a therapist working with you remotely. Right now we're just getting the paperwork together, and once we have everything from the doctor's office, umm, we'll check it with your insurance and give you a call to go over it.",
    ]],
    Verification: [[
      "I got a letter, umm, about my insurance and I wanted to know if this is even covered, because I don't want to get a big bill.",
      "Absolutely, I understand. So right now your order is with our verification team. They're checking your benefits with your insurance, uh, to see what's covered and if there's any out of pocket. That usually takes a few business days, and once it's done your coordinator will call you with the details before anything is shipped.",
    ]],
    'Pending Auth': [[
      "My surgery's coming up and I just wanted to see if the, uh, the authorization went through yet.",
      "Let me take a look. OK, so I do see the authorization was submitted to your insurance, and we're waiting on a decision. Sometimes they come back in a couple of days and sometimes, umm, it can take a little longer. As soon as we hear back, uh, your coordinator will reach out to you.",
    ]],
    'Patient Sales': [[
      "Somebody called me about the program and I had some questions about, you know, what it's going to cost me and how long I have it.",
      "Sure, happy to help. So, umm, your insurance did approve it. Your coordinator can walk you through the exact cost share, but the program usually runs for the length your surgeon ordered, and the therapist sessions are all done at home on the tablet. I can have your coordinator give you a call back today to go over the numbers.",
    ]],
    'CFD—Awaiting Delivery': [[
      "Yeah, I'm due to have the unit delivered and I'm just checking if you have any idea what time it's coming.",
      "Alright, uh, just a moment, let me look at the notes. OK, so they'll be calling you the day before delivery, after about four o'clock Eastern, to confirm a four hour window. And then on the day of delivery they call, umm, about thirty minutes before they get there to let you know they're on their way.",
    ]],
    'Delivered, Awaiting Treatment': [[
      "The unit came yesterday and I'm not really sure how to get it set up, and when does the therapist call me?",
      "Great, glad it got there. So you don't need to set anything up on your own. Your therapist will call to schedule your first session, and they'll, uh, walk you through turning it on and getting the tablet connected. That first call usually happens within a day or two of delivery.",
    ]],
    Treatment: [[
      "The, umm, the tablet keeps freezing during my sessions and my therapist said to call you guys.",
      "I'm sorry about that. Let's try something real quick. Can you hold the power button on the side of the tablet for about ten seconds until it turns off, and then turn it back on? If it keeps happening, uh, I'll put in a ticket and we can send you a replacement tablet.",
    ]],
    Billing: [[
      "I got a bill in the mail and I don't understand it, I thought my insurance was covering this.",
      "I understand, let me pull up the claim. OK, so what I'm seeing is your insurance processed it and applied part of it to your deductible. That's the amount on the statement. I can send you an itemized copy, and if you'd like, uh, our billing team can set up a payment plan.",
    ]],
  },
  cardiac: {
    Intake: [[
      "The hospital told me somebody would call me about doing the cardiac rehab at home, and nobody has yet.",
      "Thank you for letting us know. I do see the referral came in from the hospital. Right now we're gathering your records from your cardiologist, and once we have those, umm, a coordinator will call you to explain how the program works and get you scheduled.",
    ]],
    'Clinical Eligibility': [[
      "You guys asked for some records from my cardiologist and I wanted to see if you got them.",
      "Let me check. OK, so we did receive part of it. We're still missing the, uh, the most recent stress test results. I'll send another request to your cardiologist's office today, and if you want, you can give them a call too, which sometimes speeds things up.",
    ]],
    'Insurance Eligibility': [[
      "I'm checking whether my insurance approved the cardiac rehab yet.",
      "Of course. So the request is with your insurance right now. We sent everything over and we're, umm, waiting on their decision. Once we hear back, your coordinator will call you, and if they need anything else from your doctor, we'll take care of that.",
    ]],
    'Go/No-Go': [[
      "I was told there's some kind of review and I wanted to know if I'm approved to start.",
      "Yes, so our clinical team does a final review to make sure the home program is safe for you. It's scheduled for this week. Once it's done, uh, your coordinator will call you with the result and the next steps.",
    ]],
    Logistics: [[
      "I'm calling about when the equipment is getting delivered.",
      "Sure, let me look. OK, so delivery has been requested and the courier will call you to set up a time. They usually reach out, umm, one to two days before to confirm a window.",
    ]],
    'Enrolled in CR': [[
      "I have a question about my session schedule this week, I have a doctor's appointment on Thursday.",
      "No problem at all. I'll let your therapist know about Thursday, and they'll move that session. They'll, uh, send you the new time through the app.",
    ]],
    Discharge: [[
      "I finished the program and I got a survey and the equipment pickup thing, and I had a question about that.",
      "Congratulations on finishing. So for the pickup, the courier will call to schedule a time, and the survey is optional, but it really helps us. Is there anything else on the pickup I can help with?",
    ]],
  },
};

/** Caller sentences that trip each flag. Kept exact: the language flags match them. */
const TRIGGERS: Record<Lob, Partial<Record<Kind, string[]>>> = {
  ortho: {
    cancel: ['Honestly, at this point I just want to cancel the whole thing.', "If it's not here by Friday, cancel my order.", "Just don't send it, I'll figure something else out."],
    delay: ["I'm still waiting on the device and my surgery is next week.", "I haven't received anything, not even a call.", "Where's my device? I was told it was coming Monday."],
  },
  cardiac: {
    cancel: ["I think I'm going to cancel before this even starts.", "My cardiologist said I could do it at the hospital, so I'd like to stop the program.", 'I want to drop out, this is too much hassle.'],
    delay: ["I'm still waiting to hear about a start date.", "I haven't heard from anyone since I left the hospital.", 'When do I start? Nobody has told me anything.'],
  },
};
const SHARED: Partial<Record<Kind, string[]>> = {
  sentiment: ["I've been on hold forever and nobody seems to know anything.", "I'm tired of chasing this, it's the worst experience I've had.", 'Honestly this has been a waste of my whole week.'],
  escalation: ['Can I please speak to a supervisor?', "I'm going to file a complaint about this.", 'Put your manager on, please.', "If this keeps up I'm calling a lawyer."],
  passed: ['I already told someone all of this yesterday.', 'Nobody called me back like they promised.', "That's the third time I've been transferred again today."],
  negwords: ["I'm really frustrated with how this has gone.", 'This is ridiculous.', "I'm upset, to be honest with you."],
};
/** What the caller says around a trigger sentence, so it reads like speech. */
const LEAD_IN = ['Yeah, umm.', 'OK, but see, here is the thing.', 'Look.', 'I mean.', 'Well.'];
const FOLLOW_ON = ["I've called about this more than once.", 'I just need somebody to give me a straight answer.', 'My, uh, my daughter has been calling too.', "I don't know what else to do."];
const AGENT_REPLY: Record<Kind, string[]> = {
  cancel: ["I'm really sorry to hear that. Before we do anything, let me see if I can get you some answers, because I don't want you to lose out on the therapy your doctor ordered. Can you give me just a moment?"],
  escalation: ["I understand, and I'm sorry for the frustration. Let me see who's available. I'm going to place you on a brief hold while I get my supervisor, OK?"],
  delay: ["I completely understand. So what I'm seeing here is it's still, umm, waiting on a response. As soon as that comes back, somebody will reach out to you to schedule."],
  passed: ["I'm so sorry about that. I'm going to put a note on the account and send this directly to your coordinator so you're not getting passed around."],
  negwords: ["I hear you, and I'm sorry this has been such a process. Let's see what we can get done for you today."],
  sentiment: ["I'm really sorry. I know it's been a lot. Let me see what I can find out for you right now."],
  dropped: [],
  short: [],
};

/** A follow-up most calls have: caller checks what happens next; agent confirms contact details. */
const FOLLOW_UP: [string, string][] = [
  [
    'OK. And is there anything I need to do on my end, or do I just wait for the call?',
    "You don't need to do anything right now. Just, umm, make sure we have the right number for you, which we do, the one ending in the last four you gave me. And if you miss the call, they'll leave a voicemail with a callback number, and you can always call us here too, we're open, uh, eight to eight Eastern.",
  ],
  [
    'Alright. And who exactly is going to be calling me, is it you or somebody else?',
    "Good question. So it'll be your coordinator, that's who's assigned to your order. If for some reason you don't hear from them, umm, just call this number and any one of us can pull up your order and help you. Everything we talked about today is in the notes, so you won't have to explain it again.",
  ],
  [
    'Can you send me something in writing about all this? My, uh, my son helps me keep track of everything.',
    "Of course. I can send a text and an email with a summary of where things are. And if you'd like to add your son as a contact on the account, umm, I can do that today, I'd just need his name and phone number, and you'd need to give us the OK to speak with him.",
  ],
];

const WORDS_PER_SEC = 2.7;

export function buildTranscript(t: TranscriptInput): { turns: Turn[]; durationSec: number } {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(t.rand() * a.length)];
  const agentFirst = t.agent.split(' ')[0];
  const [patientFirst] = t.patient.split(' ');
  const brand = pick(BRAND);
  const raw: { speaker: Turn['speaker']; text: string }[] = [];
  const agent = (text: string) => raw.push({ speaker: 'Agent', text });
  const caller = (text: string) => raw.push({ speaker: 'Caller', text });
  const triggerTurn = (k: Kind) => {
    const pool = TRIGGERS[t.lob][k] || SHARED[k];
    if (!pool) return;
    caller([pick(LEAD_IN), pick(pool), pick(FOLLOW_ON)].join(' '));
    const reply = AGENT_REPLY[k];
    if (reply.length) agent(pick(reply));
  };
  const spoken = t.kinds.filter(k => k !== 'dropped' && k !== 'short');
  const [topicAsk, topicAnswer] = pick(TOPICS[t.lob][t.area] || TOPICS[t.lob].Intake);

  if (t.kinds.includes('short')) {
    // Caller can't talk; a few seconds and done.
    agent(`Thank you for calling ${brand}, this is ${agentFirst}. How can I help you?`);
    caller(spoken.length ? `${pick((TRIGGERS[t.lob][spoken[0]] || SHARED[spoken[0]])!)} Just have somebody call me back.` : "Oh, I'm sorry, I'm driving right now. Can somebody call me back later?");
    agent("Absolutely, we'll have someone reach out. Thank you, bye bye.");
    return timed(raw, t);
  }

  if (t.direction === 'Incoming') {
    agent(`Thank you for calling ${brand}. This is ${agentFirst}, ${t.team.toLowerCase()}. May I please have the patient's first and last name?`);
    caller(`Yeah, ${t.patient}, ${t.address.street}, ${t.address.city}, ${t.address.state} ${t.address.zip}. And the, uh, the number on the card is ${t.memberId}.`);
    agent('Thank you very much. And if you can please confirm your date of birth and the best phone number to reach you. Thank you. And how can I help you today?');
    caller(topicAsk);
    agent("Alright, uh, just a moment. Let me take a look in the notes. Let's see.");
    caller(pick(['Thank you so much.', 'Sure.', 'OK.']));
  } else {
    agent(`Hi, this is ${agentFirst} calling from ${brand} about the ${t.lob === 'ortho' ? 'therapy device' : 'cardiac rehab'} order for ${t.patient}. Is this ${patientFirst}?`);
    caller(pick(['Yes, speaking.', 'Yeah, this is.', "Yes. Who's this again?"]));
    agent("Great. Before we go on, can you just confirm your date of birth for me? Thank you. I'm just calling with an update on your order and to see if you have any questions.");
    caller(pick(['OK, yeah, go ahead.', 'Sure, what is it?', 'Oh, OK. Good.']));
  }

  if (t.kinds.includes('dropped')) {
    // The line cuts out mid-answer.
    spoken.forEach(triggerTurn);
    agent('So what I\'m seeing here is, umm, it looks like the');
    return timed(raw, t);
  }

  agent(topicAnswer);
  const [ask, answer] = pick(FOLLOW_UP);
  caller(ask);
  agent(answer);
  spoken.forEach(triggerTurn);
  if (!spoken.length) {
    caller(pick(['OK, OK. That makes sense.', 'Alright. That helps, thank you.', "Got it. So I don't need to do anything right now?"]));
    agent(pick(["That's right. We'll reach out with any updates, and you can always call us back at this number.", 'Not at all. Is there anything else I can help you with today?']));
  } else {
    caller(pick(['OK. Fine.', "Alright. I'll wait for the call, I guess.", 'Yeah. OK.']));
    agent("I've put all of this in the notes. Is there anything else I can help you with today?");
  }
  caller(pick(['No, that was it. Thank you.', 'Alright. OK. Well, thank you. Bye bye.', "No, that's all."]));
  agent(`You're welcome. Thank you very much. Thanks for calling ${pick(BRAND)}. Bye bye.`);
  return timed(raw, t);
}

/** Running timestamps from speaking time plus a short pause per turn. */
function timed(raw: { speaker: Turn['speaker']; text: string }[], t: TranscriptInput) {
  let at = 0;
  const turns: Turn[] = raw.map(r => {
    const turn: Turn = { speaker: r.speaker, name: r.speaker === 'Agent' ? t.agent : 'Caller', at: Math.round(at), text: r.text };
    at += r.text.split(/\s+/).length / WORDS_PER_SEC + 1 + t.rand() * 2.5;
    return turn;
  });
  return { turns, durationSec: Math.max(8, Math.round(at)) };
}
