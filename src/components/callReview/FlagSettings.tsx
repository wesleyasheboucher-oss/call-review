'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  DEFAULT_SETTINGS, PHONE_TYPES, SEQUENCES, WEIGHTS, WEIGHT_POINTS, lobLabel,
  type Band, type Direction, type LanguageFlag, type Lob, type Settings, type Weight,
} from '../../config/callReview';
import { countBands, orderHealth } from '../../lib/callReview/model';
import { fmtWhen } from '../../lib/callReview/scoring';
import { useCurrentUserName } from '../shell/currentUser';
import { BandPill, CallReviewFrame, SampleNote, crCard, crTh, useLob } from './CallReviewFrame';
import { describeChanges, useCallReviewSettings } from './useCallReviewSettings';

/**
 * Call Review > Flag settings (BRD section 7): the maintenance screen where the
 * flags and scoring are set, separately for Ortho and Cardiac. Edits are a draft
 * until saved; the preview scores the sample orders with the draft.
 */

const WINDOWS: [string, string][] = [['7', '7 days'], ['14', '14 days'], ['30', '30 days'], ['60', '60 days'], ['90', '90 days'], ['life', 'Life of the order']];
const RESETS: [string, string][] = [['7', '7 days with no flags'], ['14', '14 days with no flags'], ['30', '30 days with no flags'], ['60', '60 days with no flags'], ['never', 'Never']];
const BAND_ORDER: Band[] = ['Poor', 'At risk', 'Watch'];

const input = 'block w-full mt-1.5 h-[38px] px-2.5 border border-slate-300 rounded-lg bg-white text-[14px] font-normal focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600';
const fieldLabel = 'text-[13px] font-semibold';

