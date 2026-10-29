'use client';

import React, { useMemo, useState } from 'react';
import { Info, Search } from 'lucide-react';
import { TEAMS, type Lob } from '../../config/callReview';
import { orderHealth } from '../../lib/callReview/model';
import { fmtDuration, type Order, type ScoredCall } from '../../lib/callReview/scoring';
import { CallReviewFrame, FlagPill, SampleNote, useLob } from './CallReviewFrame';
import { FlagQuote, Transcript, type TranscriptFocus } from './OrderDrawer';
import { useCallReviewSettings } from './useCallReviewSettings';

/**
 * Call Review > Calls. This screen exists in ROM CRM today and keeps its layout:
 * a searchable call list on the left, the selected call on the right with
 * Summary, Scoring and Transcript tabs, and a team switch at the top. Here the
 * scoring shown is the Call Review health flags, from the same settings.
 */

type Row = ScoredCall & { order: Order };

/** Calls from the last two hours haven't been scored yet, as with today's queue. */
const QUEUE_MS = 2 * 3_600_000;
const isQueued = (c: Row) => Date.now() - Date.parse(c.at) < QUEUE_MS;

/** The phone queue the call came through (sample naming, after today's CXone queues). */
const queueOf = (c: Row, lob: Lob) => {
  if (c.direction === 'Outgoing') return 'CS - Outbound';
  if (lob === 'ortho') return c.area === 'CFD—Awaiting Delivery' ? 'Ortho Delivery Pickup' : 'Ortho General';
  return c.area === 'Logistics' ? 'Cardiac Logistics' : 'Cardiac General';
};

/** 2026-10-29 19:37 */
const stamp = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const mono = 'font-mono tabular-nums';

/** A 12-digit call ID in the style of today's CXone contact IDs (sample). */
const callNumber = (c: Row) => String(721036800000 + [...c.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 999_983, 7));

