import {
  breakdownSummary,
  breakdownTxns,
  merchantCategoryOf,
  merchantPayments,
  recategorizeMerchant,
} from '@/domain/breakdown';
import { rangeFor } from '@/domain/dateRange';

import { txn } from './fixtures/txn';

const ist = (iso: string) => Date.parse(`${iso}+05:30`);
const OCTOBER = rangeFor('month', ist('2026-10-18T10:00:00'));
const oct = (day: number) => ist(`2026-10-${String(day).padStart(2, '0')}T12:00:00`);

describe('breakdownTxns', () => {
  const txns = [
    txn({ merchant: 'GOKIWI TECH', amountPaise: 400000, occurredAt: oct(5), categoryId: 'other' }),
    txn({ merchant: 'GOKIWI TECH', amountPaise: 900000, occurredAt: oct(16), categoryId: 'other' }),
    txn({ merchant: 'GOKIWI TECH', amountPaise: 100000, occurredAt: ist('2026-09-30T12:00:00'), categoryId: 'other' }),
    txn({ merchant: 'SWIGGY', amountPaise: 30000, occurredAt: oct(10), categoryId: 'food' }),
    txn({ merchant: 'RAHUL', amountPaise: 500000, occurredAt: oct(11), categoryId: 'other', isSelfTransfer: true }),
  ];

  test('a Merchant view lists that Merchant’s Transactions in the range, newest first', () => {
    expect(breakdownTxns(txns, { kind: 'merchant', key: 'GOKIWI TECH' }, OCTOBER).map((t) => t.occurredAt)).toEqual([
      oct(16),
      oct(5),
    ]);
  });

  test('a Category view keeps only Transactions that count toward spend', () => {
    expect(breakdownTxns(txns, { kind: 'category', key: 'other' }, OCTOBER)).toHaveLength(2);
    expect(
      breakdownTxns([txn({ categoryId: null, occurredAt: oct(3) })], { kind: 'category', key: 'other' }, OCTOBER),
    ).toHaveLength(1);
  });
});

describe('breakdownSummary', () => {
  test('spend, payments, average and share of the range follow the spend rules', () => {
    const shown = [
      txn({ amountPaise: 900000 }),
      txn({ amountPaise: 400000 }),
      txn({ amountPaise: 100000, direction: 'credit', isRefund: true }),
    ];
    expect(breakdownSummary(shown, 4000000)).toEqual({
      spendPaise: 1200000,
      payments: 2,
      averagePaise: 600000,
      sharePct: 30,
    });
  });

  test('handles no payments and no range spend', () => {
    expect(breakdownSummary([], 0)).toEqual({ spendPaise: 0, payments: 0, averagePaise: 0, sharePct: 0 });
  });
});

describe('recategorizeMerchant', () => {
  test('moves every debit to that Merchant, including SMS variants, and returns the rule', () => {
    const txns = [
      txn({ id: 'a', merchant: 'SWIGGY*BANGALORE', categoryId: 'other' }),
      txn({ id: 'b', merchant: 'SWIGGY*MUMBAI', categoryId: 'shopping' }),
      txn({ id: 'c', merchant: 'SWIGGY', categoryId: null, direction: 'credit' }),
      txn({ id: 'd', merchant: 'ZOMATO', categoryId: 'other' }),
      txn({ id: 'e', merchant: 'SWIGGY', categoryId: 'food' }),
    ];
    const { rule, changed } = recategorizeMerchant(txns, 'SWIGGY*BANGALORE', 'food');
    expect(rule).toEqual({ merchant: 'SWIGGY', categoryId: 'food', source: 'user' });
    expect(changed.map((t) => [t.id, t.categoryId])).toEqual([
      ['a', 'food'],
      ['b', 'food'],
    ]);
  });

  test('Refunds from the Merchant follow the new Category too', () => {
    const txns = [txn({ id: 'r', merchant: 'AMAZON', categoryId: 'other', direction: 'credit', isRefund: true })];
    expect(recategorizeMerchant(txns, 'AMAZON', 'shopping').changed.map((t) => t.categoryId)).toEqual(['shopping']);
  });
});

describe('merchantPayments', () => {
  test('counts the same payments a Category change would move, SMS variants included', () => {
    const txns = [
      txn({ merchant: 'SWIGGY*BANGALORE' }),
      txn({ merchant: 'SWIGGY*MUMBAI' }),
      txn({ merchant: 'SWIGGY', direction: 'credit', isRefund: true }),
      txn({ merchant: 'SWIGGY', direction: 'credit' }),
      txn({ merchant: 'ZOMATO' }),
    ];
    expect(merchantPayments(txns, 'SWIGGY*BANGALORE')).toHaveLength(3);
    expect(recategorizeMerchant(txns, 'SWIGGY*BANGALORE', 'food').changed).toHaveLength(3);
  });
});

describe('merchantCategoryOf', () => {
  test('is the Category of the Merchant’s most recent payment', () => {
    const txns = [
      txn({ merchant: 'SWIGGY', occurredAt: 1, categoryId: 'other' }),
      txn({ merchant: 'SWIGGY', occurredAt: 9, categoryId: 'food' }),
    ];
    expect(merchantCategoryOf(txns, 'SWIGGY')).toBe('food');
    expect(merchantCategoryOf([], 'SWIGGY')).toBe('other');
  });
});

test('choosing the Category most payments already have still moves the stragglers', () => {
  const txns = [
    txn({ id: 'old', merchant: 'SWIGGY', occurredAt: 1, categoryId: 'other' }),
    txn({ id: 'new', merchant: 'SWIGGY', occurredAt: 9, categoryId: 'food' }),
  ];
  expect(recategorizeMerchant(txns, 'SWIGGY', 'food').changed.map((t) => t.id)).toEqual(['old']);
});

test('a Category whose Refunds outweigh its spend reads as zero, not negative', () => {
  expect(breakdownSummary([txn({ amountPaise: 1000, direction: 'credit', isRefund: true })], 5000)).toEqual({
    spendPaise: 0,
    payments: 0,
    averagePaise: 0,
    sharePct: 0,
  });
});
