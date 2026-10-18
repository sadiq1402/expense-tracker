import { monthlyTrend, spendByCategory, splitTop, topMerchants, totalSpend, trendAverage } from '@/domain/aggregate';
import {
  dayRange,
  istDayFromPicker,
  monthLabel,
  monthRangeOf,
  pickerDateFromIstDay,
  rangeFor,
} from '@/domain/dateRange';
import { classifyCredit } from '@/domain/categorize';
import type { Transaction } from '@/domain/types';

const ist = (iso: string) => Date.parse(`${iso}+05:30`);

let n = 0;
const txn = (over: Partial<Transaction>): Transaction => ({
  amountPaise: 10000,
  direction: 'debit',
  occurredAt: ist('2026-10-10T12:00:00'),
  accountMask: '1234',
  upiRef: null,
  merchant: 'SWIGGY',
  channel: 'upi',
  sourceSmsId: `s${++n}`,
  sourceSender: 'VM-HDFCBK',
  id: `t${n}`,
  sourceSmsIds: [`s${n}`],
  sourceSenders: ['VM-HDFCBK'],
  categoryId: 'food',
  note: null,
  isSelfTransfer: false,
  selfTransferManual: false,
  isExcluded: false,
  isRefund: false,
  isCash: false,
  accountId: null,
  ...over,
});

const NOW = ist('2026-10-18T10:00:00');
const OCTOBER = rangeFor('month', NOW);

describe('rangeFor', () => {
  test('month is the current calendar month in IST', () => {
    expect(OCTOBER).toEqual({ start: ist('2026-10-01T00:00:00'), end: ist('2026-11-01T00:00:00') });
  });

  test('month boundary uses IST, not UTC', () => {
    // 2026-11-01 01:00 IST is still October 31 in UTC
    expect(rangeFor('month', ist('2026-11-01T01:00:00')).start).toBe(ist('2026-11-01T00:00:00'));
  });

  test('week starts Monday 00:00 IST', () => {
    // 2026-10-18 is a Sunday
    expect(rangeFor('week', NOW)).toEqual({ start: ist('2026-10-12T00:00:00'), end: ist('2026-10-19T00:00:00') });
    expect(rangeFor('week', ist('2026-10-19T00:30:00')).start).toBe(ist('2026-10-19T00:00:00'));
  });
});

describe('monthRangeOf', () => {
  test('a trend month key maps to that whole IST month', () => {
    expect(monthRangeOf('2026-08')).toEqual({ start: ist('2026-08-01T00:00:00'), end: ist('2026-09-01T00:00:00') });
  });

  test('December rolls into the next year', () => {
    expect(monthRangeOf('2025-12').end).toBe(ist('2026-01-01T00:00:00'));
  });

  test('matches the current-month range for the current month', () => {
    expect(monthRangeOf('2026-10')).toEqual(OCTOBER);
  });
});

describe('dayRange', () => {
  test('covers whole IST days from the first to the last picked date', () => {
    expect(dayRange(ist('2026-10-05T18:00:00'), ist('2026-10-07T09:00:00'))).toEqual({
      start: ist('2026-10-05T00:00:00'),
      end: ist('2026-10-08T00:00:00'),
    });
  });

  test('swaps the dates if picked backwards', () => {
    expect(dayRange(ist('2026-10-07T09:00:00'), ist('2026-10-05T09:00:00'))).toEqual(
      dayRange(ist('2026-10-05T09:00:00'), ist('2026-10-07T09:00:00')),
    );
  });
});

describe('date picker conversion', () => {
  test('a picked calendar day maps to that day in IST whatever the device timezone', () => {
    expect(istDayFromPicker(new Date(2026, 9, 10, 20, 0))).toBe(ist('2026-10-10T00:00:00'));
  });

  test('round-trips an IST day through the picker', () => {
    const day = ist('2026-10-10T00:00:00');
    expect(istDayFromPicker(pickerDateFromIstDay(day))).toBe(day);
  });

  test('labels a month key', () => {
    expect(monthLabel('2026-10')).toBe('Oct');
  });
});

describe('totalSpend', () => {
  test('is the true net, so a refund larger than its Category spend still reduces it', () => {
    const txns = [
      txn({ amountPaise: 50000, categoryId: 'travel' }),
      txn({ amountPaise: 20000, categoryId: 'shopping', direction: 'credit', isRefund: true }),
    ];
    expect(totalSpend(txns, OCTOBER)).toBe(30000);
    expect(spendByCategory(txns, OCTOBER)).toEqual([{ categoryId: 'travel', amountPaise: 50000 }]);
  });
});

