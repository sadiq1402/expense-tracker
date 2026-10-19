import {
  accountChips,
  discoverAccounts,
  filterByAccount,
  markSelfTransfers,
  selfTransferPartner,
  visibleTxns,
  isCardBillPayment,
  markCardBillPayments,
} from '@/domain/accounts';

import { txn } from './fixtures/txn';

const MIN = 60_000;
let id = 0;
const newId = () => `a${++id}`;

beforeEach(() => {
  id = 0;
});

describe('discoverAccounts', () => {
  test('a new mask becomes an unconfirmed Account named A/c XX<mask>', () => {
    expect(discoverAccounts([txn({ accountMask: '1234' })], [], newId)).toEqual([
      { id: 'a1', mask: '1234', name: 'A/c XX1234', confirmed: false, hidden: false },
    ]);
  });

  test('known masks and missing masks create nothing; repeats create one', () => {
    const known = [{ id: 'k', mask: '1234', name: 'Salary', confirmed: true, hidden: false }];
    const txns = [
      txn({ accountMask: '1234' }),
      txn({ accountMask: null }),
      txn({ accountMask: '5678' }),
      txn({ accountMask: '5678' }),
    ];
    expect(discoverAccounts(txns, known, () => 'n').map((a) => a.mask)).toEqual(['5678']);
  });
});

test('a 3-digit mask of a known 4-digit Account is the same Account, not a new one', () => {
  const known = [{ id: 'k', mask: '1901', name: 'A/c XX1901', confirmed: false, hidden: false }];
  expect(discoverAccounts([txn({ accountMask: '901' })], known, () => 'n')).toEqual([]);
  expect(discoverAccounts([txn({ accountMask: '1901' }), txn({ accountMask: '901' })], [], () => 'n')).toHaveLength(1);
});

describe('markSelfTransfers', () => {
  const debit = (over = {}) => txn({ direction: 'debit', accountMask: '1234', occurredAt: 0, ...over });
  const credit = (over = {}) => txn({ direction: 'credit', accountMask: '5678', occurredAt: 7 * MIN, ...over });

  test('a debit and equal credit to another Account within 10 minutes are both Self-Transfers', () => {
    const [d, c] = [debit(), credit()];
    expect(markSelfTransfers([d, c])).toEqual([
      { ...d, isSelfTransfer: true },
      { ...c, isSelfTransfer: true },
    ]);
  });

  test('11 minutes apart is not a Self-Transfer', () => {
    expect(markSelfTransfers([debit(), credit({ occurredAt: 11 * MIN })])).toEqual([]);
  });

  test('the same Account on both sides is not a Self-Transfer', () => {
    expect(markSelfTransfers([debit(), credit({ accountMask: '1234' })])).toEqual([]);
  });

  test('masks of different length for the same Account are the same Account', () => {
    expect(markSelfTransfers([debit({ accountMask: '901' }), credit({ accountMask: '1901' })])).toEqual([]);
  });

  test('pairs closest first across the whole set, not in input order', () => {
    const c1 = credit({ occurredAt: 5 * MIN });
    const c2 = credit({ occurredAt: 1 * MIN });
    const d = debit({ occurredAt: 0 });
    const d2 = debit({ occurredAt: 12 * MIN });
    expect(
      markSelfTransfers([c1, c2, d, d2])
        .map((t) => t.id)
        .sort(),
    ).toEqual([c1.id, c2.id, d.id, d2.id].sort());
  });

  test('a Self-Transfer credit is never also a Refund', () => {
    const c = credit({ isRefund: true, categoryId: 'shopping' });
    expect(markSelfTransfers([debit(), c]).find((t) => t.id === c.id)).toMatchObject({
      isSelfTransfer: true,
      isRefund: false,
      categoryId: null,
    });
  });

  test('different amounts or a missing mask are not Self-Transfers', () => {
    expect(markSelfTransfers([debit(), credit({ amountPaise: 499900 })])).toEqual([]);
    expect(markSelfTransfers([debit({ accountMask: null }), credit()])).toEqual([]);
  });

  test('a manual choice is never overridden or used as a partner', () => {
    const unmarked = debit({ selfTransferManual: true, isSelfTransfer: false });
    expect(markSelfTransfers([unmarked, credit()])).toEqual([]);
  });

  test('each credit pairs with only one debit, the closest in time', () => {
    const far = debit({ occurredAt: 0 });
    const near = debit({ occurredAt: 6 * MIN });
    const c = credit();
    expect(markSelfTransfers([far, near, c]).map((t) => t.id)).toEqual([near.id, c.id]);
  });

  test('already-marked pairs are left alone', () => {
    expect(markSelfTransfers([debit({ isSelfTransfer: true }), credit({ isSelfTransfer: true })])).toEqual([]);
  });
});

