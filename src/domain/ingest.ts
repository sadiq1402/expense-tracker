import type { ParsedTxn, Transaction } from '@/domain/types';

export function mergeIntoExisting(
  existing: Transaction[],
  incoming: ParsedTxn[],
  newId: () => string,
): { created: Transaction[]; updated: Transaction[] } {
  const seen = new Set(existing.flatMap((t) => t.sourceSmsIds));
  const created: Transaction[] = [];
  for (const p of incoming) {
    if (seen.has(p.sourceSmsId)) continue;
    seen.add(p.sourceSmsId);
    created.push({
      ...p,
      id: newId(),
      sourceSmsIds: [p.sourceSmsId],
      categoryId: null,
      note: null,
      isSelfTransfer: false,
      selfTransferManual: false,
      isExcluded: false,
      isRefund: false,
      isCash: false,
      accountId: null,
    });
  }
  return { created, updated: [] };
}
