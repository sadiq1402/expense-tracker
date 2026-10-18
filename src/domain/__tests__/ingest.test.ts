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
  sourceSender: 'VM-HDFCBK',
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
        sourceSenders: ['VM-HDFCBK'],
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

const MIN = 60_000;

describe('one payment reported by several SMS', () => {
  test('same UPI Reference from bank and UPI app becomes one transaction', () => {
    const bank = parsed('s1', { upiRef: '628812345678', merchant: null });
    const app = parsed('s2', { upiRef: '628812345678', sourceSender: 'VM-PHONPE', occurredAt: 1_000 + 30 * MIN });
    const { created } = mergeIntoExisting([], [bank, app], newId);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      sourceSmsIds: ['s1', 's2'],
      sourceSenders: ['VM-HDFCBK', 'VM-PHONPE'],
      merchant: 'SWIGGY',
    });
  });

  test('a later SMS updates the stored transaction instead of creating one', () => {
    const first = mergeIntoExisting([], [parsed('s1', { upiRef: '628812345678' })], newId).created;
    const { created, updated } = mergeIntoExisting(
      first,
      [parsed('s2', { upiRef: '628812345678', sourceSender: 'VM-PHONPE' })],
      newId,
    );
    expect(created).toEqual([]);
    expect(updated).toEqual([expect.objectContaining({ id: 't1', sourceSmsIds: ['s1', 's2'] })]);
  });

  test('without a reference, same amount and direction 3 minutes apart from different senders merge', () => {
    const app = parsed('s2', { sourceSender: 'VM-PHONPE', occurredAt: 1_000 + 3 * MIN, accountMask: null });
    const { created } = mergeIntoExisting([], [parsed('s1'), app], newId);
    expect(created).toHaveLength(1);
  });

  test('a reference on only one side still merges by amount and time', () => {
    const app = parsed('s2', { sourceSender: 'VM-PHONPE', occurredAt: 1_000 + 3 * MIN, upiRef: '628812345678' });
    const { created } = mergeIntoExisting([], [parsed('s1'), app], newId);
    expect(created).toEqual([expect.objectContaining({ upiRef: '628812345678', sourceSmsIds: ['s1', 's2'] })]);
  });

  test('re-scanning SMS already merged into a transaction changes nothing', () => {
    const app = parsed('s2', { sourceSender: 'VM-PHONPE', occurredAt: 1_000 + 3 * MIN });
    const first = mergeIntoExisting([], [parsed('s1'), app], newId).created;
    expect(mergeIntoExisting(first, [parsed('s1'), app], newId)).toEqual({ created: [], updated: [] });
  });

  test('matches in time order even when the inbox batch is not sorted', () => {
    const late = parsed('s2', { occurredAt: 1_000 + 4 * MIN });
    const app = parsed('s3', { sourceSender: 'VM-PHONPE', occurredAt: 1_000 + 4 * MIN, merchant: 'ZOMATO' });
    const { created } = mergeIntoExisting([], [late, app, parsed('s1')], newId);
    expect(created.find((t) => t.sourceSmsIds.includes('s3'))?.sourceSmsIds).toEqual(['s2', 's3']);
  });

  test('never fuzzy-merges into a transaction whose senders are unknown', () => {
    const legacy = { ...mergeIntoExisting([], [parsed('s1')], newId).created[0], sourceSenders: [] };
    const { created } = mergeIntoExisting([legacy], [parsed('s2', { occurredAt: 1_000 + 2 * MIN })], newId);
    expect(created).toHaveLength(1);
  });

  test('6 minutes apart stay separate', () => {
    const app = parsed('s2', { sourceSender: 'VM-PHONPE', occurredAt: 1_000 + 6 * MIN });
    expect(mergeIntoExisting([], [parsed('s1'), app], newId).created).toHaveLength(2);
  });

  test('opposite directions stay separate', () => {
    const credit = parsed('s2', { sourceSender: 'VM-PHONPE', direction: 'credit' });
    expect(mergeIntoExisting([], [parsed('s1'), credit], newId).created).toHaveLength(2);
  });

  test('same sender within 5 minutes is two genuine payments', () => {
    const again = parsed('s2', { occurredAt: 1_000 + 2 * MIN });
    expect(mergeIntoExisting([], [parsed('s1'), again], newId).created).toHaveLength(2);
  });

  test('two identical payments 2 minutes apart with different UPI References stay separate', () => {
    const a = parsed('s1', { upiRef: '628812345678' });
    const b = parsed('s2', { upiRef: '628812345679', sourceSender: 'VM-PHONPE', occurredAt: 1_000 + 2 * MIN });
    expect(mergeIntoExisting([], [a, b], newId).created).toHaveLength(2);
  });
});
