import { SEED_RULES } from '@/domain/seedMerchants';
import type { Category, MerchantRule, Transaction } from '@/domain/types';

export const DEFAULT_CATEGORIES: Category[] = [
  ['food', 'Food'],
  ['groceries', 'Groceries'],
  ['shopping', 'Shopping'],
  ['travel', 'Travel'],
  ['bills', 'Bills & Utilities'],
  ['rent', 'Rent'],
  ['entertainment', 'Entertainment'],
  ['health', 'Health'],
  ['people', 'Transfers to People'],
  ['other', 'Other'],
].map(([id, name]) => ({ id, name, builtIn: true }));

const normalize = (merchant: string) => merchant.trim().toUpperCase();

const isWordChar = (ch: string | undefined) => !!ch && /[A-Z0-9]/.test(ch);

// A rule must be whole words ("OLA" matches "OLA CABS", not "COCA COLA" or "OLAELECTRIC")
const matches = (merchant: string, rule: string) => {
  for (let i = merchant.indexOf(rule); i >= 0; i = merchant.indexOf(rule, i + 1)) {
    if (!isWordChar(merchant[i - 1]) && !isWordChar(merchant[i + rule.length])) return true;
  }
  return false;
};

// "SWIGGY*BANGALORE" → "SWIGGY", "RAMESH.K@OKAXIS" → "RAMESH.K", so one correction covers every SMS variant
const merchantKey = (merchant: string) => normalize(merchant).split(/[*@]/)[0].trim() || normalize(merchant);

// Longest match wins, so "AMAZON PRIME" beats "AMAZON"
const bestMatch = (merchant: string, rules: MerchantRule[]) =>
  rules
    .filter((r) => matches(merchant, r.merchant))
    .reduce<MerchantRule | null>((best, r) => (!best || r.merchant.length > best.merchant.length ? r : best), null);

// Credits stay uncategorized until Refund detection (#7) decides what they are
export function categorize(txn: Transaction, userRules: MerchantRule[]): string | null {
  if (txn.direction === 'credit') return null;
  if (!txn.merchant) return 'other';
  const merchant = normalize(txn.merchant);
  return (bestMatch(merchant, userRules) ?? bestMatch(merchant, SEED_RULES))?.categoryId ?? 'other';
}

// Credits don't teach rules: relabelling a friend's repayment mustn't relabel future payments to them
export function ruleFromCorrection(txn: Transaction, categoryId: string): MerchantRule | null {
  if (txn.direction === 'credit' || !txn.merchant) return null;
  return { merchant: merchantKey(txn.merchant), categoryId, source: 'user' };
}

export function newCategory(name: string, existing: Category[], newId: () => string): Category | null {
  const trimmed = name.trim();
  if (!trimmed || existing.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return null;
  return { id: newId(), name: trimmed, builtIn: false };
}
