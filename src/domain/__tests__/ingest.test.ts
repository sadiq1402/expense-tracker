import { mergeIntoExisting } from '@/domain/ingest';
import type { ParsedTxn } from '@/domain/types';

const parsed = (sourceSmsId: string, over: Partial<ParsedTxn> = {}): ParsedTxn => ({
  amountPaise: 25000,
  direction: 'debit',
  occurredAt: 1_000,
  accountMask: '1234',
  upiRef: null,
  merchant: 'SWIGGY',
  channel: 'upi',
  sourceSmsId,
  ...over,
});

let n = 0;
const newId = () => `t${++n}`;

beforeEach(() => {
  n = 0;
});

describe('mergeIntoExisting', () => {
  test('creates a transaction with defaults for a new sms', () => {
    const { created, updated } = mergeIntoExisting([], [parsed('s1')], newId);
    expect(updated).toEqual([]);
    expect(created).toEqual([
      {
        ...parsed('s1'),
        id: 't1',
        sourceSmsIds: ['s1'],
        categoryId: null,
        note: null,
        isSelfTransfer: false,
        selfTransferManual: false,
        isExcluded: false,
        isRefund: false,
        isCash: false,
        accountId: null,
      },
    ]);
  });

  test('re-ingesting an sms already in sourceSmsIds changes nothing', () => {
    const first = mergeIntoExisting([], [parsed('s1')], newId).created;
    expect(mergeIntoExisting(first, [parsed('s1')], newId)).toEqual({ created: [], updated: [] });
  });

  test('the same sms twice in one batch creates one transaction', () => {
    expect(mergeIntoExisting([], [parsed('s1'), parsed('s1')], newId).created).toHaveLength(1);
  });
});
