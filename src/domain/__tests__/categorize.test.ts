import { categorize, DEFAULT_CATEGORIES, newCategory, ruleFromCorrection } from '@/domain/categorize';
import type { Transaction } from '@/domain/types';

const txn = (merchant: string | null, over: Partial<Transaction> = {}): Transaction => ({
  amountPaise: 25000,
  direction: 'debit',
  occurredAt: 1_000,
  accountMask: '1234',
  upiRef: null,
  merchant,
  channel: 'upi',
  sourceSmsId: 's1',
  sourceSender: 'VM-HDFCBK',
  id: 't1',
  sourceSmsIds: ['s1'],
  sourceSenders: ['VM-HDFCBK'],
  categoryId: null,
  note: null,
  isSelfTransfer: false,
  selfTransferManual: false,
  isExcluded: false,
  isRefund: false,
  isCash: false,
  accountId: null,
  ...over,
});

describe('categorize', () => {
  test('seed rules match merchants case-insensitively by substring', () => {
    expect(categorize(txn('SWIGGY*BANGALORE'), [])).toBe('food');
    expect(categorize(txn('upi.zepto@icici'), [])).toBe('groceries');
    expect(categorize(txn('IRCTC E-TICKETING'), [])).toBe('travel');
  });

  test('a user rule beats the seed rule for the same merchant', () => {
    const rule = ruleFromCorrection(txn('SWIGGY'), 'groceries')!;
    expect(categorize(txn('SWIGGY*BANGALORE'), [rule])).toBe('groceries');
  });

  test('unknown or missing debit merchant falls back to Other', () => {
    expect(categorize(txn('RAMESH KIRANA'), [])).toBe('other');
    expect(categorize(txn(null), [])).toBe('other');
  });

  test('credits are left uncategorized', () => {
    expect(categorize(txn('SWIGGY', { direction: 'credit' }), [])).toBeNull();
  });

  test('a seed only matches a whole word', () => {
    expect(categorize(txn('COCA COLA'), [])).toBe('other');
    expect(categorize(txn('METROPOLIS LABS'), [])).toBe('other');
    expect(categorize(txn('UBEREATS'), [])).toBe('food');
    expect(categorize(txn('JIOMART'), [])).toBe('groceries');
  });

  test('the longest matching seed wins', () => {
    expect(categorize(txn('AMAZON PRIME VIDEO'), [])).toBe('entertainment');
    expect(categorize(txn('AMAZON PAY'), [])).toBe('shopping');
  });
});

describe('ruleFromCorrection', () => {
  test('correcting one transaction categorizes later ones from that merchant', () => {
    const rule = ruleFromCorrection(txn('Ramesh Kirana'), 'groceries')!;
    expect(rule).toEqual({ merchant: 'RAMESH KIRANA', categoryId: 'groceries', source: 'user' });
    expect(categorize(txn('RAMESH KIRANA', { id: 't2' }), [rule])).toBe('groceries');
  });

  test('a correction covers other SMS variants of the same merchant', () => {
    const store = ruleFromCorrection(txn('SWIGGY*BANGALORE'), 'shopping')!;
    expect(categorize(txn('SWIGGY*MUMBAI'), [store])).toBe('shopping');
    const vpa = ruleFromCorrection(txn('ramesh.k@okaxis'), 'people')!;
    expect(categorize(txn('RAMESH.K@YBL'), [vpa])).toBe('people');
  });

  test('correcting a credit creates no rule', () => {
    expect(ruleFromCorrection(txn('RAHUL', { direction: 'credit' }), 'people')).toBeNull();
  });

  test('returns null when there is no merchant to remember', () => {
    expect(ruleFromCorrection(txn(null), 'food')).toBeNull();
  });
});

describe('newCategory', () => {
  test('adds a custom category with a trimmed name', () => {
    expect(newCategory('  Pets ', DEFAULT_CATEGORIES, () => 'c1')).toEqual({ id: 'c1', name: 'Pets', builtIn: false });
  });

  test('rejects empty and duplicate names', () => {
    expect(newCategory('   ', DEFAULT_CATEGORIES, () => 'c1')).toBeNull();
    expect(newCategory('food', DEFAULT_CATEGORIES, () => 'c1')).toBeNull();
  });

  test('ships the ten default categories', () => {
    expect(DEFAULT_CATEGORIES.map((c) => c.name)).toEqual([
      'Food',
      'Groceries',
      'Shopping',
      'Travel',
      'Bills & Utilities',
      'Rent',
      'Entertainment',
      'Health',
      'Transfers to People',
      'Other',
    ]);
  });
});
