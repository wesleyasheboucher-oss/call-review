'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { PHONE_TYPES, SEQUENCES, lobLabel } from '../../config/callReview';
import { fmtDay, fmtDuration, fmtWhen, type FlagHit, type Order, type OrderHealth, type ScoredCall, type Turn } from '../../lib/callReview/scoring';
import { BandPill, DirectionTag, FlagPill, crCard } from './CallReviewFrame';

/**
 * Drill-down on a flagged order (BRD section 7): where the order sits in its
 * sequence, why it's flagged, and every call with the area it happened in, the
 * flags it hit, the transcript line behind each flag, and who handled it.
 */
export const OrderDrawer: React.FC<{ row: OrderHealth; onClose: () => void }> = ({ row, onClose }) => {
  const { order } = row;
  const [show, setShow] = useState<'flagged' | 'all'>('flagged');
  const areas = SEQUENCES[order.lob];
  const currentIdx = areas.findIndex(a => a.name === row.area);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const callsByArea = useMemo(() => {
    const n: Record<string, number> = {};
    row.calls.forEach(c => (n[c.area] = (n[c.area] || 0) + 1));
    return n;
  }, [row.calls]);
  const flaggedCalls = row.calls.filter(c => c.flags.length);
  const shown = show === 'flagged' ? flaggedCalls : row.calls;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <section aria-label="Order call history" className="bg-slate-50 border-l border-slate-200 w-full md:w-[min(65rem,92vw)] h-full overflow-y-auto shadow-2xl animate-drawer-right">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-7 py-5 flex flex-wrap gap-4 items-start justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[24px] font-bold">{order.patient}</h2>
              <BandPill band={row.band}>{row.band === 'Healthy' ? 'Healthy' : `${row.band} health`} · Score {row.score}</BandPill>
              {row.multiplier > 1 && <span className="inline-flex px-2.5 py-[3px] rounded-full text-[12px] font-semibold bg-[#eef1f5] text-slate-700">×{row.multiplier} repeat multiplier</span>}
            </div>
            <p className="text-[14px] text-slate-600 mt-1.5">{order.orderNumber} · {lobLabel(order.lob)} · {order.payer}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-[38px] h-[38px] inline-flex items-center justify-center border border-slate-200 rounded-lg bg-white text-slate-600 hover:text-slate-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Where the order is */}
        <div className={`${crCard} mx-7 mt-6 px-5 py-[18px]`}>
          <div className="flex flex-wrap gap-7">
            <Fact label="Area" value={row.area} />
            <Fact label="Order status" value={row.status} />
            <Fact label="Owner" value={row.owner} />
            <Fact label="In this status" value={`${row.daysInStatus} day${row.daysInStatus === 1 ? '' : 's'}`} />
          </div>
          <ol aria-label={`${lobLabel(order.lob)} order sequence`} className="grid gap-1 mt-[18px]" style={{ gridTemplateColumns: `repeat(${areas.length}, minmax(0, 1fr))` }}>
            {areas.map((a, i) => (
              <li
                key={a.name}
                aria-current={i === currentIdx ? 'step' : undefined}
                className={`px-1.5 py-2 border-t-4 text-[12px] ${
                  i === currentIdx ? 'border-brand-700 font-bold text-brand-700' : i < currentIdx ? 'border-brand-300 text-slate-600' : 'border-slate-200 text-slate-600'
                }`}
              >
                {a.name}
                {callsByArea[a.name] ? <span className="block font-normal text-slate-500 mt-0.5">{callsByArea[a.name]} call{callsByArea[a.name] === 1 ? '' : 's'}</span> : null}
              </li>
            ))}
          </ol>
          <p className="text-[13px] text-slate-600 mt-2.5">Each call below shows the area the order was in when the call happened.</p>
        </div>

        <div className="flex flex-wrap gap-5 px-7 pt-5 pb-6 items-start">
          {/* Left: the order record and why it's flagged */}
          <aside className="flex-[1_1_300px] max-w-full flex flex-col gap-4">
            <OrderDetails order={order} />
            <div className={`${crCard} px-5 py-[18px]`}>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-600 mb-3">Why it's flagged</h3>
              <div className="flex flex-col gap-2.5 text-[14px]">
                {Object.entries(row.flagCounts).sort((a, b) => b[1] - a[1]).map(([label, n]) => (
                  <div key={label} className="flex justify-between"><span>{label}</span><b>{n} call{n === 1 ? '' : 's'}</b></div>
                ))}
                {!Object.keys(row.flagCounts).length && <span className="text-slate-600">No flags inside the scoring period.</span>}
                <div className="h-px bg-slate-200 my-1" />
                <div className="flex justify-between"><span>Incoming calls in repeat window</span><b>{row.incoming}</b></div>
                <div className="flex justify-between"><span>Incoming with flags</span><b>{row.incomingFlagged}</b></div>
                <div className="flex justify-between"><span>Outgoing calls</span><b>{row.outgoing}</b></div>
                <div className="h-px bg-slate-200 my-1" />
                <div className="text-[13px] text-slate-600">
                  Flag points <b className="text-slate-900">{row.base}</b> × repeat multiplier <b className="text-slate-900">{row.multiplier}</b> = score{' '}
                  <b className="text-slate-900">{row.score}</b>{row.base * row.multiplier > 100 ? ' (capped at 100)' : ''}
                </div>
              </div>
            </div>
          </aside>

          {/* Right: call timeline */}
          <div className={`${crCard} flex-[2_1_480px] min-w-0`}>
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-4 border-b border-slate-200">
              <h3 className="text-[16px] font-semibold">Calls on this order</h3>
              <div role="group" aria-label="Show" className="flex border border-slate-200 rounded-lg overflow-hidden text-[13px]">
                {(['flagged', 'all'] as const).map((k, i) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={show === k}
                    onClick={() => setShow(k)}
                    className={`px-3 py-[7px] cursor-pointer ${i ? 'border-l border-slate-200' : ''} ${show === k ? 'bg-brand-50 text-brand-700 font-semibold' : 'bg-white text-slate-700'}`}
                  >
                    {k === 'flagged' ? `Flagged ${flaggedCalls.length}` : `All ${row.calls.length}`}
                  </button>
                ))}
              </div>
            </div>
            <ol>
              {shown.map(c => <CallItem key={c.id} call={c} counted={row.countedIds.includes(c.id)} />)}
              {!shown.length && <li className="px-5 py-6 text-[14px] text-slate-600">No flagged calls on this order.</li>}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
};

