import { getDb } from '@/db/client';
import type { RawSms, Transaction } from '@/domain/types';

export interface NeedsReviewItem {
  sms: RawSms;
  reason: string;
}

type MetaKey = 'lastSmsAt';

export const repo = {
  async allTransactions(): Promise<Transaction[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM transactions ORDER BY occurred_at DESC');
    return rows.map((r) => JSON.parse(r.data));
  },

  async upsertTransactions(txns: Transaction[]) {
    if (txns.length === 0) return;
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const t of txns) {
        await txn.runAsync('INSERT OR REPLACE INTO transactions (id, occurred_at, data) VALUES (?, ?, ?)', [
          t.id,
          t.occurredAt,
          JSON.stringify(t),
        ]);
      }
    });
  },

  async addNeedsReview(items: NeedsReviewItem[]) {
    if (items.length === 0) return;
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const { sms, reason } of items) {
        await txn.runAsync('INSERT OR IGNORE INTO needs_review (sms_id, received_at, sms, reason) VALUES (?, ?, ?, ?)', [
          sms.id,
          sms.receivedAt,
          JSON.stringify(sms),
          reason,
        ]);
      }
    });
  },

  async listNeedsReview(): Promise<NeedsReviewItem[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ sms: string; reason: string }>(
      'SELECT sms, reason FROM needs_review WHERE resolved = 0 ORDER BY received_at DESC',
    );
    return rows.map((r) => ({ sms: JSON.parse(r.sms), reason: r.reason }));
  },

  async resolveNeedsReview(smsId: string) {
    const db = await getDb();
    await db.runAsync('UPDATE needs_review SET resolved = 1 WHERE sms_id = ?', [smsId]);
  },

  async getMeta(key: MetaKey): Promise<string | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
    return row?.value ?? null;
  },

  async setMeta(key: MetaKey, value: string) {
    const db = await getDb();
    await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
  },
};
