'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BAND_TONE, CALL_REVIEW_VIEWS, DIRECTION_TONE, LOBS, flagTone, type Band, type Lob } from '../../config/callReview';

/** The line of business lives in the URL (?lob=cardiac) so it carries across the views. */
export function useLob(): [Lob, (lob: Lob) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() || '';
  const lob: Lob = params.get('lob') === 'cardiac' ? 'cardiac' : 'ortho';
  const setLob = (next: Lob) => {
    const q = new URLSearchParams(params.toString());
    if (next === 'ortho') q.delete('lob');
    else q.set('lob', next);
    q.delete('order');
    router.replace(`${pathname}${q.size ? `?${q}` : ''}`, { scroll: false });
  };
  return [lob, setLob];
}

/** Page title, the three views, and the Ortho / Cardiac switch. */
export const CallReviewFrame: React.FC<{ subtitle: string; actions?: React.ReactNode; controls?: React.ReactNode; children: React.ReactNode }> = ({
  subtitle,
  actions,
  controls,
  children,
}) => {
  const pathname = usePathname() || '';
  const [lob, setLob] = useLob();
  const lobQuery = lob === 'cardiac' ? '?lob=cardiac' : '';
  return (
    <div className="max-w-[1400px] mx-auto pt-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight leading-tight">Call Review</h1>
          <p className="text-[15px] text-slate-600 mt-2">{subtitle}</p>
        </div>
        {actions}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
        <nav aria-label="Call Review views" className="flex gap-1.5">
          {CALL_REVIEW_VIEWS.map(v => {
            const active = v.key === 'overview' ? pathname === v.href : pathname.startsWith(v.href);
            return (
              <Link
                key={v.key}
                href={`${v.href}${lobQuery}`}
                aria-current={active ? 'page' : undefined}
                className={`px-3 py-[7px] rounded-md text-[14px] transition ${active ? 'bg-brand-700 text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {v.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          {controls}
          <div role="group" aria-label="Line of business" className="flex p-[3px] bg-slate-100 border border-slate-200 rounded-lg">
            {LOBS.map(l => (
              <button
                key={l.key}
                type="button"
                aria-pressed={lob === l.key}
                onClick={() => setLob(l.key)}
                className={`px-4 py-1.5 rounded-md text-[14px] cursor-pointer transition ${
                  lob === l.key ? 'bg-white text-brand-700 font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
};

const pill = 'inline-flex items-center px-[9px] py-[3px] rounded-full text-[12px] font-semibold whitespace-nowrap';

export const BandPill: React.FC<{ band: Band; children?: React.ReactNode }> = ({ band, children }) => (
  <span className={`${pill} ${BAND_TONE[band]}`}>{children || band}</span>
);

export const FlagPill: React.FC<{ id: string; label: string; title?: string }> = ({ id, label, title }) => (
  <span title={title} className={`${pill} ${flagTone(id)}`}>{label}</span>
);

export const DirectionTag: React.FC<{ direction: 'Incoming' | 'Outgoing' }> = ({ direction }) => (
  <span className={`${pill} ${DIRECTION_TONE[direction]}`}>{direction}</span>
);

export const crCard = 'bg-white border border-slate-200 rounded-xl';
export const crTh = 'px-3 py-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-600 text-left whitespace-nowrap';

/** Footnote under each view: this is sample data. */
export const SampleNote: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <p className="text-[12px] text-slate-500 mt-3 mx-1">
    {children || 'Proof of concept: orders, names, phone numbers and transcript lines are made up. Scores are computed live from the saved flag settings.'}
  </p>
);
