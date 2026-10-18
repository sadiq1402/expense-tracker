import { SEED_RULES } from '@/domain/seedMerchants';
import type { Category, MerchantRule, Transaction } from '@/domain/types';

export const OTHER_ID = 'other';
export const PEOPLE_ID = 'people';

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

// Debits only; credits are classified by classifyCredit
export function categorize(txn: Transaction, userRules: MerchantRule[]): string | null {
  if (txn.direction === 'credit') return null;
  if (!txn.merchant) return OTHER_ID;
  const merchant = normalize(txn.merchant);
  return (bestMatch(merchant, userRules) ?? bestMatch(merchant, SEED_RULES))?.categoryId ?? OTHER_ID;
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

// Gateways and generic words appear across unrelated Merchants, so they never link a credit to a purchase
const GENERIC_STEMS = new Set(['PAY', 'UPI', 'RAZORPAY', 'PAYU', 'PAYTM', 'CCAVENUE', 'BILLDESK', 'PHONEPE', 'GPAY']);

// Either stem containing the other as whole words, so "AMAZON" refunds an "AMAZON PAY" purchase
const sameMerchant = (a: string, b: string) => {
  const [ka, kb] = [merchantKey(a), merchantKey(b)];
  if (GENERIC_STEMS.has(ka) || GENERIC_STEMS.has(kb)) return false;
  return matches(ka, kb) || matches(kb, ka);
};

// Other and Transfers to People hold unknown payees and friends, so paying them back isn't a Refund
const isPurchase = (t: Transaction) =>
  t.direction === 'debit' && !t.isExcluded && !!t.categoryId && t.categoryId !== OTHER_ID && t.categoryId !== PEOPLE_ID;

// Refund = credit from a Merchant with an earlier purchase; takes the most recent purchase's Category
export function classifyCredit(
  credit: Transaction,
  history: Transaction[],
): Pick<Transaction, 'isRefund' | 'categoryId'> {
  const merchant = credit.merchant;
  if (!merchant) return { isRefund: false, categoryId: null };
  const purchase = history
    .filter(
      (t) => isPurchase(t) && t.occurredAt <= credit.occurredAt && t.merchant && sameMerchant(t.merchant, merchant),
    )
    .reduce<Transaction | null>((latest, t) => (!latest || t.occurredAt > latest.occurredAt ? t : latest), null);
  return purchase ? { isRefund: true, categoryId: purchase.categoryId } : { isRefund: false, categoryId: null };
}
