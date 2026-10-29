'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, type Lob, type Settings, type SettingsChange } from '../../config/callReview';

/**
 * Saved Call Review flag settings, one set per line of business, plus the change log.
 *
 * Proof of concept: kept in this browser's localStorage. In production this is a
 * table with an audit trail (BRD section 7: every change records who and when).
 */

interface Saved {
  settings: Record<Lob, Settings>;
  log: SettingsChange[];
}

const KEY = 'callReview.settings.v1';
const fresh = (): Saved => ({ settings: structuredClone(DEFAULT_SETTINGS), log: [] });

let state: Saved | null = null;
const listeners = new Set<() => void>();

function read(): Saved {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { ...fresh(), ...JSON.parse(raw) } : fresh();
  } catch {
    state = fresh();
  }
  return state!;
}

function write(next: Saved) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: settings still apply for this visit.
  }
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Which sections of the settings screen differ between two versions. */
export function describeChanges(before: Settings, after: Settings) {
  const sections: [keyof Settings, string][] = [
    ['repeat', 'repeat calls'],
    ['calls', 'dropped and short calls'],
    ['sentiment', 'sentiment'],
    ['language', 'language flags'],
    ['bands', 'health score bands'],
  ];
  return sections.filter(([k]) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map(([, label]) => label);
}

export function useCallReviewSettings() {
  const saved = useSyncExternalStore(subscribe, read, read);
  return {
    settings: saved.settings,
    log: saved.log,
    save(lob: Lob, next: Settings, by: string) {
      const changed = describeChanges(saved.settings[lob], next);
      if (!changed.length) return;
      write({
        settings: { ...saved.settings, [lob]: next },
        log: [{ at: new Date().toISOString(), by, lob, summary: `Changed ${changed.join(', ')}` }, ...saved.log].slice(0, 50),
      });
    },
    resetToDefaults(lob: Lob, by: string) {
      write({
        settings: { ...saved.settings, [lob]: structuredClone(DEFAULT_SETTINGS[lob]) },
        log: [{ at: new Date().toISOString(), by, lob, summary: 'Reset to starting values' }, ...saved.log].slice(0, 50),
      });
    },
  };
}
