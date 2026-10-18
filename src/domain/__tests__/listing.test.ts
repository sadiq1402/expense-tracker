import { describeRow, detailMeta, groupByDay, reviewSummary } from '@/domain/listing';

import { txn } from './fixtures/txn';

const ist = (iso: string) => Date.parse(`${iso}+05:30`);
const NOW = ist('2026-10-18T15:00:00');

describe('groupByDay', () => {
  test('groups newest first under IST day headings with each day’s spend', () => {
    const groups = groupByDay(
      [
        txn({ occurredAt: ist('2026-10-16T09:00:00'), amountPaise: 8000 }),
        txn({ occurredAt: ist('2026-10-18T13:12:00'), amountPaise: 34900 }),
        txn({ occurredAt: ist('2026-10-17T23:59:00'), amountPaise: 22000 }),
        txn({ occurredAt: ist('2026-10-17T16:30:00'), amountPaise: 50000, direction: 'credit', isRefund: true }),
        txn({ occurredAt: ist('2026-10-17T10:00:00'), amountPaise: 500000, isSelfTransfer: true }),
        txn({ occurredAt: ist('2026-10-18T00:05:00'), amountPaise: 100000 }),
      ],
      NOW,
    );
    expect(groups.map((g) => [g.label, g.spendPaise, g.txns.length])).toEqual([
      ['Today', 134900, 2],
      ['Yesterday · Sat 17 Oct', -28000, 3],
      ['Fri 16 Oct', 8000, 1],
    ]);
    expect(groups[0].txns.map((t) => t.occurredAt)).toEqual([ist('2026-10-18T13:12:00'), ist('2026-10-18T00:05:00')]);
  });

  test('a late-night IST transaction stays on its IST day, not the UTC one', () => {
    const [group] = groupByDay([txn({ occurredAt: ist('2026-10-16T01:00:00') })], NOW);
    expect(group.label).toBe('Fri 16 Oct');
  });

  test('older years show the year', () => {
    expect(groupByDay([txn({ occurredAt: ist('2025-12-31T12:00:00') })], NOW)[0].label).toBe('Wed 31 Dec 2025');
  });
});

describe('describeRow', () => {
  const names = { category: 'Food', account: 'HDFC ··1234' };
  const at = ist('2026-10-18T13:12:00');

  test('a debit shows Category, Account and time', () => {
    expect(describeRow(txn({ occurredAt: at }), names)).toEqual({
      subtitle: 'Food · HDFC ··1234 · 1:12 pm',
      tone: 'normal',
    });
  });

  test('a Refund is marked and shown as money in', () => {
    expect(describeRow(txn({ occurredAt: at, direction: 'credit', isRefund: true }), names)).toEqual({
      subtitle: 'Refund · Food · 1:12 pm',
      tone: 'credit',
    });
  });

  test('Self-Transfers and Excluded Transactions are not counted', () => {
    expect(describeRow(txn({ occurredAt: at, isSelfTransfer: true }), names).tone).toBe('uncounted');
    expect(describeRow(txn({ occurredAt: at, isSelfTransfer: true }), names).subtitle).toBe(
      'Self-Transfer · not counted',
    );
    expect(describeRow(txn({ occurredAt: at, isExcluded: true }), names).subtitle).toBe(
      'Excluded · Food · not counted',
    );
  });

  test('a Cash Transaction shows its note; missing parts are skipped', () => {
    expect(
      describeRow(txn({ occurredAt: at, isCash: true, note: 'chai' }), { category: 'Food', account: null }),
    ).toEqual({
      subtitle: 'Food · “chai” · 1:12 pm',
      tone: 'normal',
    });
    expect(describeRow(txn({ occurredAt: at }), { category: null, account: null }).subtitle).toBe('1:12 pm');
  });

  test('an ordinary credit is money in', () => {
    expect(describeRow(txn({ occurredAt: at, direction: 'credit' }), names).tone).toBe('credit');
  });
});

describe('reviewSummary', () => {
  test('names a single shared reason in plain words', () => {
    expect(reviewSummary(['amount not found', 'amount not found'])).toBe('We couldn’t read the amount');
  });

  test('falls back to a generic prompt for mixed reasons', () => {
    expect(reviewSummary(['amount not found', 'something else'])).toBe('Tap to check them');
  });
});

describe('detailMeta', () => {
  const at = ist('2026-10-18T13:12:00');

  test('joins date, time, channel and Account', () => {
    expect(detailMeta(txn({ occurredAt: at, channel: 'upi' }), 'HDFC ··1234', NOW)).toBe(
      'Sun 18 Oct · 1:12 pm · UPI · HDFC ··1234',
    );
  });

  test('names each channel and skips what is missing', () => {
    expect(detailMeta(txn({ occurredAt: at, channel: 'neft_imps' }), null, NOW)).toBe(
      'Sun 18 Oct · 1:12 pm · NEFT/IMPS',
    );
    expect(detailMeta(txn({ occurredAt: at, channel: 'other', isCash: true }), null, NOW)).toBe(
      'Sun 18 Oct · 1:12 pm · Cash',
    );
  });
});
