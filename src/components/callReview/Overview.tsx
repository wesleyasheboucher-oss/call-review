'use client';

import React, { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { BAND_FILL, BAND_TEXT, SEQUENCES, TEAMS, lobLabel, type Band } from '../../config/callReview';
import { asOfNow, countBands, daysBefore, isFlagged, orderHealth } from '../../lib/callReview/model';
import { fmtWhen, type OrderHealth } from '../../lib/callReview/scoring';
import { BandPill, CallReviewFrame, FlagPill, SampleNote, crCard, crTh, useLob } from './CallReviewFrame';
import { OrderDrawer } from './OrderDrawer';
import { useCallReviewSettings } from './useCallReviewSettings';

/**
 * Call Review > Overview (BRD section 7), top to bottom:
 * 1. Headline numbers for leadership, in one strip.
 * 2. Where flagged orders sit: the order sequence, with each area's flagged
 *    orders split by band. Clicking an area filters the list.
 * 3. Flagged orders: filters, then the orders grouped by band, worst first.
 * The Ortho / Cardiac switch sets the context, so labels don't repeat it.
 */

type HealthFilter = 'flagged' | Band | 'all';
const PERIODS = [7, 30, 90] as const;
const FLAGGED_BANDS: Band[] = ['Poor', 'At risk', 'Watch'];
const GROUPS: Band[] = [...FLAGGED_BANDS, 'Healthy'];

export const Overview: React.FC = () => {
  const [lob] = useLob();
  const { settings } = useCallReviewSettings();
  const s = settings[lob];
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() || '';

  const [health, setHealth] = useState<HealthFilter>('flagged');
  const [area, setArea] = useState('');
  const [status, setStatus] = useState('');
  const [flag, setFlag] = useState('');
  const [team, setTeam] = useState('');
  const [period, setPeriod] = useState<number>(30);
  // Filters belong to one line of business; switching clears the ones that don't carry over.
  const [filtersFor, setFiltersFor] = useState(lob);
  if (filtersFor !== lob) {
    setFiltersFor(lob);
    setArea('');
    setStatus('');
    setFlag('');
  }
  const clearAll = () => {
    setHealth('flagged');
    setArea('');
    setStatus('');
    setFlag('');
    setTeam('');
    setPeriod(30);
  };

  const asOf = asOfNow(lob);
  const rows = useMemo(() => orderHealth(lob, s), [lob, s]);
  const prior = useMemo(() => countBands(orderHealth(lob, s, daysBefore(asOf, 30))), [lob, s, asOf]);
  const bands = countBands(rows);
  const repeatCallers = rows.filter(r => r.repeat).length;
  // Repeat callers whose calls keep hitting the same flag.
  const repeatSameFlag = rows.filter(r => r.repeat && r.repeatFlags.length);
  const topRepeatFlag = Object.entries(
    repeatSameFlag.flatMap(r => r.repeatFlags).reduce<Record<string, number>>((n, l) => ({ ...n, [l]: (n[l] || 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1])[0];

  // Flagged orders per area, split by band.
  const byArea: Record<string, Record<Band, number>> = {};
  rows.filter(isFlagged).forEach(r => {
    byArea[r.area] ||= { Poor: 0, 'At risk': 0, Watch: 0, Healthy: 0 };
    byArea[r.area][r.band]++;
  });
  const areaTotal = (name: string) => FLAGGED_BANDS.reduce((n, b) => n + (byArea[name]?.[b] || 0), 0);
  const maxArea = Math.max(1, ...SEQUENCES[lob].map(a => areaTotal(a.name)));

  const flagOptions = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach(r => r.calls.forEach(c => c.flags.forEach(f => seen.set(f.id, f.label))));
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const since = daysBefore(asOf, period);
  const visible = rows.filter(r =>
    (health === 'all' || (health === 'flagged' ? isFlagged(r) : r.band === health)) &&
    (!area || r.area === area) &&
    (!status || r.status === status) &&
    (!flag || r.flagIds.includes(flag)) &&
    (!team || r.lastCall?.team === team) &&
    !!r.lastCall && r.lastCall.at >= since,
  );

  // Active filters, as removable chips.
  const chips: [string, () => void][] = [
    ...(health !== 'flagged' ? [[health === 'all' ? 'All orders' : health, () => setHealth('flagged')] as [string, () => void]] : []),
    ...(area ? [[area, () => setArea('')] as [string, () => void]] : []),
    ...(status ? [[status, () => setStatus('')] as [string, () => void]] : []),
    ...(flag ? [[flagOptions.find(f => f[0] === flag)?.[1] || flag, () => setFlag('')] as [string, () => void]] : []),
    ...(team ? [[team, () => setTeam('')] as [string, () => void]] : []),
    ...(period !== 30 ? [[`Last ${period} days`, () => setPeriod(30)] as [string, () => void]] : []),
  ];

  const openId = params.get('order');
  const open = openId ? rows.find(r => r.order.id === openId) : null;
  const setOpen = (id: string | null) => {
    const q = new URLSearchParams(params.toString());
    if (id) q.set('order', id);
    else q.delete('order');
    router.replace(`${pathname}${q.size ? `?${q}` : ''}`, { scroll: false });
  };

  const delta = (now: number, then: number) => {
    const d = now - then;
    return d === 0 ? 'No change vs 30 days ago' : `${d > 0 ? '+' : '−'}${Math.abs(d)} vs 30 days ago`;
  };
  const windowText = s.repeat.windowDays === null ? 'over the life of the order' : `in ${s.repeat.windowDays} days`;

  return (
    <CallReviewFrame subtitle={`${lobLabel(lob)} order health from call activity and what's said on the phone`}>
      {/* 1. Headline numbers */}
      <section aria-label="Headline numbers" className={`${crCard} mt-6 overflow-hidden grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200`}>
        <Stat label="Poor health" value={bands.Poor} tone={BAND_TEXT.Poor} dot={BAND_FILL.Poor} note={delta(bands.Poor, prior.Poor)} onClick={() => setHealth('Poor')} />
        <Stat label="At risk" value={bands['At risk']} tone={BAND_TEXT['At risk']} dot={BAND_FILL['At risk']} note={delta(bands['At risk'], prior['At risk'])} onClick={() => setHealth('At risk')} />
        <Stat label="Repeat callers with flags" value={repeatCallers} note={`${s.repeat.count}+ flagged incoming calls ${windowText}`} />
        <Stat
          label="Repeat callers, repeat flags"
          value={repeatSameFlag.length}
          note={topRepeatFlag ? `Same flag on 2+ calls ${windowText} · most often ${topRepeatFlag[0].toLowerCase()}` : `Same flag on 2+ calls ${windowText}`}
        />
      </section>

      {/* 2. Where flagged orders sit */}
      <section className={`${crCard} mt-5 px-5 pt-[18px] pb-5`}>
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-[16px] font-semibold">Where flagged orders sit</h2>
            <p className="text-[13px] text-slate-600 mt-0.5">The order sequence, left to right. Click an area to filter the list below.</p>
          </div>
          <Legend />
        </div>
        <ol className="grid gap-1.5 mt-4" style={{ gridTemplateColumns: `repeat(${SEQUENCES[lob].length}, minmax(0, 1fr))` }}>
          {SEQUENCES[lob].map((a, i) => {
            const total = areaTotal(a.name);
            const selected = area === a.name;
            return (
              <li key={a.name} className="relative min-w-0">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setArea(selected ? '' : a.name)}
                  className={`w-full h-full text-left px-3 pt-2.5 pb-3 rounded-lg border cursor-pointer transition ${
                    selected ? 'bg-brand-50 border-brand-600 ring-1 ring-brand-600' : total ? 'bg-white border-slate-200 hover:border-slate-400' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="block text-[11px] font-semibold text-slate-500">{i + 1}</span>
                  <span className="block text-[13px] font-semibold text-slate-800 leading-tight min-h-[2.2em]">{a.name}</span>
                  <span className={`block text-[24px] font-bold mt-1 leading-none ${total ? 'text-slate-900' : 'text-slate-400'}`}>{total}</span>
                  {/* Bar length is relative to the busiest area; segments split it by band. */}
                  <span className="mt-2.5 h-1.5 rounded-full bg-slate-100 flex overflow-hidden" aria-hidden>
                    <span className="flex h-full" style={{ width: `${(total / maxArea) * 100}%` }}>
                      {FLAGGED_BANDS.map(b => (byArea[a.name]?.[b] ? <span key={b} className={BAND_FILL[b]} style={{ flex: byArea[a.name][b] }} /> : null))}
                    </span>
                  </span>
                  <span className="block text-[11px] text-slate-600 mt-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                    {total ? FLAGGED_BANDS.filter(b => byArea[a.name]?.[b]).map(b => `${byArea[a.name][b]} ${b === 'At risk' ? 'risk' : b.toLowerCase()}`).join(' · ') : 'None flagged'}
                  </span>
                </button>
                {i < SEQUENCES[lob].length - 1 && (
                  <ChevronRight aria-hidden className="hidden md:block absolute -right-[11px] top-1/2 -translate-y-1/2 z-10 w-4 h-4 text-slate-400 bg-white rounded-full" />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* 3. Flagged orders */}
      <section className={`${crCard} mt-5 overflow-hidden`}>
        <div className="px-5 pt-[18px] pb-4 border-b border-slate-200">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-semibold">{health === 'all' ? 'All orders' : 'Flagged orders'} <span className="text-slate-500 font-normal">· ranked by health score</span></h2>
            <span className="text-[14px] text-slate-600">Showing <b className="text-slate-900">{visible.length}</b> of {rows.length} orders</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3.5">
            <Select label="Health" value={health} onChange={v => setHealth(v as HealthFilter)} active={health !== 'flagged'}
              options={[['flagged', 'All flagged'], ['Poor', 'Poor health'], ['At risk', 'At risk'], ['Watch', 'Watch'], ['all', 'All orders']]} />
            <Select label="Area" value={area} onChange={setArea} active={!!area} options={[['', 'All areas'], ...SEQUENCES[lob].map(a => [a.name, a.name] as [string, string])]} />
            <Select label="Order status" value={status} onChange={setStatus} active={!!status}
              options={[['', 'All statuses'], ...SEQUENCES[lob].filter(a => !area || a.name === area).flatMap(a => a.statuses.map(x => [x, x] as [string, string]))]} />
            <Select label="Flag" value={flag} onChange={setFlag} active={!!flag} options={[['', 'All flags'], ...flagOptions]} />
            <Select label="Team" value={team} onChange={setTeam} active={!!team} options={[['', 'All teams'], ...TEAMS.map(t => [t, t] as [string, string])]} />
            <Select label="Last call" value={String(period)} onChange={v => setPeriod(Number(v))} active={period !== 30} options={PERIODS.map(p => [String(p), `Last call in ${p} days`] as [string, string])} />
          </div>
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {chips.map(([label, remove]) => (
                <button key={label} type="button" onClick={remove} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-[12px] font-semibold cursor-pointer hover:bg-brand-100">
                  {label} <X className="w-3 h-3" />
                </button>
              ))}
              <button type="button" onClick={clearAll} className="ml-1 text-[13px] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer">Clear all</button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-[14px]">
            <thead>
              <tr className="bg-slate-100">
                <th scope="col" className={`${crTh} pl-5`}>Patient / order</th>
                <th scope="col" className={crTh}>Area · order status</th>
                <th scope="col" className={crTh}>Health</th>
                <th scope="col" className={crTh}>Incoming calls</th>
                <th scope="col" className={crTh}>Flags hit</th>
                <th scope="col" className={`${crTh} pr-5`}>Last call</th>
              </tr>
            </thead>
            {GROUPS.map(band => {
              const group = visible.filter(r => r.band === band);
              if (!group.length) return null;
              return (
                <tbody key={band}>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <th scope="colgroup" colSpan={6} className="pl-5 pr-5 py-2 text-left">
                      <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                        <span className={`w-2 h-2 rounded-full ${BAND_FILL[band]}`} />
                        {band === 'Poor' ? 'Poor health' : band}
                        <span className="text-slate-500 font-normal">{group.length} order{group.length === 1 ? '' : 's'} · score {bandRange(band, s.bands)}</span>
                      </span>
                    </th>
                  </tr>
                  {group.map(r => <OrderRow key={r.order.id} r={r} onOpen={() => setOpen(r.order.id)} />)}
                </tbody>
              );
            })}
            {!visible.length && (
              <tbody>
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-600">No orders match these filters. <button type="button" onClick={clearAll} className="text-brand-600 font-semibold cursor-pointer">Clear all</button></td></tr>
              </tbody>
            )}
          </table>
        </div>
      </section>
      <SampleNote />

      {open && <OrderDrawer row={open} onClose={() => setOpen(null)} />}
    </CallReviewFrame>
  );
};

const bandRange = (band: Band, b: { poor: number; risk: number; watch: number }) =>
  band === 'Poor' ? `${b.poor}+` : band === 'At risk' ? `${b.risk}–${b.poor - 1}` : band === 'Watch' ? `${b.watch}–${b.risk - 1}` : `under ${b.watch}`;

const Legend: React.FC = () => (
  <div className="flex items-center gap-3 text-[12px] text-slate-600">
    {FLAGGED_BANDS.map(b => (
      <span key={b} className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${BAND_FILL[b]}`} />{b}</span>
    ))}
  </div>
);

const OrderRow: React.FC<{ r: OrderHealth; onOpen: () => void }> = ({ r, onOpen }) => {
  const labels = Object.keys(r.flagCounts);
  return (
    <tr className="border-t border-slate-200 hover:bg-slate-50 cursor-pointer" onClick={onOpen}>
      <td className="pl-5 pr-3 py-4 align-top">
        <button type="button" onClick={e => { e.stopPropagation(); onOpen(); }} className="font-semibold text-[15px] text-brand-700 hover:underline cursor-pointer text-left">
          {r.order.patient}
        </button>
        <div className="text-slate-600 mt-0.5 text-[13px]">{r.order.orderNumber} · {r.order.payer}</div>
      </td>
      <td className="px-3 py-4 align-top">
        <div className="font-semibold">{r.area}</div>
        <div className="text-slate-600 mt-0.5 text-[13px]">{r.status}</div>
        <div className="text-slate-600 mt-0.5 text-[13px]">Owner: {r.owner} · {r.daysInStatus}d in status</div>
      </td>
      <td className="px-3 py-4 align-top">
        <BandPill band={r.band} />
        <div className="text-slate-600 mt-1.5 text-[13px]">Score {r.score}</div>
      </td>
      <td className="px-3 py-4 align-top">
        <div className="font-semibold">{r.incoming} incoming</div>
        <div className="text-slate-600 mt-0.5 text-[13px]">{r.multiplier > 1 ? `×${r.multiplier} repeat multiplier` : 'No multiplier'}</div>
      </td>
      <td className="px-3 py-4 align-top">
        <div className="flex flex-wrap gap-1.5 max-w-[320px]">
          {labels.map((l, i) => <FlagPill key={l} id={r.flagIds[i]} label={l} title={`${r.flagCounts[l]} call${r.flagCounts[l] === 1 ? '' : 's'}`} />)}
          {!labels.length && <span className="text-[13px] text-slate-500">None</span>}
        </div>
      </td>
      <td className="pl-3 pr-5 py-4 align-top text-slate-700">
        {r.lastCall ? fmtWhen(r.lastCall.at) : '—'}
        {r.lastCall && <div className="text-slate-600 mt-0.5 text-[13px]">{r.lastCall.agent} · {r.lastCall.team}</div>}
      </td>
    </tr>
  );
};

const Stat: React.FC<{ label: string; value: number; note: string; tone?: string; dot?: string; onClick?: () => void }> = ({ label, value, note, tone, dot, onClick }) => {
  const body = (
    <>
      <div className="flex items-center gap-2 text-[13px] text-slate-600">{dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}{label}</div>
      <div className={`text-[32px] font-bold mt-1 leading-tight ${tone || 'text-slate-900'}`}>{value}</div>
      <div className="text-[13px] text-slate-600 mt-1">{note}</div>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} title={`Show ${label.toLowerCase()} orders`} className="bg-white px-5 py-[18px] flex flex-col justify-start text-left cursor-pointer hover:bg-slate-50 transition">{body}</button>
  ) : (
    <div className="bg-white px-5 py-[18px]">{body}</div>
  );
};

/** Native select styled as a filter button. */
const Select: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: [string, string][]; active?: boolean }> = ({ label, value, onChange, options, active }) => (
  <label className="relative">
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`appearance-none h-9 pl-3 pr-8 rounded-lg border text-[14px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-600/20 ${
        active ? 'border-brand-200 bg-brand-50 text-brand-700 font-semibold' : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
  </label>
);
