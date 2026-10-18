import { repo } from '@/db/repo';
import { ruleFromCorrection } from '@/domain/categorize';
import type { Transaction } from '@/domain/types';

// Saving a Category also remembers it for that Merchant, so later SMS from them are categorized the same way
export async function setCategory(txn: Transaction, categoryId: string) {
  await repo.upsertTransactions([{ ...txn, categoryId }]);
  const rule = ruleFromCorrection(txn, categoryId);
  if (rule) await repo.upsertRule(rule);
}
