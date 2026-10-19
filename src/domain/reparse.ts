import { categorize, OTHER_ID } from '@/domain/categorize';
import type { MerchantRule, ParsedTxn, Transaction } from '@/domain/types';

// Names older parsers produced from SMS footers; safe to replace because no real payee is called this
const KNOWN_BAD = new Set(['DISPUTE']);

// After a parser upgrade: fill Merchants the old parser missed or misread, and re-file debits that only sat in Other
// by default. A Merchant or Category the user set themselves is never touched.
export function refreshMerchants(stored: Transaction[], fresh: ParsedTxn[], userRules: MerchantRule[]): Transaction[] {
  const bySms = new Map(fresh.map((p) => [p.sourceSmsId, p]));
  const changed: Transaction[] = [];
  for (const t of stored) {
    if (t.merchant && !KNOWN_BAD.has(t.merchant)) continue;
    const merchant = t.sourceSmsIds.map((id) => bySms.get(id)?.merchant).find(Boolean);
    if (!merchant || merchant === t.merchant) continue;
    const next = { ...t, merchant };
    if (t.direction === 'debit' && (t.categoryId ?? OTHER_ID) === OTHER_ID) next.categoryId = categorize(next, userRules);
    changed.push(next);
  }
  return changed;
}
