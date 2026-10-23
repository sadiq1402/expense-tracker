import { applyCheck, flagUnchecked, uncheckedExpenses } from '@/domain/categoryCheck';
import type { Account, MerchantRule } from '@/domain/types';

import { txn } from './fixtures/txn';

const userRule = (merchant: string, categoryId: string): MerchantRule => ({ merchant, categoryId, source: 'user' });

describe('flagUnchecked', () => {
  test('an Expense from a Merchant the user never taught is unchecked', () => {
    const [t] = flagUnchecked([txn({ merchant: 'SWIGGY', categoryId: 'food' })], [], [], []);
    expect(t.unchecked).toBe(true);
    expect(t.categoryId).toBe('food');
  });

  test('an Expense from a Merchant the user taught skips the check', () => {
    const [t] = flagUnchecked(
      [txn({ merchant: 'SWIGGY*BANGALORE', categoryId: 'groceries' })],
      [],
      [userRule('SWIGGY', 'groceries')],
      [],
    );
    expect(t.unchecked).toBeFalsy();
  });

  test("a Mixed Merchant is always asked about, guessing the user's latest pick", () => {
    const history = [
      txn({ merchant: 'KRISHNA STORES', categoryId: 'food', occurredAt: 1_000 }),
      txn({ merchant: 'KRISHNA STORES', categoryId: 'laundry', occurredAt: 2_000 }),
      txn({ merchant: 'KRISHNA STORES', categoryId: 'other', occurredAt: 3_000, unchecked: true }),
    ];
    const [t] = flagUnchecked(
      [txn({ merchant: 'PAYTM*KRISHNA STORES', categoryId: 'other', occurredAt: 4_000 })],
      history,
      [userRule('KRISHNA', 'food')],
      ['KRISHNA STORES'],
    );
    expect(t.unchecked).toBe(true);
    expect(t.categoryId).toBe('laundry');
  });

  test('credits are never checked', () => {
    const [t] = flagUnchecked([txn({ merchant: 'RAMESH', direction: 'credit' })], [], [], []);
    expect(t.unchecked).toBeFalsy();
  });
});

describe('uncheckedExpenses', () => {
  const account = (mask: string, hidden = false): Account => ({ id: mask, mask, name: mask, confirmed: true, hidden });

  test('lists unchecked Expenses newest first, leaving out everything not counted as spending', () => {
    const txns = [
      txn({ id: 'old', unchecked: true, occurredAt: 1_000 }),
      txn({ id: 'new', unchecked: true, occurredAt: 2_000 }),
      txn({ id: 'checked', occurredAt: 3_000 }),
      txn({ id: 'self', unchecked: true, isSelfTransfer: true }),
      txn({ id: 'excluded', unchecked: true, isExcluded: true }),
      txn({ id: 'hidden', unchecked: true, accountMask: '9999' }),
    ];
    expect(uncheckedExpenses(txns, [account('9999', true)]).map((t) => t.id)).toEqual(['new', 'old']);
  });
});

describe('applyCheck', () => {
  test('confirming a pick saves it as checked and teaches the Merchant', () => {
    const t = txn({ merchant: 'SWIGGY*BANGALORE', categoryId: 'food', unchecked: true });
    const result = applyCheck([{ txn: t, categoryId: 'food' }], [], []);
    expect(result.txns).toEqual([{ ...t, categoryId: 'food', unchecked: false }]);
    expect(result.upsertRules).toEqual([userRule('SWIGGY', 'food')]);
    expect(result.removeRules).toEqual([]);
    expect(result.addMixed).toEqual([]);
  });

  test('leaving an Expense on Other checks it but teaches nothing', () => {
    const t = txn({ merchant: 'KRISHNA STORES', categoryId: 'other', unchecked: true });
    const result = applyCheck([{ txn: t, categoryId: 'other' }], [], []);
    expect(result.txns[0].unchecked).toBe(false);
    expect(result.upsertRules).toEqual([]);
  });

  test('moving a guess to Other is a real answer and teaches it', () => {
    const t = txn({ merchant: 'AMAZON', categoryId: 'shopping', unchecked: true });
    expect(applyCheck([{ txn: t, categoryId: 'other' }], [], []).upsertRules).toEqual([userRule('AMAZON', 'other')]);
  });

  test("a Mixed Merchant's pick changes only that Expense", () => {
    const t = txn({ merchant: 'PAYTM*KRISHNA STORES', unchecked: true });
    const result = applyCheck([{ txn: t, categoryId: 'food' }], [], ['KRISHNA STORES']);
    expect(result.txns[0].categoryId).toBe('food');
    expect(result.upsertRules).toEqual([]);
    expect(result.addMixed).toEqual([]);
  });

  test("a pick that disagrees with the user's Merchant Rule makes the Merchant Mixed", () => {
    const t = txn({ merchant: 'KRISHNA STORES', categoryId: 'food' });
    const result = applyCheck([{ txn: t, categoryId: 'laundry' }], [userRule('KRISHNA STORES', 'food')], []);
    expect(result.txns[0].categoryId).toBe('laundry');
    expect(result.upsertRules).toEqual([]);
    expect(result.removeRules).toEqual(['KRISHNA STORES']);
    expect(result.addMixed).toEqual(['KRISHNA STORES']);
  });

  test('overriding a built-in guess just teaches the new Category', () => {
    const t = txn({ merchant: 'SWIGGY', categoryId: 'food', unchecked: true });
    const result = applyCheck([{ txn: t, categoryId: 'groceries' }], [], []);
    expect(result.upsertRules).toEqual([userRule('SWIGGY', 'groceries')]);
    expect(result.addMixed).toEqual([]);
  });

  test('two picks for one Merchant in different Categories make it Mixed', () => {
    const a = txn({ merchant: 'KRISHNA STORES', unchecked: true });
    const b = txn({ merchant: 'PAYTM*KRISHNA STORES', unchecked: true });
    const c = txn({ merchant: 'KRISHNA STORES', unchecked: true });
    const result = applyCheck(
      [
        { txn: a, categoryId: 'food' },
        { txn: b, categoryId: 'laundry' },
        { txn: c, categoryId: 'other' },
      ],
      [],
      [],
    );
    expect(result.txns.map((t) => t.categoryId)).toEqual(['food', 'laundry', 'other']);
    expect(result.upsertRules).toEqual([]);
    expect(result.addMixed).toEqual(['KRISHNA STORES']);
  });

  test('two picks for one Merchant in the same Category teach it once', () => {
    const picks = [txn({ merchant: 'SWIGGY' }), txn({ merchant: 'SWIGGY*MUMBAI' })].map((t) => ({
      txn: t,
      categoryId: 'food',
    }));
    expect(applyCheck(picks, [], []).upsertRules).toEqual([userRule('SWIGGY', 'food')]);
  });
});
