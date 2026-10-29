import { SEQUENCES, type Band, type Lob, type Settings } from '../../config/callReview';
import { scoreOrder, type OrderHealth } from './scoring';
import { sampleData } from './sampleData';

/**
 * The Call Review read model: every order in a line of business, scored.
 * Swap `sampleData` for the real orders / calls feed; nothing else changes.
 */

const DAY = 86_400_000;

export function orderHealth(lob: Lob, s: Settings, asOf?: string): OrderHealth[] {
  const data = sampleData(lob);
  const at = asOf || data.asOf;
  const owners = Object.fromEntries(SEQUENCES[lob].map(a => [a.name, a.owner]));
  const byOrder = new Map<string, typeof data.calls>();
  data.calls.forEach(c => byOrder.set(c.orderId, [...(byOrder.get(c.orderId) || []), c]));
  return data.orders
    .map(o => scoreOrder(o, byOrder.get(o.id) || [], s, at, owners))
    .sort((a, b) => b.score - a.score);
}

export const asOfNow = (lob: Lob) => sampleData(lob).asOf;
export const daysBefore = (iso: string, days: number) => new Date(Date.parse(iso) - days * DAY).toISOString();

export const countBands = (rows: OrderHealth[]) =>
  rows.reduce((n, r) => ({ ...n, [r.band]: n[r.band] + 1 }), { Poor: 0, 'At risk': 0, Watch: 0, Healthy: 0 } as Record<Band, number>);

export const isFlagged = (r: OrderHealth) => r.band !== 'Healthy';