describe('selfTransferPartner', () => {
  test('finds the other half of a marked pair so both can be unmarked together', () => {
    const d = txn({ direction: 'debit', accountMask: '1234', isSelfTransfer: true });
    const c = txn({ direction: 'credit', accountMask: '5678', occurredAt: 7 * MIN, isSelfTransfer: true });
    const other = txn({ direction: 'credit', accountMask: '5678', occurredAt: 30 * MIN, isSelfTransfer: true });
    expect(selfTransferPartner(d, [d, c, other])?.id).toBe(c.id);
    expect(selfTransferPartner(c, [d, c, other])?.id).toBe(d.id);
  });

  test('finds a likely partner for an unmarked transaction being marked by hand', () => {
    const d = txn({ direction: 'debit', accountMask: '1234' });
    const c = txn({ direction: 'credit', accountMask: '5678', occurredAt: 3 * MIN });
    expect(selfTransferPartner(d, [d, c])?.id).toBe(c.id);
  });

  test('no partner outside the window or on the same Account', () => {
    const d = txn({ direction: 'debit', accountMask: '1234' });
    expect(
      selfTransferPartner(d, [d, txn({ direction: 'credit', accountMask: '5678', occurredAt: 11 * MIN })]),
    ).toBeNull();
    expect(selfTransferPartner(d, [d, txn({ direction: 'credit', accountMask: '1234', occurredAt: MIN })])).toBeNull();
  });
});

const account = (mask: string, over = {}) => ({
  id: `a${mask}`,
  mask,
  name: `A/c XX${mask}`,
  confirmed: false,
  hidden: false,
  ...over,
});

describe('visibleTxns', () => {
  test('drops Transactions on hidden Accounts, keeps the rest and all Cash', () => {
    const txns = [
      txn({ id: 'h', accountMask: '1421' }),
      txn({ id: 'y', accountMask: '9762' }),
      txn({ id: 'c', accountMask: null, isCash: true }),
    ];
    const accounts = [account('1421', { hidden: true }), account('9762')];
    expect(visibleTxns(txns, accounts).map((t) => t.id)).toEqual(['y', 'c']);
  });

  test('a hidden 4-digit Account also hides SMS that print only 3 digits of it', () => {
    expect(visibleTxns([txn({ accountMask: '901' })], [account('1901', { hidden: true })])).toEqual([]);
  });

  test('with nothing hidden every Transaction shows', () => {
    const txns = [txn({ accountMask: '1421' })];
    expect(visibleTxns(txns, [account('1421')])).toBe(txns);
  });
});

describe('filterByAccount', () => {
  test('narrows to one Account, or returns everything for All accounts', () => {
    const txns = [
      txn({ id: 'a', accountMask: '1421' }),
      txn({ id: 'b', accountMask: '9762' }),
      txn({ id: 'c', accountMask: '421' }),
    ];
    expect(filterByAccount(txns, '1421').map((t) => t.id)).toEqual(['a', 'c']);
    expect(filterByAccount(txns, null)).toBe(txns);
  });
});

describe('accountChips', () => {
  test('one chip per shown Account, named by the user or by bank and mask, busiest first', () => {
    const txns = [
      txn({ accountMask: '1421', sourceSender: 'VM-HDFCBK' }),
      txn({ accountMask: '1421', sourceSender: 'VM-HDFCBK' }),
      txn({ accountMask: '9762', sourceSender: 'AD-YESBNK' }),
    ];
    const accounts = [account('9762'), account('1421', { name: 'Salary' }), account('7357', { hidden: true })];
    expect(accountChips(accounts, txns)).toEqual([
      { mask: '1421', label: 'Salary', count: 2 },
      { mask: '9762', label: 'Yes Bank ··9762', count: 1 },
    ]);
  });
});

describe('card bill payments', () => {
  test('payments to card-bill apps are recognised; ordinary CRED or shops are not', () => {
    expect(isCardBillPayment(txn({ merchant: 'GOKIWI TECH PRIVATE LIMIT' }))).toBe(true);
    expect(isCardBillPayment(txn({ merchant: 'KIWI' }))).toBe(true);
    expect(isCardBillPayment(txn({ merchant: 'CRED CCBP' }))).toBe(true);
    expect(isCardBillPayment(txn({ merchant: 'CHEQ CREDIT CAR' }))).toBe(true);
    expect(isCardBillPayment(txn({ merchant: 'CRED CLUB' }))).toBe(false);
    expect(isCardBillPayment(txn({ merchant: 'KIWI FRUIT SHOP' }))).toBe(false);
    expect(isCardBillPayment(txn({ merchant: 'SWIGGY' }))).toBe(false);
    expect(isCardBillPayment(txn({ merchant: 'GOKIWI TECH PRIVATE LIMIT', direction: 'credit' }))).toBe(false);
  });

  test('are marked Self-Transfer so they leave every total, unless the user decided otherwise', () => {
    const txns = [
      txn({ id: 'k', merchant: 'GOKIWI TECH PRIVATE LIMIT' }),
      txn({ id: 'm', merchant: 'KIWI', selfTransferManual: true, isSelfTransfer: false }),
      txn({ id: 'done', merchant: 'CRED CCBP', isSelfTransfer: true }),
      txn({ id: 's', merchant: 'SWIGGY' }),
    ];
    expect(markCardBillPayments(txns).map((t) => [t.id, t.isSelfTransfer])).toEqual([['k', true]]);
  });
});
