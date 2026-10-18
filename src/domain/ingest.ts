import type { ParsedTxn, Transaction } from '@/domain/types';

const DEDUP_WINDOW_MS = 5 * 60_000;

// Without two references to compare, a nearby same-amount SMS from a new sender is the same payment
const samePayment = (t: Transaction, p: ParsedTxn) => {
  if (t.isCash) return false;
  if (t.upiRef && p.upiRef) return t.upiRef === p.upiRef;
  return (
    t.sourceSenders.length > 0 &&
    t.amountPaise === p.amountPaise &&
    t.direction === p.direction &&
    Math.abs(t.occurredAt - p.occurredAt) <= DEDUP_WINDOW_MS &&
    !t.sourceSenders.includes(p.sourceSender)
  );
};

const addSource = (t: Transaction, p: ParsedTxn): Transaction => ({
  ...t,
  sourceSmsIds: [...t.sourceSmsIds, p.sourceSmsId],
  sourceSenders: [...t.sourceSenders, p.sourceSender],
  occurredAt: Math.min(t.occurredAt, p.occurredAt),
  accountMask: t.accountMask ?? p.accountMask,
  upiRef: t.upiRef ?? p.upiRef,
  merchant: t.merchant ?? p.merchant,
});

const closestMatch = (txns: Transaction[], p: ParsedTxn) => {
  let best = -1;
  txns.forEach((t, i) => {
    if (!samePayment(t, p)) return;
    if (best < 0 || Math.abs(t.occurredAt - p.occurredAt) < Math.abs(txns[best].occurredAt - p.occurredAt)) best = i;
  });
  return best;
};

export function mergeIntoExisting(
  existing: Transaction[],
  incoming: ParsedTxn[],
  newId: () => string,
): { created: Transaction[]; updated: Transaction[] } {
  const all = [...existing];
  const createdIds = new Set<string>();
  const updatedIds = new Set<string>();
  const seen = new Set(existing.flatMap((t) => t.sourceSmsIds));

  for (const p of incoming) {
    if (seen.has(p.sourceSmsId)) continue;
    seen.add(p.sourceSmsId);

    const i = closestMatch(all, p);
    if (i >= 0) {
      all[i] = addSource(all[i], p);
      if (!createdIds.has(all[i].id)) updatedIds.add(all[i].id);
      continue;
    }

    const t: Transaction = {
      ...p,
      id: newId(),
      sourceSmsIds: [p.sourceSmsId],
      sourceSenders: [p.sourceSender],
      categoryId: null,
      note: null,
      isSelfTransfer: false,
      selfTransferManual: false,
      isExcluded: false,
      isRefund: false,
      isCash: false,
      accountId: null,
    };
    all.push(t);
    createdIds.add(t.id);
  }

  return {
    created: all.filter((t) => createdIds.has(t.id)),
    updated: all.filter((t) => updatedIds.has(t.id)),
  };
}