export const CallsList: React.FC = () => {
  const [lob] = useLob();
  const { settings } = useCallReviewSettings();
  const [team, setTeam] = useState('');
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const calls = useMemo<Row[]>(
    () =>
      orderHealth(lob, settings[lob])
        .flatMap(r => r.calls.map(c => ({ ...c, order: r.order })))
        .sort((a, b) => b.at.localeCompare(a.at)),
    [lob, settings],
  );
  const needle = q.trim().toLowerCase();
  const visible = calls.filter(
    c =>
      (!team || c.team === team) &&
      (!needle || [c.order.patient, c.order.orderNumber, c.agent, c.summary, ...c.transcript.map(t => t.text)].some(x => x.toLowerCase().includes(needle))),
  );
  const selected = visible.find(c => c.id === selectedId) || visible[0] || null;

  return (
    <CallReviewFrame
      subtitle="Every call, with its summary, scoring and transcript"
      controls={
        <div role="group" aria-label="Team" className="flex p-[3px] bg-slate-100 rounded-lg">
          {[['', 'All calls'], ...TEAMS.map(t => [t, t])].map(([v, l]) => (
            <button
              key={l}
              type="button"
              aria-pressed={team === v}
              onClick={() => setTeam(v)}
              className={`px-3.5 py-1.5 rounded-md text-[14px] cursor-pointer transition ${team === v ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {l}
            </button>
          ))}
        </div>
      }
    >
      <div className="mt-5 bg-white border border-slate-200 rounded-xl flex flex-col md:flex-row min-h-[640px] overflow-hidden">
        {/* Left: call list */}
        <div className="md:w-[420px] shrink-0 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50 flex flex-col">
          <form
            className="flex items-center gap-2 p-3 border-b border-slate-200 bg-white"
            onSubmit={e => { e.preventDefault(); setQ(draft); }}
          >
            <label className="relative flex-1 min-w-0">
              <span className="sr-only">Search all transcripts</span>
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={draft}
                onChange={e => { setDraft(e.target.value); if (!e.target.value) setQ(''); }}
                placeholder="Search all transcripts"
                className="w-full h-9 pl-8 pr-2 rounded-lg border border-slate-200 bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600"
              />
            </label>
            <button type="submit" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[14px] text-slate-600 hover:bg-slate-50 cursor-pointer">Search</button>
            <span title="Searches patient, order #, rep, summary and every transcript line." className="w-6 h-6 inline-flex items-center justify-center rounded-full border border-slate-200 text-slate-600">
              <Info className="w-3.5 h-3.5" />
            </span>
          </form>
          <p className="px-4 py-3 text-[13px] text-slate-600 border-b border-slate-200">{visible.length} of {calls.length} calls</p>
          <ol className="flex-1 overflow-y-auto max-h-[720px]">
            {visible.map(c => {
              const active = selected?.id === c.id;
              const queued = isQueued(c);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`w-full text-left flex gap-4 pl-4 pr-3 py-4 border-b border-slate-200 border-l-[3px] cursor-pointer transition ${
                      active ? 'bg-white border-l-slate-900' : 'border-l-transparent hover:bg-white'
                    }`}
                  >
                    <span className={`w-6 shrink-0 text-[14px] font-semibold ${mono} ${queued ? 'text-slate-500' : c.points ? 'text-[#a3241a]' : 'text-slate-500'}`}>
                      {queued ? '—' : c.points || '0'}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold text-slate-900">{queueOf(c, lob)}</span>
                      <span className="block text-[13px] text-slate-600 mt-0.5">
                        {c.agent} <span className={`${mono} ml-1`}>{fmtDuration(c.durationSec)}</span> <span className="ml-1">{stamp(c.at).slice(0, 10)}</span>
                      </span>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded-md border border-brand-200 bg-brand-50 text-brand-700 text-[12px] font-semibold">{c.team}</span>
                      <span className={`block mt-1.5 text-[12px] font-semibold tracking-wide ${queued ? 'text-[#a3241a]' : 'text-emerald-700'}`}>{queued ? 'QUEUED' : 'SCORED'}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!visible.length && <li className="px-4 py-6 text-[14px] text-slate-600">No calls match.</li>}
          </ol>
        </div>

        {/* Right: the selected call */}
        <div className="flex-1 min-w-0 px-6 md:px-8 py-7">{selected ? <CallDetail key={selected.id} call={selected} lob={lob} /> : <p className="text-slate-600">Pick a call.</p>}</div>
      </div>
      <SampleNote>This view exists in ROM CRM today; its layout stays as is. Calls, reps and transcripts here are made up, and the scoring shown is the Call Review health flags.</SampleNote>
    </CallReviewFrame>
  );
};

const CallDetail: React.FC<{ call: Row; lob: Lob }> = ({ call: c, lob }) => {
  const [tab, setTab] = useState<'summary' | 'scoring' | 'transcript'>('summary');
  const [focus, setFocus] = useState<TranscriptFocus | null>(null);
  const jumpTo = (line: number) => {
    setTab('transcript');
    setFocus(f => ({ line, n: (f?.n || 0) + 1 }));
  };
  const queued = isQueued(c);
  const status = queued ? 'QUEUED' : 'SCORED';
  return (
    <div className="max-w-[1050px]">
      <p className={`${mono} text-[13px] tracking-[0.12em] text-slate-600 uppercase`}>{callNumber(c)} · {c.team}</p>
      <h2 className="text-[26px] font-bold mt-2">{queueOf(c, lob)}</h2>
      <dl className="flex flex-wrap gap-x-7 gap-y-2.5 mt-3 text-[15px]">
        <Meta label="Caller">{c.direction === 'Incoming' ? c.order.patient : 'ROMTech'}</Meta>
        <Meta label="Rep">{c.agent}</Meta>
        <Meta label="Team">{c.team}</Meta>
        <Meta label="When">{stamp(c.at)}</Meta>
        <Meta label="Duration"><span className={mono}>{fmtDuration(c.durationSec)}</span></Meta>
        <Meta label="Status">{status}</Meta>
        <Meta label="Order">{c.order.orderNumber} · in {c.area}</Meta>
      </dl>

      <div className="mt-5 pt-6 border-t border-slate-200">
        <div className="px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl">
          {queued ? (
            <>
              <p className="font-semibold">Not scored</p>
              <p className="text-[14px] text-slate-600 mt-1">QUEUED</p>
            </>
          ) : (
            <>
              <p className="font-semibold">{c.flags.length ? `${c.points} points · ${c.flags.length} flag${c.flags.length === 1 ? '' : 's'}` : 'No flags'}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {c.flags.map(f => <FlagPill key={f.id} id={f.id} label={f.label} />)}
                {!c.flags.length && <span className="text-[14px] text-slate-600">SCORED</span>}
              </div>
            </>
          )}
        </div>

        <div role="tablist" className="flex gap-8 mt-6 border-b border-slate-200">
          {(['summary', 'scoring', 'transcript'] as const).map(k => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => { setTab(k); setFocus(null); }}
              className={`pb-2.5 -mb-px border-b-2 text-[15px] capitalize cursor-pointer ${tab === k ? 'border-slate-900 text-slate-900 font-semibold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="pt-5 text-[15px]">
          {tab === 'summary' && (
            queued ? <p className="text-slate-600">No scored moments for this call.</p> : (
              <div className="space-y-3">
                <p className="text-slate-800">{c.summary}</p>
                {c.flags.map(f => <FlagQuote key={f.id} flag={f} onJump={() => jumpTo(f.line)} />)}
              </div>
            )
          )}
          {tab === 'scoring' && (
            queued || !c.flags.length ? <p className="text-slate-600">No scored moments for this call.</p> : (
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] uppercase tracking-[0.06em] text-slate-500">
                    <th className="py-2 font-semibold">Flag</th>
                    <th className="py-2 font-semibold">Points</th>
                    <th className="py-2 font-semibold">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {c.flags.map(f => (
                    <tr key={f.id} className="border-t border-slate-200">
                      <td className="py-2.5 pr-4"><FlagPill id={f.id} label={f.label} /></td>
                      <td className={`py-2.5 pr-4 ${mono}`}>+{f.points}</td>
                      <td className="py-2.5 text-slate-700">
                        <button type="button" onClick={() => jumpTo(f.line)} title="Show this line in the transcript" className="text-left hover:text-brand-700 cursor-pointer">
                          <q>{f.snippet}</q> <span className="text-[12px] text-brand-600 font-semibold whitespace-nowrap">at {fmtDuration(f.at)} →</span>
                        </button>
                        {f.detail && <span className="block text-[12px] text-slate-500 mt-0.5">{f.detail}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {tab === 'transcript' && <Transcript turns={c.transcript} flags={queued ? [] : c.flags} focus={focus} />}
        </div>
      </div>
    </div>
  );
};

const Meta: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline gap-2">
    <dt className="text-[13px] uppercase tracking-[0.08em] text-slate-500">{label}</dt>
    <dd className="text-slate-900">{children}</dd>
  </div>
);
