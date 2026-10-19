import { categorize, classifyCredit, DEFAULT_CATEGORIES, newCategory, ruleFromCorrection } from '@/domain/categorize';
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

  test('card SMS spellings that join brand and product', () => {
    expect(categorize(txn('SWIGGYFOOD'), [])).toBe('food');
    expect(categorize(txn('SWIGGYINSTAMART'), [])).toBe('groceries');
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

describe('classifyCredit', () => {
  const debit = (merchant: string, categoryId: string, occurredAt: number, id = `d${occurredAt}`) =>
    txn(merchant, { id, occurredAt, categoryId });
  const credit = (merchant: string | null, occurredAt = 10_000) =>
    txn(merchant, { id: 'c1', direction: 'credit', occurredAt });

  test('a credit from a Merchant previously paid is a Refund in that Category', () => {
    const history = [debit('AMAZON', 'shopping', 1_000)];
    expect(classifyCredit(credit('AMAZON'), history)).toEqual({ isRefund: true, categoryId: 'shopping' });
  });

  test('matches SMS variants of the same Merchant', () => {
    const history = [debit('AMAZON PAY', 'shopping', 1_000)];
    expect(classifyCredit(credit('AMAZON'), history)).toEqual({ isRefund: true, categoryId: 'shopping' });
    expect(classifyCredit(credit('SWIGGY*MUMBAI'), [debit('SWIGGY*BANGALORE', 'food', 1_000)])).toEqual({
      isRefund: true,
      categoryId: 'food',
    });
  });

  test('takes the Category of the most recent earlier payment', () => {
    const history = [
      debit('AMAZON', 'shopping', 1_000),
      debit('AMAZON', 'entertainment', 5_000),
      debit('AMAZON', 'bills', 20_000),
    ];
    expect(classifyCredit(credit('AMAZON'), history).categoryId).toBe('entertainment');
  });

  test('a credit from someone never paid is not a Refund and has no Category', () => {
    const history = [debit('AMAZON', 'shopping', 1_000)];
    expect(classifyCredit(credit('RAHUL'), history)).toEqual({ isRefund: false, categoryId: null });
    expect(classifyCredit(credit(null), history)).toEqual({ isRefund: false, categoryId: null });
  });

  test('payments made only after the credit do not make it a Refund', () => {
    expect(classifyCredit(credit('AMAZON', 1_000), [debit('AMAZON', 'shopping', 5_000)]).isRefund).toBe(false);
  });

  test('a friend paid under Transfers to People who pays back is not a Refund', () => {
    const history = [debit('RAHUL', 'people', 1_000)];
    expect(classifyCredit(credit('RAHUL'), history)).toEqual({ isRefund: false, categoryId: null });
  });

  test('a friend paid under the default Other who pays back is not a Refund', () => {
    expect(classifyCredit(credit('RAHUL'), [debit('RAHUL SHARMA', 'other', 1_000)])).toEqual({
      isRefund: false,
      categoryId: null,
    });
  });

  test('payment gateways and generic words are not evidence of a purchase', () => {
    const history = [debit('AMAZON PAY', 'shopping', 1_000), debit('RAZORPAY', 'shopping', 2_000)];
    expect(classifyCredit(credit('PAY'), history).isRefund).toBe(false);
    expect(classifyCredit(credit('RAZORPAY'), history).isRefund).toBe(false);
  });

  test('excluded payments and other credits are not evidence of a purchase', () => {
    const history = [
      txn('AMAZON', { id: 'x', occurredAt: 1_000, categoryId: 'shopping', isExcluded: true }),
      txn('AMAZON', { id: 'y', occurredAt: 2_000, categoryId: null, direction: 'credit' }),
    ];
    expect(classifyCredit(credit('AMAZON'), history).isRefund).toBe(false);
  });
});
