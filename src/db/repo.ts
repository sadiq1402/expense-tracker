import { getDb } from '@/db/client';
import { DEFAULT_CATEGORIES } from '@/domain/categorize';
import type { Account, Category, MerchantRule, RawSms, Transaction } from '@/domain/types';

export interface NeedsReviewItem {
  sms: RawSms;
  reason: string;
}

type MetaKey = 'lastSmsAt';

// Rows written before sender tracking lack sourceSenders
const toTransaction = (data: string): Transaction => ({ sourceSenders: [], ...JSON.parse(data) });

export const repo = {
  async allTransactions(): Promise<Transaction[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM transactions ORDER BY occurred_at DESC');
    return rows.map((r) => toTransaction(r.data));
  },

  async getTransaction(id: string): Promise<Transaction | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM transactions WHERE id = ?', [id]);
    return row ? toTransaction(row.data) : null;
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

  async categories(): Promise<Category[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM categories ORDER BY name');
    return [...DEFAULT_CATEGORIES, ...rows.map((r) => ({ ...r, builtIn: false }))];
  },

  async addCategory(c: Category) {
    const db = await getDb();
    await db.runAsync('INSERT INTO categories (id, name) VALUES (?, ?)', [c.id, c.name]);
  },

  async userRules(): Promise<MerchantRule[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ merchant: string; category_id: string }>('SELECT merchant, category_id FROM merchant_rules');
    return rows.map((r) => ({ merchant: r.merchant, categoryId: r.category_id, source: 'user' }));
  },

  async upsertRule(r: MerchantRule) {
    const db = await getDb();
    await db.runAsync('INSERT OR REPLACE INTO merchant_rules (merchant, category_id) VALUES (?, ?)', [
      r.merchant,
      r.categoryId,
    ]);
  },

  async accounts(): Promise<Account[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: string; mask: string; name: string; confirmed: number; hidden: number }>(
      'SELECT id, mask, name, confirmed, hidden FROM accounts ORDER BY name',
    );
    return rows.map((r) => ({ ...r, confirmed: r.confirmed === 1, hidden: r.hidden === 1 }));
  },

  async upsertAccounts(accounts: Account[]) {
    if (accounts.length === 0) return;
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const a of accounts) {
        await txn.runAsync(
          'INSERT OR REPLACE INTO accounts (id, mask, name, confirmed, hidden) VALUES (?, ?, ?, ?, ?)',
          [a.id, a.mask, a.name, a.confirmed ? 1 : 0, a.hidden ? 1 : 0],
        );
      }
    });
  },

  async saveSms(messages: RawSms[]) {
    if (messages.length === 0) return;
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const sms of messages) {
        await txn.runAsync('INSERT OR IGNORE INTO sms_bodies (sms_id, sms) VALUES (?, ?)', [
          sms.id,
          JSON.stringify(sms),
        ]);
      }
    });
  },

  async smsFor(ids: string[]): Promise<RawSms[]> {
    if (ids.length === 0) return [];
    const db = await getDb();
    const rows = await db.getAllAsync<{ sms: string }>(
      `SELECT sms FROM sms_bodies WHERE sms_id IN (${ids.map(() => '?').join(', ')})`,
      ids,
    );
    return rows.map((r) => JSON.parse(r.sms) as RawSms).sort((a, b) => a.receivedAt - b.receivedAt);
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
