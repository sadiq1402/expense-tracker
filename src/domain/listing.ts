import { spendOf } from '@/domain/aggregate';
import { DAY_MS, istDayStart, istFields, MONTH_LABELS } from '@/domain/dateRange';
import type { Channel, Transaction } from '@/domain/types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface DayGroup {
  key: number;
  label: string;
  spendPaise: number;
  txns: Transaction[];
}

// Hand-rolled from IST fields so labels don't depend on the device's Intl data
export const dayLabel = (ms: number, now: number) => {
  const { year, month, day, weekday } = istFields(ms);
  const sameYear = year === istFields(now).year;
  return `${WEEKDAYS[weekday]} ${day} ${MONTH_LABELS[month]}${sameYear ? '' : ` ${year}`}`;
};

export function timeLabel(ms: number): string {
  const { hour, minute } = istFields(ms);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
}

export function groupByDay(txns: Transaction[], now: number): DayGroup[] {
  const today = istDayStart(now);
  const groups = new Map<number, DayGroup>();
  for (const t of [...txns].sort((a, b) => b.occurredAt - a.occurredAt)) {
    const key = istDayStart(t.occurredAt);
    let group = groups.get(key);
    if (!group) {
      const label =
        key === today ? 'Today' : key === today - DAY_MS ? `Yesterday · ${dayLabel(key, now)}` : dayLabel(key, now);
      group = { key, label, spendPaise: 0, txns: [] };
      groups.set(key, group);
    }
    group.spendPaise += spendOf(t);
    group.txns.push(t);
  }
  return [...groups.values()];
}

export type RowTone = 'normal' | 'credit' | 'uncounted';

export function describeRow(
  t: Transaction,
  names: { category: string | null; account: string | null },
): { subtitle: string; tone: RowTone } {
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(' · ');
  if (t.isSelfTransfer) return { subtitle: 'Self-Transfer · not counted', tone: 'uncounted' };
  if (t.isExcluded) return { subtitle: join('Excluded', names.category, 'not counted'), tone: 'uncounted' };
  const note = t.isCash && t.note ? `“${t.note}”` : null;
  const time = timeLabel(t.occurredAt);
  if (t.isRefund) return { subtitle: join('Refund', names.category, time), tone: 'credit' };
  return {
    subtitle: join(names.category, note ?? names.account, time),
    tone: t.direction === 'credit' ? 'credit' : 'normal',
  };
}

const REASON_TEXT: Record<string, string> = { 'amount not found': 'We couldn’t read the amount' };

// One reason across every item is worth naming; a mix just invites a look
export function reviewSummary(reasons: string[]): string {
  const unique = [...new Set(reasons)];
  return unique.length === 1 ? (REASON_TEXT[unique[0]] ?? unique[0]) : 'Tap to check them';
}

const CHANNEL_LABELS: Record<Channel, string | null> = {
  upi: 'UPI',
  card: 'Card',
  atm: 'ATM',
  neft_imps: 'NEFT/IMPS',
  autodebit: 'Auto-debit',
  other: null,
};

export function detailMeta(t: Transaction, account: string | null, now: number): string {
  const channel = t.isCash ? 'Cash' : CHANNEL_LABELS[t.channel];
  return [dayLabel(t.occurredAt, now), timeLabel(t.occurredAt), channel, account].filter(Boolean).join(' · ');
}
