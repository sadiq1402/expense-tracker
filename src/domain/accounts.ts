import { accountLabel } from '@/domain/format';
import type { Account, Transaction } from '@/domain/types';

const SELF_TRANSFER_WINDOW_MS = 10 * 60_000;

export function discoverAccounts(txns: Transaction[], known: Account[], newId: () => string): Account[] {
  const seen = known.map((a) => a.mask);
  const found: Account[] = [];
  for (const { accountMask: mask } of txns) {
    if (!mask || seen.some((m) => sameAccount(m, mask))) continue;
    seen.push(mask);
    found.push({ id: newId(), mask, name: `A/c XX${mask}`, confirmed: false, hidden: false });
  }
  return found;
}

// Banks print 3 or 4 trailing digits for the same Account ("901" vs "1901")
export const sameAccount = (a: string, b: string) => a.endsWith(b) || b.endsWith(a);

const gap = (a: Transaction, b: Transaction) => Math.abs(a.occurredAt - b.occurredAt);

const canPair = (debit: Transaction, credit: Transaction) =>
  debit.direction === 'debit' &&
  credit.direction === 'credit' &&
  debit.amountPaise === credit.amountPaise &&
  !!debit.accountMask &&
  !!credit.accountMask &&
  !sameAccount(debit.accountMask, credit.accountMask) &&
  gap(debit, credit) <= SELF_TRANSFER_WINDOW_MS;

// Manual choices and existing pairs are out of the pool, so a re-scan can never override or re-pair them
const candidate = (t: Transaction) => !t.selfTransferManual && !t.isSelfTransfer && !t.isCash && !!t.accountMask;

// A Self-Transfer credit is never a Refund, so unmarking it later can't resurrect a stale Refund
const asSelfTransfer = (t: Transaction): Transaction =>
  t.direction === 'credit'
    ? { ...t, isSelfTransfer: true, isRefund: false, categoryId: null }
    : { ...t, isSelfTransfer: true };

export function markSelfTransfers(txns: Transaction[]): Transaction[] {
  const pool = txns.filter(candidate);
  const debits = pool.filter((t) => t.direction === 'debit');
  const credits = pool.filter((t) => t.direction === 'credit');
  // Closest pairs first across the whole set, so the result doesn't depend on input order
  const pairs = debits
    .flatMap((d) => credits.filter((c) => canPair(d, c)).map((c) => [d, c] as const))
    .sort(([d1, c1], [d2, c2]) => gap(d1, c1) - gap(d2, c2));

  const used = new Set<string>();
  const changed: Transaction[] = [];
  for (const [d, c] of pairs) {
    if (used.has(d.id) || used.has(c.id)) continue;
    used.add(d.id).add(c.id);
    changed.push(asSelfTransfer(d), asSelfTransfer(c));
  }
  return changed;
}

// The other half of a pair, so a manual mark/unmark keeps both sides in step
export function selfTransferPartner(txn: Transaction, txns: Transaction[]): Transaction | null {
  return (
    txns
      .filter((t) => t.id !== txn.id && t.isSelfTransfer === txn.isSelfTransfer && !t.isCash)
      .filter((t) => (txn.direction === 'debit' ? canPair(txn, t) : canPair(t, txn)))
      .sort((a, b) => gap(a, txn) - gap(b, txn))[0] ?? null
  );
}

const onAccount = (t: Transaction, mask: string) => !!t.accountMask && sameAccount(t.accountMask, mask);

// Hidden Accounts drop out of every total and list; Cash has no Account and always shows
export function visibleTxns(txns: Transaction[], accounts: Account[]): Transaction[] {
  const hidden = accounts.filter((a) => a.hidden).map((a) => a.mask);
  if (hidden.length === 0) return txns;
  return txns.filter((t) => !hidden.some((mask) => onAccount(t, mask)));
}

export function filterByAccount(txns: Transaction[], mask: string | null): Transaction[] {
  return mask ? txns.filter((t) => onAccount(t, mask)) : txns;
}

export interface AccountChip {
  mask: string;
  label: string;
  count: number;
}

export function accountChips(accounts: Account[], txns: Transaction[]): AccountChip[] {
  const names = new Map(accounts.map((a) => [a.mask, a.name]));
  return accounts
    .filter((a) => !a.hidden)
    .map((a) => {
      const mine = txns.filter((t) => onAccount(t, a.mask));
      return {
        mask: a.mask,
        label: accountLabel(a.mask, names, mine[0]?.sourceSender ?? '') ?? `··${a.mask}`,
        count: mine.length,
      };
    })
    .sort((x, y) => y.count - x.count);
}

// Apps that pay credit-card bills from a bank account; the card purchases themselves are already counted, so paying
// the bill is money moving between the user's own Accounts. Plain "CRED" is left out: it also pays rent and shops.
const CARD_BILL_PAYEE = /\b(?:GOKIWI|CCBP|CHEQ)\b|^KIWI$|CREDIT CARD BILL/;

export function isCardBillPayment(t: Transaction): boolean {
  return t.direction === 'debit' && !!t.merchant && CARD_BILL_PAYEE.test(t.merchant.toUpperCase());
}

export function markCardBillPayments(txns: Transaction[]): Transaction[] {
  return txns
    .filter((t) => !t.selfTransferManual && !t.isSelfTransfer && isCardBillPayment(t))
    .map((t) => ({ ...t, isSelfTransfer: true }));
}
