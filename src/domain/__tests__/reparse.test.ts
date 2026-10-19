import { refreshMerchants } from '@/domain/reparse';

import { txn } from './fixtures/txn';

const parsed = (sourceSmsId: string, merchant: string | null) => ({ ...txn({ sourceSmsId, merchant }), sourceSmsId });

describe('refreshMerchants', () => {
  test('fills a missing or bad Merchant from the improved parser and re-categorizes default-Other debits', () => {
    const stored = [
      txn({ id: 'a', sourceSmsIds: ['s1'], merchant: null, categoryId: 'other' }),
      txn({ id: 'b', sourceSmsIds: ['s2'], merchant: 'DISPUTE', categoryId: 'other' }),
    ];
    const changed = refreshMerchants(stored, [parsed('s1', 'SWIGGYFOOD'), parsed('s2', 'MAHADEV')], []);
    expect(changed.map((t) => [t.id, t.merchant, t.categoryId])).toEqual([
      ['a', 'SWIGGYFOOD', 'food'],
      ['b', 'MAHADEV', 'other'],
    ]);
  });

  test('never overrides a Category the user chose, or a Merchant the user edited', () => {
    const stored = [
      txn({ id: 'a', sourceSmsIds: ['s1'], merchant: null, categoryId: 'rent' }),
      txn({ id: 'b', sourceSmsIds: ['s2'], merchant: 'MY LANDLORD', categoryId: 'rent' }),
    ];
    const changed = refreshMerchants(stored, [parsed('s1', 'SWIGGYFOOD'), parsed('s2', 'SOMEONE')], []);
    expect(changed.map((t) => [t.id, t.merchant, t.categoryId])).toEqual([['a', 'SWIGGYFOOD', 'rent']]);
  });

  test('a user Merchant Rule applies to the newly named Merchant', () => {
    const stored = [txn({ id: 'a', sourceSmsIds: ['s1'], merchant: null, categoryId: 'other' })];
    const rules = [{ merchant: 'MAHADEV', categoryId: 'groceries', source: 'user' as const }];
    expect(refreshMerchants(stored, [parsed('s1', 'MAHADEV SUPER MARK')], rules)[0].categoryId).toBe('groceries');
  });

  test('leaves Transactions alone when the fresh parse adds nothing', () => {
    const stored = [txn({ id: 'a', sourceSmsIds: ['s1'], merchant: 'SWIGGY', categoryId: 'food' })];
    expect(refreshMerchants(stored, [parsed('s1', 'SWIGGY'), parsed('s9', 'X')], [])).toEqual([]);
  });
});
