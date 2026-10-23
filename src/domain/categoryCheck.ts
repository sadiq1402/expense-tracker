import { visibleTxns } from '@/domain/accounts';
import { mixedKeyFor, OTHER_ID, ruleCovers, ruleFromCorrection } from '@/domain/categorize';
import type { Account, MerchantRule, Transaction } from '@/domain/types';

// The user already answered for a Merchant they taught, so only untaught Merchants are asked about
const taught = (merchant: string | null, userRules: MerchantRule[]) =>
  !!merchant && userRules.some((r) => ruleCovers(r, merchant));

// A Mixed Merchant has no single Category, so the best guess is whatever the user picked for it last
const latestPick = (key: string, history: Transaction[]) =>
  history
    .filter((t) => !t.unchecked && t.direction === 'debit' && t.categoryId && t.merchant)
    .filter((t) => mixedKeyFor(t.merchant!, [key]))
    .reduce<Transaction | null>((latest, t) => (!latest || t.occurredAt > latest.occurredAt ? t : latest), null)
    ?.categoryId;

export function flagUnchecked(
  created: Transaction[],
  history: Transaction[],
  userRules: MerchantRule[],
  mixed: string[],
): Transaction[] {
  return created.map((t) => {
    if (t.direction !== 'debit') return t;
    const key = t.merchant ? mixedKeyFor(t.merchant, mixed) : undefined;
    if (key) return { ...t, unchecked: true, categoryId: latestPick(key, history) ?? t.categoryId };
    return taught(t.merchant, userRules) ? t : { ...t, unchecked: true };
  });
}

// Flags are set at ingest, so a later Self-Transfer match or Exclusion still drops the row here
export function uncheckedExpenses(txns: Transaction[], accounts: Account[]): Transaction[] {
  return visibleTxns(txns, accounts)
    .filter((t) => t.unchecked && t.direction === 'debit' && !t.isSelfTransfer && !t.isExcluded)
    .sort((a, b) => b.occurredAt - a.occurredAt);
}

export interface Pick {
  txn: Transaction;
  categoryId: string;
}

export interface CheckResult {
  txns: Transaction[];
  upsertRules: MerchantRule[];
  removeRules: string[];
  addMixed: string[];
}

export function applyCheck(picks: Pick[], userRules: MerchantRule[], mixed: string[]): CheckResult {
  const txns = picks.map(({ txn, categoryId }) => ({ ...txn, categoryId, unchecked: false }));
  // Leaving Other as it was isn't an answer, and a Mixed Merchant has no single Category to remember
  const teaches = ({ txn, categoryId }: Pick) =>
    (categoryId !== OTHER_ID || txn.categoryId !== OTHER_ID) && !(txn.merchant && mixedKeyFor(txn.merchant, mixed));
  const answers = new Map<string, Set<string>>();
  for (const rule of picks
    .filter(teaches)
    .flatMap(({ txn, categoryId }) => ruleFromCorrection(txn, categoryId) ?? [])) {
    answers.set(rule.merchant, (answers.get(rule.merchant) ?? new Set()).add(rule.categoryId));
  }
  // Seeds are the app's guesses, so only the user's own earlier answer can disagree
  for (const rule of userRules) answers.get(rule.merchant)?.add(rule.categoryId);

  const entries = [...answers];
  const addMixed = entries.filter(([, categories]) => categories.size > 1).map(([merchant]) => merchant);
  return {
    txns,
    upsertRules: entries
      .filter(([, categories]) => categories.size === 1)
      .map(([merchant, categories]) => ({ merchant, categoryId: [...categories][0], source: 'user' })),
    removeRules: addMixed.filter((merchant) => userRules.some((r) => r.merchant === merchant)),
    addMixed,
  };
}
