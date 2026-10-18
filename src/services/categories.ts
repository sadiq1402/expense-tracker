import { repo } from '@/db/repo';
import { recategorizeMerchant } from '@/domain/breakdown';
import { ruleFromCorrection } from '@/domain/categorize';
import type { Transaction } from '@/domain/types';

// Saving a Category also remembers it for that Merchant, so later SMS from them are categorized the same way
export async function setCategory(txn: Transaction, categoryId: string) {
  await repo.upsertTransactions([{ ...txn, categoryId }]);
  const rule = ruleFromCorrection(txn, categoryId);
  if (rule) await repo.upsertRule(rule);
}

// One choice on the Merchant view moves all their payments (past and future) to that Category
export async function setMerchantCategory(merchant: string, categoryId: string): Promise<number> {
  const { rule, changed } = recategorizeMerchant(await repo.allTransactions(), merchant, categoryId);
  await repo.upsertRule(rule);
  await repo.upsertTransactions(changed);
  return changed.length;
}
