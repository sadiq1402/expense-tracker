import * as SQLite from 'expo-sqlite';

const MIGRATIONS = [
  `CREATE TABLE transactions (id TEXT PRIMARY KEY NOT NULL, occurred_at INTEGER NOT NULL, data TEXT NOT NULL);
   CREATE INDEX transactions_occurred_at ON transactions (occurred_at);
   CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
  // Resolved rows are kept (not deleted) so a re-scan can't resurrect them
  `CREATE TABLE needs_review (sms_id TEXT PRIMARY KEY NOT NULL, received_at INTEGER NOT NULL, sms TEXT NOT NULL,
     reason TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0);`,
  // Only custom Categories and user Merchant Rules; defaults and seeds live in code
  `CREATE TABLE categories (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL UNIQUE COLLATE NOCASE);
   CREATE TABLE merchant_rules (merchant TEXT PRIMARY KEY NOT NULL, category_id TEXT NOT NULL);`,
  `CREATE TABLE accounts (id TEXT PRIMARY KEY NOT NULL, mask TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
     confirmed INTEGER NOT NULL DEFAULT 0);`,
  // The SMS a Transaction came from, for its Original SMS section; earlier scans didn't keep them
  `CREATE TABLE sms_bodies (sms_id TEXT PRIMARY KEY NOT NULL, sms TEXT NOT NULL);`,
  // Every existing Account stays shown; hiding is always the user's choice
  `ALTER TABLE accounts ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;`,
  // Merchants the user has put in more than one Category; they never have a Merchant Rule
  `CREATE TABLE mixed_merchants (merchant TEXT PRIMARY KEY NOT NULL);`,
];

let db: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(conn: SQLite.SQLiteDatabase) {
  const row = await conn.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (let v = row?.user_version ?? 0; v < MIGRATIONS.length; v++) {
    await conn.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[v]);
      await txn.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return conn;
}

export function getDb() {
  db ??= SQLite.openDatabaseAsync('expense-tracker.db').then(migrate);
  return db;
}
