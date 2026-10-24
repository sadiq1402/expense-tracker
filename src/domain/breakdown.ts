import { spendOf, type MerchantSpend } from '@/domain/aggregate';
import { OTHER_ID, ruleCovers, ruleForMerchant } from '@/domain/categorize';
import type { DateRange } from '@/domain/dateRange';
import type { MerchantRule, Transaction } from '@/domain/types';

export type BreakdownFilter = { kind: 'merchant' | 'category'; key: string };

// Key for payments with no Merchant (Cash, or SMS the parser couldn't name); empty so it survives route params
export const NO_MERCHANT = '';

// Merchant keys match topMerchants exactly; a Category shows only what counts toward its spend
export function matchesFilter(t: Transaction, filter: BreakdownFilter): boolean {
  if (filter.kind === 'merchant') return (t.merchant ?? NO_MERCHANT) === filter.key;
  return (t.categoryId ?? OTHER_ID) === filter.key && spendOf(t) !== 0;
}

export function breakdownTxns(txns: Transaction[], filter: BreakdownFilter, range: DateRange): Transaction[] {
  return txns
    .filter((t) => t.occurredAt >= range.start && t.occurredAt < range.end && matchesFilter(t, filter))
    .sort((a, b) => b.occurredAt - a.occurredAt);
}

export interface BreakdownSummary {
  spendPaise: number;
  payments: number;
  averagePaise: number;
  sharePct: number;
}

export function breakdownSummary(shown: Transaction[], rangeSpendPaise: number): BreakdownSummary {
  // Refunds can outweigh spend in a range; like the Dashboard's bars, a breakdown never reads negative
  const spendPaise = Math.max(
    0,
    shown.reduce((sum, t) => sum + spendOf(t), 0),
  );
  const payments = shown.filter((t) => spendOf(t) > 0).length;
  return {
    spendPaise,
    payments,
    averagePaise: payments ? Math.round(spendPaise / payments) : 0,
    sharePct: rangeSpendPaise > 0 ? Math.round((spendPaise / rangeSpendPaise) * 100) : 0,
  };
}

// The debits and Refunds a Merchant-wide Category change covers, SMS variants included; ordinary credits stay out
export function merchantPayments(txns: Transaction[], merchant: string): Transaction[] {
  const rule = ruleForMerchant(merchant, OTHER_ID);
  return txns.filter((t) => t.merchant && (t.direction === 'debit' || t.isRefund) && ruleCovers(rule, t.merchant));
}

export function merchantCategoryOf(txns: Transaction[], merchant: string): string {
  const latest = merchantPayments(txns, merchant).reduce<Transaction | null>(
    (best, t) => (!best || t.occurredAt > best.occurredAt ? t : best),
    null,
  );
  return latest?.categoryId ?? OTHER_ID;
}

export function recategorizeMerchant(
  txns: Transaction[],
  merchant: string,
  categoryId: string,
): { rule: MerchantRule; changed: Transaction[] } {
  const changed = merchantPayments(txns, merchant)
    .filter((t) => t.categoryId !== categoryId || t.unchecked)
    .map((t) => ({ ...t, categoryId, unchecked: false }));
  return { rule: ruleForMerchant(merchant, categoryId), changed };
}

// Every Merchant in a breakdown, plus one No Merchant line (always last) so the rows add up to the total
export function merchantTotals(shown: Transaction[]): MerchantSpend[] {
  const totals = new Map<string, MerchantSpend>();
  for (const t of shown) {
    const spend = spendOf(t);
    if (spend === 0) continue;
    const merchant = t.merchant ?? NO_MERCHANT;
    const row = totals.get(merchant) ?? { merchant, amountPaise: 0, count: 0 };
    row.amountPaise += spend;
    if (spend > 0) row.count++;
    totals.set(merchant, row);
  }
  return [...totals.values()]
    .filter((r) => r.amountPaise > 0)
    .sort(
      (a, b) =>
        Number(a.merchant === NO_MERCHANT) - Number(b.merchant === NO_MERCHANT) || b.amountPaise - a.amountPaise,
    );
}
