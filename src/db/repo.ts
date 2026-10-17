import { getDb } from '@/db/client';
import type { Transaction } from '@/domain/types';

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
    await db.withTransactionAsync(async () => {
      for (const t of txns) {
        await db.runAsync('INSERT OR REPLACE INTO transactions (id, occurred_at, data) VALUES (?, ?, ?)', [
          t.id,
          t.occurredAt,
          JSON.stringify(t),
        ]);
      }
    });
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
