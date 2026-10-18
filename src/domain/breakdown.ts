import { spendOf } from '@/domain/aggregate';
import { OTHER_ID, ruleCovers, ruleForMerchant } from '@/domain/categorize';
import type { DateRange } from '@/domain/dateRange';
import type { MerchantRule, Transaction } from '@/domain/types';

export type BreakdownFilter = { kind: 'merchant' | 'category'; key: string };

// Merchant keys match topMerchants exactly; a Category shows only what counts toward its spend
export function matchesFilter(t: Transaction, filter: BreakdownFilter): boolean {
  if (filter.kind === 'merchant') return t.merchant === filter.key;
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
    .filter((t) => t.categoryId !== categoryId)
    .map((t) => ({ ...t, categoryId }));
  return { rule: ruleForMerchant(merchant, categoryId), changed };
}
