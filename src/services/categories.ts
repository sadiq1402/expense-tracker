import { repo } from '@/db/repo';
import { recategorizeMerchant } from '@/domain/breakdown';
import { applyCheck, type Pick } from '@/domain/categoryCheck';
import type { Transaction } from '@/domain/types';

// Saving Categories also remembers them for each Merchant, so later SMS from them are categorized the same way,
// unless the user has put that Merchant in more than one Category
export async function confirmCategories(picks: Pick[]) {
  const [rules, mixed] = await Promise.all([repo.userRules(), repo.mixedMerchants()]);
  const result = applyCheck(picks, rules, mixed);
  await repo.upsertTransactions(result.txns);
  for (const rule of result.upsertRules) await repo.upsertRule(rule);
  await repo.deleteRules(result.removeRules);
  await repo.addMixedMerchants(result.addMixed);
}

export function setCategory(txn: Transaction, categoryId: string) {
  return confirmCategories([{ txn, categoryId }]);
}

// One choice on the Merchant view moves all their payments (past and future) to that Category
export async function setMerchantCategory(merchant: string, categoryId: string): Promise<number> {
  const { rule, changed } = recategorizeMerchant(await repo.allTransactions(), merchant, categoryId);
  await repo.upsertRule(rule);
  // Choosing one Category for every payment settles a Mixed Merchant
  await repo.removeMixedMerchant(rule.merchant);
  await repo.upsertTransactions(changed);
  return changed.length;
}