const CallItem: React.FC<{ call: ScoredCall; counted: boolean }> = ({ call: c, counted }) => {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<TranscriptFocus | null>(null);
  const jumpTo = (line: number) => {
    setOpen(true);
    setFocus(f => ({ line, n: (f?.n || 0) + 1 }));
  };
  return (
    <li className="px-5 py-[18px] border-t border-slate-200 first:border-t-0 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <DirectionTag direction={c.direction} />
        <b className="text-[14px]">{fmtWhen(c.at)}</b>
        <span className="text-[13px] text-slate-600">{fmtDuration(c.durationSec)} · {c.source} · in {c.area}</span>
        <span className="ml-auto text-[13px] text-slate-700">{c.agent} · {c.team}</span>
      </div>
      {c.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {c.flags.map(f => <FlagPill key={f.id} id={f.id} label={f.label} title={`+${f.points} points`} />)}
          {!counted && <span className="text-[12px] text-slate-500">Not in score: before the last reset</span>}
        </div>
      )}
      {c.flags.map(f => <FlagQuote key={f.id} flag={f} onJump={() => jumpTo(f.line)} />)}
      {!c.flags.length && <p className="text-[14px] text-slate-600">{c.summary}</p>}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setFocus(null); }}
        className="self-start text-[13px] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer"
      >
        {open ? 'Hide transcript' : 'Open full transcript'}
      </button>
      {open && <Transcript turns={c.transcript} flags={c.flags} focus={focus} />}
    </li>
  );
};

/**
 * One flag's trigger: the exact transcript line, quoted. Clicking it opens the
 * transcript at that line.
 */
export const FlagQuote: React.FC<{ flag: FlagHit; onJump: () => void }> = ({ flag: f, onJump }) => (
  <button
    type="button"
    onClick={onJump}
    title="Show this line in the transcript"
    className="group w-full text-left px-3.5 py-3 bg-slate-100 hover:bg-brand-50 border border-transparent hover:border-brand-200 rounded-lg text-[14px] leading-normal text-slate-700 cursor-pointer transition"
  >
    <span className="flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 mb-1">
      {f.label}
      <span className="normal-case tracking-normal font-normal">· {f.speaker} at {fmtDuration(f.at)}</span>
      <span className="ml-auto normal-case tracking-normal font-semibold text-brand-600 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">Go to transcript →</span>
    </span>
    <q className="text-slate-800">{f.snippet}</q>
    {f.detail && <span className="block text-[12px] text-slate-500 mt-1">{f.detail}</span>}
  </button>
);

/** Which turn to scroll to; `n` changes on every click so the same turn can be jumped to again. */
export type TranscriptFocus = { line: number; n: number };

