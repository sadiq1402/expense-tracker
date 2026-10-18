import { monthKey, monthStarts, type DateRange } from '@/domain/dateRange';
import type { Transaction } from '@/domain/types';

// Spend = Expenses minus Refunds; everything else contributes nothing
const spendOf = (t: Transaction) => {
  if (t.isExcluded || t.isSelfTransfer) return 0;
  if (t.direction === 'debit') return t.amountPaise;
  return t.isRefund ? -t.amountPaise : 0;
};

const inRange = (t: Transaction, r: DateRange) => t.occurredAt >= r.start && t.occurredAt < r.end;

const sumBy = (txns: Transaction[], key: (t: Transaction) => string | null) => {
  const totals = new Map<string, number>();
  for (const t of txns) {
    const k = key(t);
    const spend = spendOf(t);
    if (k !== null && spend !== 0) totals.set(k, (totals.get(k) ?? 0) + spend);
  }
  return totals;
};

export function totalSpend(txns: Transaction[], range: DateRange): number {
  return txns.filter((t) => inRange(t, range)).reduce((sum, t) => sum + spendOf(t), 0);
}

// Per-Category bars clamp at zero; a Refund outweighing its Category's spend still lowers totalSpend
export function spendByCategory(txns: Transaction[], range: DateRange) {
  const totals = sumBy(
    txns.filter((t) => inRange(t, range)),
    (t) => t.categoryId ?? 'other',
  );
  return [...totals]
    .filter(([, amountPaise]) => amountPaise > 0)
    .map(([categoryId, amountPaise]) => ({ categoryId, amountPaise }))
    .sort((a, b) => b.amountPaise - a.amountPaise);
}

export function monthlyTrend(txns: Transaction[], months: number, now: number) {
  const totals = sumBy(txns, (t) => monthKey(t.occurredAt));
  return monthStarts(months, now).map((start) => {
    const month = monthKey(start);
    return { month, amountPaise: Math.max(0, totals.get(month) ?? 0) };
  });
}

export function topMerchants(txns: Transaction[], range: DateRange, limit: number) {
  const inWindow = txns.filter((t) => inRange(t, range) && t.merchant);
  const totals = sumBy(inWindow, (t) => t.merchant);
  const counts = new Map<string, number>();
  for (const t of inWindow) {
    if (spendOf(t) > 0) counts.set(t.merchant!, (counts.get(t.merchant!) ?? 0) + 1);
  }
  return [...totals]
    .filter(([, amountPaise]) => amountPaise > 0)
    .map(([merchant, amountPaise]) => ({ merchant, amountPaise, count: counts.get(merchant) ?? 0 }))
    .sort((a, b) => b.amountPaise - a.amountPaise)
    .slice(0, limit);
}