describe('spendByCategory', () => {
  test('sums debits per Category, largest first', () => {
    const txns = [
      txn({ amountPaise: 10000 }),
      txn({ amountPaise: 5000 }),
      txn({ amountPaise: 30000, categoryId: 'travel', merchant: 'UBER' }),
    ];
    expect(spendByCategory(txns, OCTOBER)).toEqual([
      { categoryId: 'travel', amountPaise: 30000 },
      { categoryId: 'food', amountPaise: 15000 },
    ]);
  });

  test('refunds reduce spend; other credits, Excluded and Self-Transfers do not count', () => {
    const txns = [
      txn({ amountPaise: 50000 }),
      txn({ amountPaise: 20000, direction: 'credit', isRefund: true }),
      txn({ amountPaise: 99900, direction: 'credit', categoryId: null }),
      txn({ amountPaise: 70000, isExcluded: true }),
      txn({ amountPaise: 80000, isSelfTransfer: true }),
    ];
    expect(spendByCategory(txns, OCTOBER)).toEqual([{ categoryId: 'food', amountPaise: 30000 }]);
  });

  test('Amazon debit ₹2,000 then Amazon credit ₹500 → Shopping spend ₹1,500', () => {
    const purchase = txn({ merchant: 'AMAZON', amountPaise: 200000, categoryId: 'shopping' });
    const credit = txn({ merchant: 'AMAZON', amountPaise: 50000, direction: 'credit', categoryId: null });
    const refund = { ...credit, ...classifyCredit(credit, [purchase]) };
    expect(spendByCategory([purchase, refund], OCTOBER)).toEqual([{ categoryId: 'shopping', amountPaise: 150000 }]);
  });

  test('Cash Transactions count', () => {
    expect(spendByCategory([txn({ isCash: true, merchant: null })], OCTOBER)).toEqual([
      { categoryId: 'food', amountPaise: 10000 },
    ]);
  });

  test('a transaction at 2026-10-31 23:30 IST counts in October, not November', () => {
    const late = txn({ occurredAt: ist('2026-10-31T23:30:00') });
    expect(spendByCategory([late], OCTOBER)).toHaveLength(1);
    expect(spendByCategory([late], rangeFor('month', ist('2026-11-05T12:00:00')))).toEqual([]);
  });

  test('uncategorized debits are grouped under Other', () => {
    expect(spendByCategory([txn({ categoryId: null })], OCTOBER)).toEqual([
      { categoryId: 'other', amountPaise: 10000 },
    ]);
  });
});

describe('monthlyTrend', () => {
  test('returns the last N IST months oldest first, including empty ones', () => {
    const txns = [
      txn({ occurredAt: ist('2026-10-31T23:30:00'), amountPaise: 100 }),
      txn({ occurredAt: ist('2026-08-01T00:10:00'), amountPaise: 200 }),
      txn({ occurredAt: ist('2026-04-15T12:00:00'), amountPaise: 999 }),
    ];
    expect(monthlyTrend(txns, 3, NOW)).toEqual([
      { month: '2026-08', amountPaise: 200 },
      { month: '2026-09', amountPaise: 0 },
      { month: '2026-10', amountPaise: 100 },
    ]);
  });

  test('crosses year boundaries', () => {
    expect(monthlyTrend([], 3, ist('2027-01-10T00:00:00')).map((m) => m.month)).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
  });
});

describe('topMerchants', () => {
  test('ranks Merchants by net spend with payment counts', () => {
    const txns = [
      txn({ merchant: 'SWIGGY', amountPaise: 10000 }),
      txn({ merchant: 'SWIGGY', amountPaise: 10000 }),
      txn({ merchant: 'SWIGGY', amountPaise: 5000, direction: 'credit', isRefund: true }),
      txn({ merchant: 'UBER', amountPaise: 40000 }),
      txn({ merchant: 'ZOMATO', amountPaise: 100 }),
      txn({ merchant: null, amountPaise: 90000, isCash: true }),
    ];
    expect(topMerchants(txns, OCTOBER, 2)).toEqual([
      { merchant: 'UBER', amountPaise: 40000, count: 1 },
      { merchant: 'SWIGGY', amountPaise: 15000, count: 2 },
    ]);
  });
});

describe('trendAverage', () => {
  test('averages the months, rounding to whole paise', () => {
    expect(trendAverage([{ amountPaise: 100 }, { amountPaise: 201 }])).toBe(151);
  });

  test('is zero for no months', () => {
    expect(trendAverage([])).toBe(0);
  });
});

describe('splitTop', () => {
  test('keeps the first N and counts the rest', () => {
    expect(splitTop([1, 2, 3, 4, 5, 6], 4)).toEqual({ top: [1, 2, 3, 4], rest: [5, 6] });
    expect(splitTop([1, 2], 4)).toEqual({ top: [1, 2], rest: [] });
  });
});