/** `text` with each of `marks` wrapped in <mark>. */
const withMarks = (text: string, marks: string[], strong: boolean) => {
  const out: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  for (;;) {
    const hits = marks.map(m => [rest.indexOf(m), m] as const).filter(([i]) => i >= 0).sort((x, y) => x[0] - y[0]);
    if (!hits.length) break;
    const [i, m] = hits[0];
    out.push(rest.slice(0, i), <mark key={key++} className={`rounded px-0.5 text-slate-900 ${strong ? 'bg-amber-200' : 'bg-amber-100'}`}>{m}</mark>);
    rest = rest.slice(i + m.length);
  }
  out.push(rest);
  return out;
};

/**
 * The call transcript as it comes from the phone system: speaker, time into the
 * call, then what they said. Sentences that triggered a flag are marked; the
 * focused turn is scrolled into view and outlined.
 */
export const Transcript: React.FC<{ turns: Turn[]; flags?: FlagHit[]; focus?: TranscriptFocus | null }> = ({ turns, flags = [], focus }) => {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (focus) refs.current[focus.line]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus]);
  return (
    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-[14px] max-h-[560px] overflow-y-auto">
      {turns.map((t, i) => {
        const marks = flags.filter(f => f.line === i).map(f => f.snippet);
        const focused = focus?.line === i;
        return (
          <div
            key={i}
            ref={el => { refs.current[i] = el; }}
            className={`px-4 py-3 transition ${focused ? 'bg-amber-50 ring-2 ring-inset ring-amber-400' : ''}`}
          >
            <div className="flex items-baseline gap-2.5">
              <span className={`font-semibold ${t.speaker === 'Caller' ? 'text-brand-700' : 'text-teal-700'}`}>{t.name}</span>
              <span className="text-[12px] text-slate-500 tabular-nums">{fmtDuration(t.at)}</span>
            </div>
            <p className="mt-1 leading-relaxed text-slate-800">{marks.length ? withMarks(t.text, marks, focused) : t.text}</p>
          </div>
        );
      })}
    </div>
  );
};

/** Key order data from the order record, stacked for the left column: patient, order, care team. */
const OrderDetails: React.FC<{ order: Order }> = ({ order }) => {
  const p = order.profile;
  const ortho = order.lob === 'ortho';
  const age = Math.floor((Date.now() - Date.parse(p.dob)) / (365.25 * 86_400_000));
  const heading = 'text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-600 mb-3';
  return (
    <section aria-label="Order details" className={`${crCard} divide-y divide-slate-200`}>
      <div className="px-5 py-[18px]">
        <h3 className={heading}>Patient</h3>
        <dl className="space-y-3 text-[14px]">
          <DlRow label="Date of birth" value={`${fmtDay(p.dob)} · ${age}`} />
          <DlRow label="Address" value={<>{p.address.street}<br />{p.address.city}, {p.address.state} {p.address.zip}</>} />
          {PHONE_TYPES.filter(t => order.phones[t.key]).map(t => (
            <DlRow key={t.key} label={t.label} value={order.phones[t.key]!} />
          ))}
          <DlRow label="Preferred language" value={p.language} />
        </dl>
      </div>
      <div className="px-5 py-[18px]">
        <h3 className={heading}>Order</h3>
        <dl className="space-y-3 text-[14px]">
          <DlRow label={ortho ? 'Procedure' : 'Diagnosis'} value={p.procedure} />
          {ortho && order.surgeryDate && <DlRow label="Surgery date" value={<b>{fmtDay(order.surgeryDate)}</b>} />}
          {!ortho && p.dischargeDate && <DlRow label="Hospital discharge" value={<b>{fmtDay(p.dischargeDate)}</b>} />}
          {ortho && (
            <DlRow
              label="Delivery"
              value={p.delivery ? `${p.delivery.done ? 'Delivered' : 'Scheduled'} ${fmtDay(p.delivery.date)}` : 'Not scheduled yet'}
            />
          )}
          <DlRow label="Payer · member ID" value={`${order.payer} · ${p.memberId}`} />
          <DlRow label="Authorization" value={p.authStatus} />
          <DlRow label="Order opened" value={`${fmtDay(order.openedOn)} · ${lobLabel(order.lob)}`} />
        </dl>
      </div>
      <div className="px-5 py-[18px]">
        <h3 className={heading}>Care team</h3>
        <dl className="space-y-3 text-[14px]">
          <DlRow label={ortho ? 'Surgeon' : 'Referring cardiologist'} value={p.physician} />
          <DlRow label="Facility" value={p.facility} />
          <DlRow label="Sales rep" value={order.rep} />
          <DlRow label="HRC" value={order.hrc} />
        </dl>
      </div>
    </section>
  );
};

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-[12px] text-slate-600">{label}</div>
    <div className="text-[18px] font-bold mt-0.5">{value}</div>
  </div>
);

const DlRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <dt className="text-[12px] text-slate-600">{label}</dt>
    <dd className="mt-0.5">{value}</dd>
  </div>
);