export const FlagSettings: React.FC = () => {
  const [lob] = useLob();
  const store = useCallReviewSettings();
  const [drafts, setDrafts] = useState<Partial<Record<Lob, Settings>>>({});
  const saved = store.settings[lob];
  const draft = drafts[lob] || saved;
  const changed = describeChanges(saved, draft);
  const set = (fn: (d: Settings) => void) => {
    const next = structuredClone(draft);
    fn(next);
    setDrafts(ds => ({ ...ds, [lob]: next }));
  };
  const discard = () => setDrafts(ds => ({ ...ds, [lob]: undefined }));

  const b = draft.bands;
  const bandError = !(b.poor > b.risk && b.risk > b.watch && b.watch > 0) ? 'Bands must run Poor > At risk > Watch > 0.' : null;
  const multError = draft.repeat.multipliers.some(m => !(m.x >= 1) || !(m.calls >= 1)) ? 'Multipliers must be 1 or more, on 1 or more calls.' : null;
  const error = bandError || multError;

  const before = useMemo(() => countBands(orderHealth(lob, saved)), [lob, saved]);
  const after = useMemo(() => countBands(orderHealth(lob, draft)), [lob, draft]);
  const who = useCurrentUserName();
  const last = store.log.find(l => l.lob === lob);
  const history = store.log.filter(l => l.lob === lob);

  return (
    <CallReviewFrame
      subtitle="Flag settings decide which calls count against an order and how much"
      actions={
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[13px] text-slate-600">{last ? `Last changed by ${last.by} · ${fmtWhen(last.at)}` : 'Starting values, not changed yet'}</span>
          <button type="button" disabled={!changed.length} onClick={discard} className="h-[38px] px-3.5 border border-slate-200 bg-white rounded-lg text-[14px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50">
            Discard
          </button>
          <button
            type="button"
            disabled={!changed.length || !!error}
            onClick={() => { store.save(lob, draft, who); discard(); }}
            className="h-[38px] px-4 bg-brand-700 hover:bg-brand-800 rounded-lg text-[14px] font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save changes
          </button>
        </div>
      }
    >
      <p className="mt-3.5 px-3.5 py-2.5 bg-brand-50 border border-brand-100 rounded-lg text-[14px] text-brand-900">
        You're editing <b>{lobLabel(lob)}</b> settings. Ortho and Cardiac keep separate flags, time windows and scoring.
      </p>

      {/* What the draft would do */}
      {changed.length > 0 && (
        <div className="mt-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-[14px] flex flex-wrap items-center gap-x-5 gap-y-2">
          <span><b>Unsaved:</b> {changed.join(', ')}.</span>
          <span className="flex flex-wrap items-center gap-3">
            With these changes:
            {BAND_ORDER.map(band => (
              <span key={band} className="inline-flex items-center gap-1.5">
                <BandPill band={band} /> {before[band]} → <b>{after[band]}</b>
              </span>
            ))}
          </span>
        </div>
      )}
      {error && <p className="mt-3 px-4 py-2.5 bg-[#fde8e6] border border-[#f5c2bd] rounded-lg text-[14px] text-[#a3241a]">{error}</p>}

      <div className="grid gap-4 mt-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))' }}>
        {/* Repeat calls */}
        <section className={`${crCard} p-5`}>
          <h2 className="text-[16px] font-semibold">Repeat calls on the same order</h2>
          <p className="text-[13px] text-slate-600 mt-1.5 mb-4">Counts incoming calls from any phone number on the order.</p>
          <fieldset className="mb-4">
            <legend className={`${fieldLabel} mb-2`}>Phone numbers to match</legend>
            <div className="flex flex-wrap gap-3.5 text-[14px]">
              {PHONE_TYPES.map(p => (
                <label key={p.key} className="flex gap-1.5 items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    checked={draft.repeat.phones.includes(p.key)}
                    onChange={e => set(d => { d.repeat.phones = e.target.checked ? [...d.repeat.phones, p.key] : d.repeat.phones.filter(x => x !== p.key); })}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className={fieldLabel}>
              Counts as repeat at (incoming calls with flags)
              <input type="number" min={1} value={draft.repeat.count} onChange={e => set(d => { d.repeat.count = Math.max(1, Number(e.target.value)); })} className={input} />
            </label>
            <label className={fieldLabel}>
              Within
              <select value={draft.repeat.windowDays === null ? 'life' : String(draft.repeat.windowDays)} onChange={e => set(d => { d.repeat.windowDays = e.target.value === 'life' ? null : Number(e.target.value); })} className={input}>
                {WINDOWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          <h3 className={`${fieldLabel} mt-[18px] mb-2`}>Multiplier on the poor-health signal</h3>
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-slate-600 text-[12px]">
                <th scope="col" className="py-1.5 font-semibold">Incoming calls with flags, at least</th>
                <th scope="col" className="py-1.5 font-semibold">Multiplier</th>
                <th scope="col"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {draft.repeat.multipliers.map((m, i) => (
                <tr key={i} className="border-t border-slate-200">
                  <td className="py-2">
                    <input type="number" min={1} aria-label="Calls" value={m.calls} onChange={e => set(d => { d.repeat.multipliers[i].calls = Number(e.target.value); })} className="w-20 h-8 px-2 border border-slate-300 rounded-md" /> calls
                  </td>
                  <td className="py-2">
                    × <input type="number" min={1} step={0.5} aria-label="Multiplier" value={m.x} onChange={e => set(d => { d.repeat.multipliers[i].x = Number(e.target.value); })} className="w-20 h-8 px-2 border border-slate-300 rounded-md" />
                  </td>
                  <td className="py-2 text-right">
                    <button type="button" title="Remove row" onClick={() => set(d => { d.repeat.multipliers.splice(i, 1); })} className="p-1.5 text-slate-500 hover:text-[#a3241a] cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => set(d => { const top = d.repeat.multipliers.at(-1); d.repeat.multipliers.push({ calls: (top?.calls || 1) + 1, x: (top?.x || 1) + 1 }); })}
            className="mt-2 text-[13px] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer"
          >
            + Add row
          </button>
        </section>

        {/* Dropped, short, sentiment */}
        <section className={`${crCard} p-5`}>
          <h2 className="text-[16px] font-semibold">Dropped and short calls</h2>
          <p className="text-[13px] text-slate-600 mt-1.5 mb-4">Uses call length and direction from CXone and RingCentral.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className={fieldLabel}>
              Short call is under (seconds)
              <input type="number" min={0} value={draft.calls.shortSec} onChange={e => set(d => { d.calls.shortSec = Number(e.target.value); })} className={input} />
            </label>
            <label className={fieldLabel}>
              Dropped means
              <select value={draft.calls.dropped} onChange={e => set(d => { d.calls.dropped = e.target.value as Settings['calls']['dropped']; })} className={input}>
                <option value="unresolved">Ended before resolution</option>
                <option value="system">Disconnected by system</option>
              </select>
            </label>
            <WeightField label="Dropped incoming weight" value={draft.calls.droppedIncoming} onChange={w => set(d => { d.calls.droppedIncoming = w; })} />
            <WeightField label="Dropped outgoing weight" value={draft.calls.droppedOutgoing} onChange={w => set(d => { d.calls.droppedOutgoing = w; })} />
            <WeightField label="Short call weight" value={draft.calls.short} onChange={w => set(d => { d.calls.short = w; })} />
          </div>

          <h2 className="text-[16px] font-semibold mt-6">Sentiment</h2>
          <p className="text-[13px] text-slate-600 mt-1.5 mb-4">Read across the whole call, caller's side only. Not single words.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className={fieldLabel}>
              Flag when negative for over (% of the call)
              <input type="number" min={0} max={100} value={draft.sentiment.sharePct} onChange={e => set(d => { d.sentiment.sharePct = Number(e.target.value); })} className={input} />
            </label>
            <label className={fieldLabel}>
              Or when the call ends
              <select value={draft.sentiment.endedWorse ? 'yes' : 'no'} onChange={e => set(d => { d.sentiment.endedWorse = e.target.value === 'yes'; })} className={input}>
                <option value="yes">More negative than it started</option>
                <option value="no">Not used</option>
              </select>
            </label>
            <WeightField label="Weight" value={draft.sentiment.weight} onChange={w => set(d => { d.sentiment.weight = w; })} />
          </div>
        </section>
      </div>

      {/* Language flags */}
      <section className={`${crCard} mt-4`}>
        <div className="flex flex-wrap justify-between items-center gap-2.5 px-5 py-[18px] border-b border-slate-200">
          <div>
            <h2 className="text-[16px] font-semibold">Language flags</h2>
            <p className="text-[13px] text-slate-600 mt-1">
              Matched on the caller's side. Phrases include close variations (cancel → cancelled, cancelling). A flag can be limited to some areas of the order.
            </p>
          </div>
          <button
            type="button"
            onClick={() => set(d => { d.language.push({ id: `custom-${Date.now()}`, name: 'New flag', on: true, phrases: [], weight: 'Medium', direction: 'Incoming', areas: [] }); })}
            className="inline-flex items-center gap-1 h-9 px-3.5 border border-brand-200 bg-brand-50 rounded-lg text-[14px] font-semibold text-brand-700 cursor-pointer hover:bg-brand-100"
          >
            <Plus className="w-4 h-4" /> Add flag
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-[14px]">
            <thead>
              <tr className="bg-slate-100">
                <th scope="col" className={`${crTh} pl-5`}>On</th>
                <th scope="col" className={crTh}>Flag</th>
                <th scope="col" className={crTh}>Phrases</th>
                <th scope="col" className={crTh}>Weight</th>
                <th scope="col" className={crTh}>Direction</th>
                <th scope="col" className={crTh}>Areas</th>
                <th scope="col" className={`${crTh} pr-5`}><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {draft.language.map((f, i) => (
                <FlagRow
                  key={f.id}
                  flag={f}
                  lob={lob}
                  onChange={fn => set(d => fn(d.language[i]))}
                  onRemove={() => set(d => { d.language.splice(i, 1); })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Health score bands */}
      <section className={`${crCard} mt-4 p-5`}>
        <h2 className="text-[16px] font-semibold">Health score bands</h2>
        <p className="text-[13px] text-slate-600 mt-1.5 mb-4">
          Score = flag points × repeat multiplier, capped at 100. Weights are worth High {WEIGHT_POINTS.High}, Medium {WEIGHT_POINTS.Medium}, Low {WEIGHT_POINTS.Low} points. Bands decide the pill on each order.
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {([['Poor', 'poor'], ['At risk', 'risk'], ['Watch', 'watch']] as const).map(([band, key]) => (
            <label key={key} className={fieldLabel}>
              <BandPill band={band} /> at or above
              <input type="number" min={1} max={100} value={b[key]} onChange={e => set(d => { d.bands[key] = Number(e.target.value); })} className={input} />
            </label>
          ))}
          <label className={fieldLabel}>
            Score resets after
            <select value={b.resetDays === null ? 'never' : String(b.resetDays)} onChange={e => set(d => { d.bands.resetDays = e.target.value === 'never' ? null : Number(e.target.value); })} className={input}>
              {RESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
      </section>

      {/* Change history */}
      <section className={`${crCard} mt-4 p-5`}>
        <div className="flex flex-wrap justify-between items-baseline gap-3">
          <h2 className="text-[16px] font-semibold">Change history · {lobLabel(lob)}</h2>
          {JSON.stringify(saved) !== JSON.stringify(DEFAULT_SETTINGS[lob]) && (
            <button type="button" onClick={() => { store.resetToDefaults(lob, who); discard(); }} className="text-[13px] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer">
              Reset to starting values
            </button>
          )}
        </div>
        {history.length ? (
          <ul className="mt-3 divide-y divide-slate-100 text-[14px]">
            {history.map((h, i) => (
              <li key={i} className="py-2 flex flex-wrap gap-x-4">
                <span className="text-slate-600 w-44">{fmtWhen(h.at)}</span>
                <span className="font-semibold w-40">{h.by}</span>
                <span>{h.summary}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-slate-600 mt-2">No changes yet. Every save records who made it and when.</p>
        )}
      </section>
      <SampleNote>Starting values and cardiac phrases are placeholders for ops to set. Saved in this browser only for the proof of concept.</SampleNote>
    </CallReviewFrame>
  );
};

const WeightField: React.FC<{ label: string; value: Weight; onChange: (w: Weight) => void }> = ({ label, value, onChange }) => (
  <label className={fieldLabel}>
    {label}
    <select value={value} onChange={e => onChange(e.target.value as Weight)} className={input}>
      {WEIGHTS.map(w => <option key={w} value={w}>{w === 'Off' ? 'Off' : `${w} (${WEIGHT_POINTS[w]} pts)`}</option>)}
    </select>
  </label>
);

const FlagRow: React.FC<{ flag: LanguageFlag; lob: Lob; onChange: (fn: (f: LanguageFlag) => void) => void; onRemove: () => void }> = ({ flag: f, lob, onChange, onRemove }) => {
  const [adding, setAdding] = useState('');
  const [areasOpen, setAreasOpen] = useState(false);
  const addPhrase = () => {
    const p = adding.trim();
    if (p && !f.phrases.includes(p)) onChange(x => { x.phrases.push(p); });
    setAdding('');
  };
  const small = 'h-8 px-2 border border-slate-300 rounded-md bg-white text-[14px]';
  return (
    <tr className={`border-t border-slate-200 ${f.on ? '' : 'opacity-60'}`}>
      <td className="pl-5 pr-3 py-3.5 align-top">
        <input type="checkbox" aria-label={`${f.name} on`} className="accent-brand-600 mt-2" checked={f.on} onChange={e => onChange(x => { x.on = e.target.checked; })} />
      </td>
      <td className="px-3 py-3.5 align-top">
        <input aria-label="Flag name" value={f.name} onChange={e => onChange(x => { x.name = e.target.value; })} className={`${small} font-semibold w-40`} />
      </td>
      <td className="px-3 py-3.5 align-top">
        <div className="flex flex-wrap gap-1.5 max-w-[400px] items-center">
          {f.phrases.map(p => (
            <span key={p} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-[3px] rounded-full bg-[#eef1f5] text-slate-700 text-[12px]">
              {p}
              <button type="button" aria-label={`Remove ${p}`} onClick={() => onChange(x => { x.phrases = x.phrases.filter(y => y !== p); })} className="p-0.5 rounded-full hover:bg-slate-200 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            value={adding}
            onChange={e => setAdding(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPhrase()}
            onBlur={addPhrase}
            placeholder="+ phrase"
            aria-label="Add phrase"
            className="w-28 px-2.5 py-[3px] border border-dashed border-slate-300 rounded-full bg-transparent text-[12px] placeholder:text-brand-700 focus:outline-none focus:border-brand-600"
          />
        </div>
      </td>
      <td className="px-3 py-3.5 align-top">
        <select aria-label="Weight" value={f.weight} onChange={e => onChange(x => { x.weight = e.target.value as Weight; })} className={small}>
          {WEIGHTS.filter(w => w !== 'Off').map(w => <option key={w}>{w}</option>)}
        </select>
      </td>
      <td className="px-3 py-3.5 align-top">
        <select aria-label="Direction" value={f.direction} onChange={e => onChange(x => { x.direction = e.target.value as Direction; })} className={small}>
          {(['Incoming', 'Outgoing', 'Both'] as Direction[]).map(d => <option key={d}>{d}</option>)}
        </select>
      </td>
      <td className="px-3 py-3.5 align-top relative">
        <button type="button" onClick={() => setAreasOpen(o => !o)} className="text-left text-slate-700 hover:text-brand-700 cursor-pointer max-w-[220px]">
          {f.areas.length ? f.areas.join(', ') : 'All areas'}
          <span className="block text-[12px] font-semibold text-brand-600">Edit</span>
        </button>
        {areasOpen && (
          <div className="absolute z-20 right-0 mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg p-3 space-y-1.5">
            {SEQUENCES[lob].map(a => (
              <label key={a.name} className="flex items-center gap-2 text-[14px] cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={f.areas.includes(a.name)}
                  onChange={e => onChange(x => { x.areas = e.target.checked ? [...x.areas, a.name] : x.areas.filter(y => y !== a.name); })}
                />
                {a.name}
              </label>
            ))}
            <p className="text-[12px] text-slate-500 pt-1">None ticked = all areas.</p>
            <button type="button" onClick={() => setAreasOpen(false)} className="text-[13px] font-semibold text-brand-600 cursor-pointer">Done</button>
          </div>
        )}
      </td>
      <td className="pl-3 pr-5 py-3.5 align-top text-right">
        <button type="button" title="Remove flag" onClick={onRemove} className="p-1.5 text-slate-500 hover:text-[#a3241a] cursor-pointer"><Trash2 className="w-4 h-4" /></button>
      </td>
    </tr>
  );
};
