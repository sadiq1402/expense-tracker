import { spendByCategory } from '@/domain/aggregate';
import { newCashTransaction } from '@/domain/cash';
import { rangeFor } from '@/domain/dateRange';
import { merchantLabel } from '@/domain/format';

const ist = (iso: string) => Date.parse(`${iso}+05:30`);
const OCT_10 = ist('2026-10-10T00:00:00');

describe('newCashTransaction', () => {
  test('creates a Cash Transaction counted in dashboard spend', () => {
    const txn = newCashTransaction({ amount: '250', categoryId: 'food', note: ' chai ', day: OCT_10 }, () => 'c1');
    expect(txn).toMatchObject({
      id: 'c1',
      amountPaise: 25000,
      direction: 'debit',
      categoryId: 'food',
      note: 'chai',
      isCash: true,
      channel: 'other',
      merchant: null,
      upiRef: null,
    });
    expect(spendByCategory([txn!], rangeFor('month', OCT_10))).toEqual([{ categoryId: 'food', amountPaise: 25000 }]);
  });

  test('is dated midday IST so it stays on the picked day', () => {
    expect(newCashTransaction({ amount: '1', categoryId: 'food', note: '', day: OCT_10 }, () => 'c1')?.occurredAt).toBe(
      ist('2026-10-10T12:00:00'),
    );
  });

  test('a blank note is stored as null', () => {
    expect(newCashTransaction({ amount: '1', categoryId: 'food', note: '  ', day: OCT_10 }, () => 'c1')?.note).toBeNull();
  });

  test('has its own source id so SMS dedup never touches it', () => {
    const txn = newCashTransaction({ amount: '1', categoryId: 'food', note: '', day: OCT_10 }, () => 'c1')!;
    expect(txn.sourceSmsIds).toEqual(['cash:c1']);
    expect(txn.sourceSenders).toEqual([]);
  });

  test('rejects a missing or invalid amount', () => {
    expect(newCashTransaction({ amount: '', categoryId: 'food', note: '', day: OCT_10 }, () => 'c1')).toBeNull();
    expect(newCashTransaction({ amount: '0', categoryId: 'food', note: '', day: OCT_10 }, () => 'c1')).toBeNull();
    expect(newCashTransaction({ amount: 'abc', categoryId: 'food', note: '', day: OCT_10 }, () => 'c1')).toBeNull();
  });
});

test('an Excluded Transaction drops out of totals and returns when un-excluded', () => {
  const txn = newCashTransaction({ amount: '250', categoryId: 'food', note: '', day: OCT_10 }, () => 'c1')!;
  const october = rangeFor('month', OCT_10);
  expect(spendByCategory([{ ...txn, isExcluded: true }], october)).toEqual([]);
  expect(spendByCategory([{ ...txn, isExcluded: false }], october)).toEqual([{ categoryId: 'food', amountPaise: 25000 }]);
});

test('labels a Transaction by Merchant, Cash, or Unknown', () => {
  const txn = newCashTransaction({ amount: '1', categoryId: 'food', note: '', day: OCT_10 }, () => 'c1')!;
  expect(merchantLabel(txn)).toBe('Cash');
  expect(merchantLabel({ ...txn, isCash: false })).toBe('Unknown');
  expect(merchantLabel({ ...txn, merchant: 'SWIGGY' })).toBe('SWIGGY');
});
