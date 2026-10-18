import { repo } from '@/db/repo';
import { selfTransferPartner } from '@/domain/accounts';
import type { Transaction } from '@/domain/types';

// Flips both halves of the pair and marks them manual, so re-scans never undo the choice
export async function toggleSelfTransfer(txn: Transaction): Promise<Transaction> {
  const partner = selfTransferPartner(txn, await repo.allTransactions());
  const flip = (t: Transaction): Transaction => ({
    ...t,
    isSelfTransfer: !txn.isSelfTransfer,
    selfTransferManual: true,
  });
  const next = flip(txn);
  await repo.upsertTransactions(partner ? [next, flip(partner)] : [next]);
  return next;
}
